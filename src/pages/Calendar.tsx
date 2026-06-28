import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface Appointment {
  call_id: string
  start_timestamp: string
  transcript: string | null
  call_reason?: string | null
  duration_ms: number
}

// Demo appointments when no real data
const DEMO_APPTS: Appointment[] = [
  { call_id: 'a1', start_timestamp: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString(), transcript: 'Revisión anual Ford Focus', call_reason: 'Pedir cita', duration_ms: 180000 },
  { call_id: 'a2', start_timestamp: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString(), transcript: 'Cambio de frenos Seat León', call_reason: 'Pedir cita', duration_ms: 120000 },
  { call_id: 'a3', start_timestamp: new Date(new Date().setDate(new Date().getDate() + 3)).toISOString(), transcript: 'ITV previa Renault Clio', call_reason: 'Pedir cita', duration_ms: 90000 },
  { call_id: 'a4', start_timestamp: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(), transcript: 'Diagnóstico avería motor', call_reason: 'Urgencia', duration_ms: 200000 },
  { call_id: 'a5', start_timestamp: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(), transcript: 'Cambio aceite Volkswagen Golf', call_reason: 'Pedir cita', duration_ms: 150000 },
  { call_id: 'a6', start_timestamp: new Date(new Date().setDate(new Date().getDate() - 5)).toISOString(), transcript: 'Revisión neumáticos BMW Serie 3', call_reason: 'Pedir cita', duration_ms: 110000 },
]

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function extractClientName(transcript: string | null): string {
  if (!transcript) return 'Cliente'
  const match = transcript.match(/(?:mi nombre es|me llamo|soy)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})/i)
  if (match) return match[1].trim()
  return 'Cliente'
}

function extractCar(transcript: string | null): string {
  if (!transcript) return '—'
  const brands = ['Toyota', 'Volkswagen', 'VW', 'Seat', 'Renault', 'Ford', 'BMW', 'Mercedes', 'Peugeot', 'Hyundai', 'Fiat', 'Lamborghini', 'Kia', 'Opel', 'Nissan', 'Audi', 'Skoda', 'Volvo', 'Honda', 'Mazda', 'Suzuki', 'Citroën', 'Citroen', 'Dacia', 'Jeep', 'Mini']
  // Paso 1: buscar marca en turnos del usuario
  const userLines = transcript.match(/User:\s*([^]*?)(?=\s*(?:Agent:|User:|$))/g) ?? []
  for (const line of userLines) {
    for (const b of brands) {
      const m = line.match(new RegExp(`(${b}[\\s\\w\\-]{0,20})`, 'i'))
      if (m) {
        return m[1].trim().replace(/[.,!\?].*$/, '').replace(/\s+matrícula.*$/i, '').trim()
      }
    }
  }
  // Paso 2: buscar en líneas del agente que confirman el modelo ("un Toyota CHR", "un Fiat Panda")
  const agentLines = transcript.match(/Agent:\s*([^]*?)(?=\s*(?:Agent:|User:|$))/g) ?? []
  for (const line of agentLines) {
    for (const b of brands) {
      const m = line.match(new RegExp(`(?:un |una )(${b}[\\s\\w\\-]{0,20})`, 'i'))
      if (m) {
        return m[1].trim().replace(/[.,!\?].*$/, '').replace(/\s+(?:con|matr|correct).*$/i, '').trim()
      }
    }
  }
  return '—'
}

const NUM_MAP: Record<string, number> = {
  cero:0, uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9,
  diez:10, once:11, doce:12, trece:13, catorce:14, quince:15,
  dieciséis:16, dieciseis:16, diecisiete:17, dieciocho:18, diecinueve:19,
  veinte:20, veintiuno:21, veintidós:22, veintidos:22, veintitrés:23, veintitres:23,
  veinticuatro:24, veinticinco:25, veintiséis:26, veintiseis:26, veintisiete:27, veintiocho:28, veintinueve:29,
  treinta:30, cuarenta:40, cincuenta:50, sesenta:60, setenta:70, ochenta:80, noventa:90,
}

