// Lógica de agenda compartida por las tools check-availability y book-appointment.
//
// La agenda de cada taller vive en Supabase: horario en profiles.business_hours,
// capacidad en profiles.max_concurrent_appointments y las citas en appointments.
// Los huecos son de 30 minutos (cada cita ocupa 60), dentro del horario del taller,
// saltando la pausa de mediodía si la tiene y nunca en el pasado.
import { adminClient } from './auth.ts'

const SLOT_STEP_MIN = 30
const APPT_DURATION_MIN = 60
const MIN_NOTICE_MIN = 60   // no se ofrecen huecos que empiecen en menos de una hora
const SEARCH_DAYS = 14      // cuántos días hacia delante se buscan alternativas
const MAX_ALTERNATIVES = 3

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const DAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

interface DayHours { open: string; close: string; break?: { start: string; end: string } | null }
interface BusinessHours { tz: string; days: Record<string, DayHours | null> }

const DEFAULT_HOURS: BusinessHours = {
  tz: 'Europe/Madrid',
  days: {
    mon: { open: '07:00', close: '15:00' }, tue: { open: '07:00', close: '15:00' },
    wed: { open: '07:00', close: '15:00' }, thu: { open: '07:00', close: '15:00' },
    fri: { open: '07:00', close: '15:00' }, sat: null, sun: null,
  },
}

const HHMM = /^\d{2}:\d{2}$/
const toMin = (hhmm: string) => parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(3, 5), 10)
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

function parseHours(raw: unknown): BusinessHours {
  const r = raw as BusinessHours | null
  if (!r || typeof r !== 'object' || !r.days) return DEFAULT_HOURS
  return { tz: typeof r.tz === 'string' ? r.tz : 'Europe/Madrid', days: r.days }
}

// Fecha (YYYY-MM-DD) y minutos desde medianoche de "ahora" en la zona del taller.
function nowInTz(tz: string): { date: string; minutes: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).map((x) => [x.type, x.value]),
  )
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: parseInt(p.hour, 10) * 60 + parseInt(p.minute, 10) }
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const dayIndex = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay()

// "miércoles 28 de octubre a las 09:30", para que el agente lo lea tal cual.
export function describeSlot(date: string, time: string): string {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const d = new Date(`${date}T12:00:00Z`)
  return `${DAY_NAMES_ES[d.getUTCDay()]} ${d.getUTCDate()} de ${months[d.getUTCMonth()]} a las ${time}`
}

// Huecos posibles (hh:mm) de un día según el horario, sin mirar la ocupación.
function daySlots(hours: BusinessHours, date: string): string[] {
  const h = hours.days[DAY_KEYS[dayIndex(date)]]
  if (!h || !HHMM.test(h.open) || !HHMM.test(h.close)) return []
  const open = toMin(h.open), close = toMin(h.close)
  const brk = h.break && HHMM.test(h.break.start) && HHMM.test(h.break.end)
    ? [toMin(h.break.start), toMin(h.break.end)] : null
  const out: string[] = []
  for (let s = open; s + APPT_DURATION_MIN <= close; s += SLOT_STEP_MIN) {
    if (brk && s < brk[1] && s + APPT_DURATION_MIN > brk[0]) continue // pisaría la pausa
    out.push(toHHMM(s))
  }
  return out
}

// Normaliza fecha y hora venga como date+time o como start_time ISO.
export function parseRequestedSlot(args: Record<string, unknown>): { date?: string; time?: string } {
  let date = typeof args.date === 'string' ? args.date.slice(0, 10) : undefined
  let time = typeof args.time === 'string' ? args.time.slice(0, 5) : undefined
  const st = typeof args.start_time === 'string' ? args.start_time : undefined
  if (st && (!date || !time)) {
    // "2026-10-28T09:00:00.000+01:00": la parte local ya viene en la hora del taller.
    const m = st.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/)
    if (m) { date = date ?? m[1]; time = time ?? m[2] }
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) date = undefined
  if (time && !HHMM.test(time)) time = undefined
  return { date, time }
}

export interface Agenda {
  hours: BusinessHours
  maxSlots: number
  isOpenSlot: (date: string, time: string) => boolean
  isFree: (date: string, time: string) => boolean
  alternatives: (date: string, time?: string) => Array<{ date: string; time: string; texto: string }>
}

// Carga horario, capacidad y citas de los próximos días de un taller.
export async function loadAgenda(userId: string): Promise<Agenda> {
  const admin = adminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('business_hours, max_concurrent_appointments')
    .eq('id', userId)
    .single()
  const hours = parseHours(profile?.business_hours)
  const maxSlots = profile?.max_concurrent_appointments ?? 2
  const now = nowInTz(hours.tz)

  const { data: appts } = await admin
    .from('appointments')
    .select('appointment_date, appointment_time')
    .eq('user_id', userId)
    .neq('status', 'cancelled')
    .gte('appointment_date', now.date)
    .lte('appointment_date', addDays(now.date, SEARCH_DAYS + 31))
  const taken = new Map<string, number>()
  for (const a of appts ?? []) {
    const k = `${a.appointment_date} ${String(a.appointment_time).slice(0, 5)}`
    taken.set(k, (taken.get(k) ?? 0) + 1)
  }

  const notPast = (date: string, time: string) =>
    date > now.date || (date === now.date && toMin(time) >= now.minutes + MIN_NOTICE_MIN)
  const isOpenSlot = (date: string, time: string) => daySlots(hours, date).includes(time) && notPast(date, time)
  const isFree = (date: string, time: string) => isOpenSlot(date, time) && (taken.get(`${date} ${time}`) ?? 0) < maxSlots

  const alternatives = (date: string, time?: string) => {
    const out: Array<{ date: string; time: string; texto: string }> = []
    const start = date < now.date ? now.date : date
    for (let i = 0; i <= SEARCH_DAYS && out.length < MAX_ALTERNATIVES; i++) {
      const d = addDays(start, i)
      let slots = daySlots(hours, d).filter((t) => isFree(d, t))
      // El día pedido: primero los huecos más cercanos a la hora pedida.
      if (i === 0 && time) slots = slots.sort((a, b) => Math.abs(toMin(a) - toMin(time)) - Math.abs(toMin(b) - toMin(time)))
      for (const t of slots) {
        if (out.length >= MAX_ALTERNATIVES) break
        if (d === date && t === time) continue
        out.push({ date: d, time: t, texto: describeSlot(d, t) })
      }
    }
    return out
  }

  return { hours, maxSlots, isOpenSlot, isFree, alternatives }
}

// Retell manda los argumentos dentro de "args" (o en la raíz si la tool tiene
// args_at_root). Aceptamos las dos formas.
export function toolArgs(body: Record<string, unknown>): Record<string, unknown> {
  const a = body?.args
  return a && typeof a === 'object' ? (a as Record<string, unknown>) : body
}
