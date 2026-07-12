import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface Appointment {
  id: string
  client_name: string | null
  client_phone: string | null
  car_model: string | null
  plate: string | null
  reason: string | null
  appointment_date: string
  appointment_time: string
  status: string
}

// Demo appointments when no real data
function demoDate(offsetDays: number) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().split('T')[0]
}
const DEMO_APPTS: Appointment[] = [
  { id: 'a1', client_name: 'Carlos Ruiz', client_phone: '612 345 678', car_model: 'Ford Focus', plate: '4521KLM', reason: 'Revisión anual', appointment_date: demoDate(1), appointment_time: '09:00', status: 'confirmed' },
  { id: 'a2', client_name: 'María López', client_phone: '698 765 432', car_model: 'Seat León', plate: '7834JWX', reason: 'Cambio de frenos', appointment_date: demoDate(2), appointment_time: '10:00', status: 'confirmed' },
  { id: 'a3', client_name: 'Juan García', client_phone: '655 111 222', car_model: 'Renault Clio', plate: '1290MNP', reason: 'Revisión pre-ITV', appointment_date: demoDate(3), appointment_time: '08:00', status: 'confirmed' },
  { id: 'a4', client_name: 'Ana Torres', client_phone: '677 333 444', car_model: 'BMW Serie 3', plate: '5567LRT', reason: 'Diagnóstico avería', appointment_date: demoDate(5), appointment_time: '12:00', status: 'confirmed' },
]

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function fmtHour(t: string) {
  return t.slice(0, 5)
}

const CARD_COLOR = { bg: 'rgba(124,111,224,0.25)', color: '#C4BCFF' }

function ApptCard({ a }: { a: Appointment }) {
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setExpanded(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} onClick={() => setExpanded(v => !v)}
      style={{ background: CARD_COLOR.bg, border: `1px solid ${CARD_COLOR.color}33`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'all 0.15s' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: CARD_COLOR.color, marginBottom: 3 }}>{fmtHour(a.appointment_time)}</div>
      <div style={{ fontSize: 12, color: '#F1F0F5', fontWeight: 600 }}>{a.client_name || 'Cliente'}</div>
      <div style={{ fontSize: 10, color: '#8B8A99', marginTop: 2 }}>{a.reason || 'Cita agendada'}</div>
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${CARD_COLOR.color}33` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            <div>
              <div style={{ fontSize: 9, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Cliente</div>
              <div style={{ fontSize: 11, color: '#F1F0F5', fontWeight: 600 }}>{a.client_name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Teléfono</div>
              <div style={{ fontSize: 11, color: '#F1F0F5', fontWeight: 600 }}>{a.client_phone || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Motivo</div>
              <div style={{ fontSize: 11, color: '#F1F0F5', fontWeight: 600 }}>{a.reason || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Vehículo</div>
              <div style={{ fontSize: 11, color: '#F1F0F5', fontWeight: 600 }}>{a.car_model || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Matrícula</div>
              <div style={{ fontSize: 11, color: '#F1F0F5', fontWeight: 600 }}>{a.plate || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Estado</div>
              <div style={{ fontSize: 11, color: '#6EE7B7', fontWeight: 600 }}>{a.status === 'confirmed' ? 'Confirmada' : a.status}</div>
            </div>
          </div>
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
      .from('appointments')
      .select('id,client_name,client_phone,car_model,plate,reason,appointment_date,appointment_time,status')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .order('appointment_date', { ascending: true })
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

  function dateKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  function apptsForDay(date: Date) {
    const key = dateKey(date)
    return appts.filter(a => a.appointment_date === key)
      .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
  }

  const selectedAppts = selected ? apptsForDay(selected) : []

  const isToday = (d: Date) => d.toDateString() === today.toDateString()
  const isSelected = (d: Date) => selected?.toDateString() === d.toDateString()

  // Upcoming appointments (next 5)
  const todayKey = dateKey(today)
  const upcoming = appts
    .filter(a => a.appointment_date >= todayKey)
    .sort((a, b) => (a.appointment_date + a.appointment_time).localeCompare(b.appointment_date + b.appointment_time))
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
                  {dayAppts.slice(0, 2).map(a => (
                    <div key={a.id} style={{ background: CARD_COLOR.bg, color: CARD_COLOR.color, borderRadius: 4, fontSize: 9, fontWeight: 600, padding: '2px 5px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fmtHour(a.appointment_time)} {a.client_name || 'Cliente'} · {a.reason || 'Cita'}
                    </div>
                  ))}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedAppts.map(a => <ApptCard key={a.id} a={a} />)}
            </div>
          </div>

          {/* Próximas citas */}
          <div style={{ background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#F1F0F5', marginBottom: 12 }}>Próximas citas</div>
            {upcoming.length === 0 && <div style={{ fontSize: 11, color: '#4A4960' }}>Sin citas próximas</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcoming.map(a => <ApptCard key={a.id} a={a} />)}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