function spokenToPlate(text: string): string {
  // Separar letras del final (LVR, KLM, etc.)
  const lettersMatch = text.match(/\b([A-Z]{2,3})\s*$/i)
  const letters = lettersMatch ? lettersMatch[1].toUpperCase() : ''
  const numPart = lettersMatch ? text.slice(0, lettersMatch.index).trim() : text

  // Tokenizar y convertir números
  const tokens = numPart.toLowerCase()
    .replace(/\s+y\s+/g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean)

  const digits: number[] = []
  let i = 0
  while (i < tokens.length) {
    const val = NUM_MAP[tokens[i]]
    if (val !== undefined) {
      // Si el siguiente token también es un número y juntos forman una decena+unidad
      const next = NUM_MAP[tokens[i + 1]]
      if (next !== undefined && val >= 20 && next < 10) {
        digits.push(val + next)
        i += 2
      } else {
        digits.push(val)
        i++
      }
    } else {
      // Puede ser una letra suelta (l, v, r) o algo no reconocido
      const upper = tokens[i].toUpperCase()
      if (/^[A-Z]$/.test(upper)) {
        // letra individual → va al final como parte de la matrícula
      }
      i++
    }
  }

  const numStr = digits.join('')
  if (!numStr && !letters) return ''
  return [numStr, letters].filter(Boolean).join(' ')
}

function extractPlate(transcript: string | null): string {
  if (!transcript) return '—'
  // Dividir en turnos: ["Agent: ...", "User: ...", ...]
  const turns = transcript.split(/(?=Agent:|User:)/).map(t => t.trim()).filter(Boolean)
  for (let i = 0; i < turns.length - 1; i++) {
    const isAgentAskingPlate = turns[i].startsWith('Agent:') && /matr[ií]cula/i.test(turns[i])
    if (isAgentAskingPlate) {
      // El siguiente turno del usuario tiene la matrícula
      const userTurn = turns[i + 1]
      if (userTurn.startsWith('User:')) {
        const answer = userTurn.replace(/^User:\s*/, '').trim()
        // Descartar respuestas que no son matrícula (muy cortas, preguntas, o "no la recuerdo")
        if (answer.length > 2 && !answer.startsWith('¿') && !/no (la |me |tengo|recuerdo)/i.test(answer)) {
          const converted = spokenToPlate(answer)
          return converted || answer.slice(0, 40)
        }
      }
    }
  }
  return '—'
}

function extractReason(transcript: string | null, callReason?: string | null): string {
  if (callReason) return callReason
  if (!transcript) return 'Cita agendada'
  const t = transcript.toLowerCase()
  if (t.includes('aceite') || t.includes('filtro')) return 'Cambio aceite/filtro'
  if (t.includes('freno') || t.includes('pastilla')) return 'Frenos'
  if (t.includes('itv')) return 'Revisión pre-ITV'
  if (t.includes('revisión') || t.includes('revision') || t.includes('mantenimiento')) return 'Revisión / Mantenimiento'
  if (t.includes('turbo')) return 'Reparación turbo'
  if (t.includes('amortiguador')) return 'Amortiguadores'
  if (t.includes('neumático') || t.includes('rueda') || t.includes('pincha')) return 'Neumáticos'
  if (t.includes('diagnos') || t.includes('avería') || t.includes('trompicón') || t.includes('tirón')) return 'Diagnóstico / Avería'
  if (t.includes('escape')) return 'Tubo de escape'
  if (t.includes('luna')) return 'Sustitución luna'
  return 'Cita agendada'
}

function getTitle(appt: Appointment): string {
  const name = extractClientName(appt.transcript)
  const reason = extractReason(appt.transcript, appt.call_reason)
  return `${name} · ${reason}`
}

