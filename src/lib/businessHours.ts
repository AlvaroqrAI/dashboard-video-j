import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { DEMO_MODE } from '@/lib/demo'

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type DayKey = (typeof DAY_KEYS)[number]

export const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo',
}

export const TIMEZONES = [
  { value: 'Europe/Madrid', label: 'Península y Baleares' },
  { value: 'Atlantic/Canary', label: 'Canarias' },
]

export interface DayHours { open: string; close: string }
export interface BusinessHours { tz: string; days: Record<DayKey, DayHours | null> }

// Mismo horario que estaba escrito a fuego antes (L-V 07:00–15:00): los talleres que
// no hayan configurado nada siguen viendo exactamente las mismas cifras.
export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  tz: 'Europe/Madrid',
  days: {
    mon: { open: '07:00', close: '15:00' },
    tue: { open: '07:00', close: '15:00' },
    wed: { open: '07:00', close: '15:00' },
    thu: { open: '07:00', close: '15:00' },
    fri: { open: '07:00', close: '15:00' },
    sat: null,
    sun: null,
  },
}

const HHMM = /^\d{2}:\d{2}$/

export function parseBusinessHours(raw: unknown): BusinessHours {
  if (!raw || typeof raw !== 'object') return DEFAULT_BUSINESS_HOURS
  const r = raw as { tz?: unknown; days?: Record<string, unknown> }
  if (!r.days || typeof r.days !== 'object') return DEFAULT_BUSINESS_HOURS

  const days = {} as Record<DayKey, DayHours | null>
  for (const k of DAY_KEYS) {
    const d = r.days[k] as { open?: unknown; close?: unknown } | null | undefined
    if (d && typeof d.open === 'string' && typeof d.close === 'string' && HHMM.test(d.open) && HHMM.test(d.close)) {
      days[k] = { open: d.open, close: d.close }
    } else {
      days[k] = null
    }
  }
  const tz = TIMEZONES.some(t => t.value === r.tz) ? (r.tz as string) : DEFAULT_BUSINESS_HOURS.tz
  return { tz, days }
}

const toMinutes = (hhmm: string) => parseInt(hhmm.slice(0, 2), 10) * 60 + parseInt(hhmm.slice(3, 5), 10)

const EN_DAY: Record<string, DayKey> = { Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun' }
const JS_DAY: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function formatter(tz: string) {
  let f = fmtCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    fmtCache.set(tz, f)
  }
  return f
}

// Día de la semana y minuto del día de un instante, en la zona horaria del taller.
function localParts(ts: string, tz: string): { day: DayKey; minutes: number } {
  const parts = formatter(tz).formatToParts(new Date(ts))
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? ''
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10) % 24
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10)
  return { day: EN_DAY[weekday] ?? 'mon', minutes: hour * 60 + minute }
}

function isOpenAt(day: DayKey, minutes: number, bh: BusinessHours): boolean {
  const d = bh.days[day]
  return !!d && minutes >= toMinutes(d.open) && minutes < toMinutes(d.close)
}

export function isOutOfHours(ts: string, bh: BusinessHours): boolean {
  if (!ts) return false
  const { day, minutes } = localParts(ts, bh.tz)
  return !isOpenAt(day, minutes, bh)
}

// Para citas: fecha (yyyy-mm-dd) y hora (HH:mm[:ss]) sin zona horaria, tal cual se guardan.
export function isApptOutOfHours(date: string, time: string, bh: BusinessHours): boolean {
  const day = JS_DAY[new Date(`${date}T00:00:00`).getDay()]
  return !isOpenAt(day, toMinutes(time.slice(0, 5)), bh)
}

export function hourOfDay(ts: string, tz: string): number {
  return Math.floor(localParts(ts, tz).minutes / 60)
}

// ¿Esa hora del día (0-23) cae dentro del horario de algún día de la semana?
export function isHourOpen(hour: number, bh: BusinessHours): boolean {
  return DAY_KEYS.some(k => {
    const d = bh.days[k]
    return !!d && hour * 60 < toMinutes(d.close) && (hour + 1) * 60 > toMinutes(d.open)
  })
}

export function useBusinessHours() {
  const { user } = useAuth()
  const [hours, setHours] = useState<BusinessHours>(DEFAULT_BUSINESS_HOURS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || DEMO_MODE) { setLoading(false); return }
    // Consulta aislada: si la columna aún no existe, se usa el horario por defecto
    // y nunca se rompe el resto de la página.
    supabase.from('profiles').select('business_hours').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        setHours(parseBusinessHours(data?.business_hours))
        setLoading(false)
      }, () => setLoading(false))
  }, [user])

  return { hours, loading, setHours }
}