function fmtHour(ts: string) {
  return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

const COLOR_BY_REASON: Record<string, { bg: string; color: string }> = {
  'Pedir cita':     { bg: 'rgba(124,111,224,0.25)', color: '#C4BCFF' },
  'Urgencia':       { bg: 'rgba(248,113,113,0.2)',  color: '#FCA5A5' },
  'Consulta precio':{ bg: 'rgba(34,211,238,0.15)',  color: '#67E8F9' },
  'Consulta horario':{ bg: 'rgba(251,191,36,0.15)', color: '#FDE68A' },
  'Consulta general':{ bg: 'rgba(52,211,153,0.15)', color: '#6EE7B7' },
}

function ApptCard({ a, color }: { a: Appointment; color: { bg: string; color: string } }) {
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setExpanded(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const name = extractClientName(a.transcript)
  const reason = extractReason(a.transcript, a.call_reason)
  const car = extractCar(a.transcript)
  const plate = extractPlate(a.transcript)

  return (
    <div ref={ref} onClick={() => setExpanded(v => !v)}
      style={{ background: color.bg, border: `1px solid ${color.color}33`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s', flex: '1 1 160px', minWidth: 160 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: color.color, marginBottom: 3 }}>{fmtHour(a.start_timestamp)}</div>
      <div style={{ fontSize: 12, color: '#F1F0F5', fontWeight: 600 }}>{name}</div>
      <div style={{ fontSize: 10, color: '#8B8A99', marginTop: 2 }}>{reason}</div>
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${color.color}33` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div>
              <div style={{ fontSize: 9, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Cliente</div>
              <div style={{ fontSize: 11, color: '#F1F0F5', fontWeight: 600 }}>{name}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Motivo</div>
              <div style={{ fontSize: 11, color: '#F1F0F5', fontWeight: 600 }}>{reason}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Vehículo</div>
              <div style={{ fontSize: 11, color: '#F1F0F5', fontWeight: 600 }}>{car}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Matrícula</div>
              <div style={{ fontSize: 11, color: '#F1F0F5', fontWeight: 600 }}>{plate}</div>
            </div>
          </div>
          {a.transcript && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 9, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Transcripción</div>
              <div style={{ maxHeight: 120, overflowY: 'auto', fontSize: 10, color: '#8B8A99', lineHeight: 1.6, background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '8px 10px' }}>
                {a.transcript.split(/(?=Agent:|User:)/).map((line, i) => {
                  const isAgent = line.startsWith('Agent:')
                  return (
                    <div key={i} style={{ marginBottom: 4 }}>
                      <span style={{ color: isAgent ? color.color : '#C4C3D0', fontWeight: 600, fontSize: 9 }}>{isAgent ? 'Sara' : 'Cliente'}: </span>
                      <span>{line.replace(/^(Agent:|User:)\s*/, '')}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Calendar() {
  const { user } = useAuth()
  const [rawAppts, setRawAppts] = useState<Appointment[]>([])
  const [today] = useState(new Date())
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState<Date | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('call_logs')
      .select('call_id,start_timestamp,transcript,call_reason,duration_ms')
      .eq('user_id', user.id)
      .eq('is_appointment', true)
      .order('start_timestamp', { ascending: true })
      .then(({ data }) => setRawAppts((data ?? []) as Appointment[]))
  }, [user])

  const appts = rawAppts.length > 0 ? rawAppts : DEMO_APPTS
  const isDemo = rawAppts.length === 0

  // Calendar grid
  const year = current.getFullYear()
  const month = current.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  // Monday-first offset
  const startOffset = (firstDay.getDay() + 6) % 7
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7
  const cells: (Date | null)[] = []
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1
    if (dayNum < 1 || dayNum > lastDay.getDate()) cells.push(null)
    else cells.push(new Date(year, month, dayNum))
  }

  function apptsForDay(date: Date) {
    return appts.filter(a => {
      const d = new Date(a.start_timestamp)
      return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate()
    })
  }

  const selectedAppts = selected ? apptsForDay(selected) : []

  const isToday = (d: Date) => d.toDateString() === today.toDateString()
  const isSelected = (d: Date) => selected?.toDateString() === d.toDateString()

  // Upcoming appointments (next 5)
  const upcoming = appts
    .filter(a => new Date(a.start_timestamp) >= today)
    .sort((a, b) => new Date(a.start_timestamp).getTime() - new Date(b.start_timestamp).getTime())
    .slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {isDemo && (
        <div style={{ fontSize: 11, color: '#FBBF24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '6px 12px', display: 'inline-flex', alignSelf: 'flex-end' }}>
          Datos demo — las citas reales aparecerán cuando el agente las agende
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Calendario principal */}
        <div style={{ background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 14 }}>

          {/* Header mes */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <button onClick={() => setCurrent(new Date(year, month - 1, 1))}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#8B8A99', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F0F5' }}>
              {MONTHS[month]} {year}
            </div>
            <button onClick={() => setCurrent(new Date(year, month + 1, 1))}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#8B8A99', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>

          {/* Días de la semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
            {WEEKDAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Celdas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((date, i) => {
              if (!date) return <div key={i} />
              const dayAppts = apptsForDay(date)
              const today_ = isToday(date)
              const selected_ = isSelected(date)
              return (
                <div key={i} onClick={() => setSelected(date)}
                  style={{
                    minHeight: 56, padding: '4px 5px', borderRadius: 8, cursor: 'pointer',
                    background: selected_ ? 'rgba(124,111,224,0.15)' : today_ ? 'rgba(124,111,224,0.07)' : 'transparent',
                    border: selected_ ? '1px solid rgba(124,111,224,0.4)' : today_ ? '1px solid rgba(124,111,224,0.2)' : '1px solid transparent',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: today_ ? 700 : 400,
                    background: today_ ? '#7C6FE0' : 'transparent',
                    color: today_ ? '#fff' : date.getMonth() !== month ? '#2A2940' : '#C4C3D0',
                    marginBottom: 4,
                  }}>{date.getDate()}</div>
                  {dayAppts.slice(0, 2).map(a => {
                    const reason = a.call_reason ?? 'Pedir cita'
                    const style = COLOR_BY_REASON[reason] ?? COLOR_BY_REASON['Pedir cita']
                    return (
                      <div key={a.call_id} style={{ background: style.bg, color: style.color, borderRadius: 4, fontSize: 9, fontWeight: 600, padding: '2px 5px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fmtHour(a.start_timestamp)} {getTitle(a)}
                      </div>
                    )
                  })}
                  {dayAppts.length > 2 && <div style={{ fontSize: 9, color: '#8B8A99', paddingLeft: 4 }}>+{dayAppts.length - 2} más</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel inferior — dos columnas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* Citas del día seleccionado */}
          <div style={{ background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#F1F0F5', marginBottom: 12 }}>
              {selected ? selected.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Selecciona un día'}
            </div>
            {!selected && <div style={{ fontSize: 11, color: '#4A4960' }}>Haz clic en un día del calendario</div>}
            {selected && selectedAppts.length === 0 && (
              <div style={{ fontSize: 11, color: '#4A4960', textAlign: 'center', padding: '12px 0' }}>Sin citas este día</div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedAppts.map(a => {
                const reason = extractReason(a.transcript, a.call_reason)
                const s = COLOR_BY_REASON[reason] ?? COLOR_BY_REASON['Pedir cita']
                return <ApptCard key={a.call_id} a={a} color={s} />
              })}
            </div>
          </div>

          {/* Próximas citas */}
          <div style={{ background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#F1F0F5', marginBottom: 12 }}>Próximas citas</div>
            {upcoming.length === 0 && <div style={{ fontSize: 11, color: '#4A4960' }}>Sin citas próximas</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {upcoming.map(a => {
                const reason = extractReason(a.transcript, a.call_reason)
                const s = COLOR_BY_REASON[reason] ?? COLOR_BY_REASON['Pedir cita']
                return <ApptCard key={a.call_id} a={a} color={s} />
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
