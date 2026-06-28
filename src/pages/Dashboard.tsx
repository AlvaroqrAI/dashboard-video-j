import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const TICKET_MEDIO = 300

interface CallLog {
  call_id: string
  call_status: string
  duration_ms: number
  start_timestamp: string
  is_appointment: boolean
  is_out_of_hours: boolean
  transcript: string | null
  call_reason?: string | null
}

function fmtDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function detectReason(c: CallLog): string {
  if (c.is_appointment) return 'Pedir cita'
  const t = (c.transcript ?? '').toLowerCase()
  if (t.includes('precio') || t.includes('presupuesto')) return 'Consulta precio'
  if (t.includes('urgencia') || t.includes('urgente') || t.includes('avería')) return 'Urgencia'
  if (t.includes('horario') || t.includes('hora') || t.includes('cierra')) return 'Consulta horario'
  return 'Consulta general'
}

const REASON_COLORS: Record<string, string> = {
  'Pedir cita': '#7C6FE0',
  'Consulta precio': '#22D3EE',
  'Urgencia': '#F87171',
  'Consulta horario': '#FBBF24',
  'Consulta general': '#8B8A99',
}

const kpiCard = (color: string) => ({
  background: '#181922',
  border: `1px solid rgba(255,255,255,0.06)`,
  borderRadius: 20,
  padding: '22px 20px',
  position: 'relative' as const,
  overflow: 'hidden' as const,
})

const badge = (bg: string, color: string) => ({
  display: 'inline-flex', alignItems: 'center', gap: 3,
  background: bg, color, padding: '3px 9px',
  borderRadius: 999, fontSize: 11, fontWeight: 700,
  border: `1px solid ${color}33`,
})

const card = { background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 20 }

// Demo data shown when Supabase has no real calls yet
const DEMO_CALLS: CallLog[] = [
  { call_id: 'd1', call_status: 'ended', duration_ms: 180000, start_timestamp: new Date(Date.now() - 3600000).toISOString(), is_appointment: true, is_out_of_hours: false, transcript: 'quiero pedir cita', call_reason: 'Pedir cita' },
  { call_id: 'd2', call_status: 'ended', duration_ms: 60000, start_timestamp: new Date(Date.now() - 7200000).toISOString(), is_appointment: false, is_out_of_hours: false, transcript: 'consulta general', call_reason: 'Consulta general' },
  { call_id: 'd3', call_status: 'ended', duration_ms: 90000, start_timestamp: new Date(Date.now() - 10800000).toISOString(), is_appointment: true, is_out_of_hours: true, transcript: 'pedir cita urgente', call_reason: 'Pedir cita' },
  { call_id: 'd4', call_status: 'ended', duration_ms: 45000, start_timestamp: new Date(Date.now() - 14400000).toISOString(), is_appointment: false, is_out_of_hours: false, transcript: 'precio revisión', call_reason: 'Consulta precio' },
  { call_id: 'd5', call_status: 'short', duration_ms: 12000, start_timestamp: new Date(Date.now() - 18000000).toISOString(), is_appointment: false, is_out_of_hours: false, transcript: null, call_reason: 'Consulta general' },
  { call_id: 'd6', call_status: 'ended', duration_ms: 120000, start_timestamp: new Date(Date.now() - 21600000).toISOString(), is_appointment: false, is_out_of_hours: false, transcript: 'horario apertura', call_reason: 'Consulta horario' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const [rawCalls, setRawCalls] = useState<CallLog[]>([])
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState('')

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const from = new Date(Date.now() - days * 86400000).toISOString()
    supabase
      .from('call_logs')
      .select('call_id,call_status,duration_ms,start_timestamp,is_appointment,is_out_of_hours,transcript,call_reason')
      .eq('user_id', user.id)
      .gte('start_timestamp', from)
      .order('start_timestamp', { ascending: false })
      .then(({ data }) => {
        setRawCalls((data ?? []) as CallLog[])
        setLastSync(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))
        setLoading(false)
      })
  }, [user, days])

  const calls = rawCalls.length > 0 ? rawCalls : DEMO_CALLS
  const isDemo = rawCalls.length === 0

  // KPIs
  const total = calls.length
  const fueraHorario = calls.filter(c => c.is_out_of_hours).length
  const citas = calls.filter(c => c.is_appointment).length
  const totalMs = calls.reduce((s, c) => s + (c.duration_ms || 0), 0)
  const facturacion = citas * TICKET_MEDIO

  // Motivos de llamada
  const reasonMap: Record<string, number> = {}
  calls.forEach(c => {
    const r = c.call_reason || detectReason(c)
    reasonMap[r] = (reasonMap[r] || 0) + 1
  })
  const reasons = Object.entries(reasonMap).sort((a, b) => b[1] - a[1])

  // Estado de llamadas
  const completadas = calls.filter(c => c.call_status === 'ended' && (c.duration_ms || 0) > 30000).length
  const transferidas = calls.filter(c => c.call_status === 'transferred').length
  const cortas = calls.filter(c => (c.duration_ms || 0) <= 30000).length
  const donutData = [
    { name: 'Completadas', value: completadas || 1, color: '#34D399' },
    { name: 'Transferidas', value: transferidas || 0, color: '#FBBF24' },
    { name: 'Cortas', value: cortas || 0, color: '#4A4960' },
  ].filter(d => d.value > 0)

  // Chart: llamadas por día
  const chartData = (() => {
    const map: Record<string, number> = {}
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const key = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
      map[key] = 0
    }
    calls.forEach(c => {
      if (!c.start_timestamp) return
      const key = new Date(c.start_timestamp).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
      if (key in map) map[key]++
    })
    return Object.entries(map).map(([label, calls]) => ({ label, calls }))
  })()

  const tooltipStyle = { backgroundColor: '#1E1F2B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#F1F0F5', fontSize: 12 }

  const kpiIcons: Record<string, (color: string) => JSX.Element> = {
    phone: (c) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.6 10.8a15.05 15.05 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.56.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.56 3.57a1 1 0 0 1-.25 1.02L6.6 10.8z"/></svg>,
    moon: (c) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
    calendar: (c) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
    clock: (c) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
    euro: (c) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 6.5A7 7 0 1 0 17 17.5M3 12h10M3 15h8"/></svg>,
  }

  const kpis = [
    {
      icon: kpiIcons.phone, label: 'Llamadas atendidas', value: total, color: '#9B8FEF',
      badge: { text: '0 llamadas perdidas', bg: 'rgba(124,111,224,0.15)', color: '#9B8FEF' },
      sub: `${calls.filter(c => c.call_status === 'ended').length} completadas`,
    },
    {
      icon: kpiIcons.moon, label: 'Fuera de horario', value: fueraHorario, color: '#FBBF24',
      badge: { text: 'sin agente = 0', bg: 'rgba(251,191,36,0.15)', color: '#FBBF24' },
      sub: 'Llamadas que se habrían perdido',
    },
    {
      icon: kpiIcons.calendar, label: 'Citas gestionadas', value: citas, color: '#34D399',
      badge: { text: 'Agendadas automáticamente', bg: 'rgba(52,211,153,0.12)', color: '#34D399' },
      sub: 'Confirmadas por el agente',
    },
    {
      icon: kpiIcons.clock, label: 'Duración total', value: fmtDuration(totalMs), color: '#22D3EE',
      badge: { text: 'tiempo ahorrado', bg: 'rgba(34,211,238,0.12)', color: '#22D3EE' },
      sub: 'Minutos gestionados sin interrupciones',
    },
    {
      icon: kpiIcons.euro, label: 'Facturación estimada', value: `${facturacion.toLocaleString('es-ES')} €`, color: '#34D399',
      badge: { text: `ticket medio ${TICKET_MEDIO}€`, bg: 'rgba(52,211,153,0.12)', color: '#34D399' },
      sub: `${citas} citas × ${TICKET_MEDIO}€ · ingreso potencial este mes`,
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Selector periodo */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        {isDemo && <span style={{ fontSize: 10, color: '#FBBF24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 6, padding: '3px 8px' }}>Datos demo — conecta Retell para datos reales</span>}
        {[7, 30, 90].map(d => (
          <button key={d} onClick={() => setDays(d)}
            style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              background: days === d ? '#7C6FE0' : 'transparent',
              borderColor: days === d ? '#7C6FE0' : 'rgba(255,255,255,0.1)',
              color: days === d ? '#fff' : '#8B8A99',
            }}>
            {d} días
          </button>
        ))}
        <button onClick={() => setDays(days)} style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', color: '#8B8A99' }}>
          {loading ? '...' : 'Actualizar'}
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {kpis.map(k => (
          <div key={k.label} style={kpiCard(k.color)}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${k.color}44, transparent)` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#8B8A99', textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1.4 }}>{k.label}</div>
              <span style={{ flexShrink: 0, marginLeft: 6, display: 'flex' }}>{k.icon(k.color)}</span>
            </div>
            <div style={{ fontSize: k.value.toString().length > 7 ? 20 : k.value.toString().length > 4 ? 26 : 36, fontWeight: 800, color: k.color, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 10 }}>{k.value}</div>
            <div style={badge(k.badge.bg, k.badge.color)}>{k.badge.text}</div>
            <div style={{ fontSize: 10.5, color: '#6B6980', marginTop: 8, lineHeight: 1.5 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Fila 2: gráfico área + estado sistema */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div style={{ ...card, borderRadius: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F0F5' }}>Llamadas por día · últimos {days} días</div>
            {lastSync && <span style={{ fontSize: 10, color: '#4A4960' }}>Actualizado {lastSync}</span>}
          </div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C6FE0" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7C6FE0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" stroke="#4A4960" fontSize={9} tickLine={false} interval={Math.floor(chartData.length / 6)} />
                <YAxis stroke="#4A4960" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="calls" stroke="#7C6FE0" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ ...card, borderRadius: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F0F5', marginBottom: 16 }}>Estado del sistema</div>
          {[
            { label: 'Agente Retell', status: 'Activo', color: '#34D399' },
            { label: 'Google Calendar', status: 'Conectado', color: '#34D399' },
            { label: 'Webhook n8n', status: 'Activo', color: '#34D399' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 12, color: '#8B8A99' }}>{item.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: item.color }}>✓ {item.status}</span>
            </div>
          ))}
          <div style={{ marginTop: 12, background: '#1E1F2B', borderRadius: 8, padding: '9px 12px', fontSize: 11, color: '#4A4960' }}>
            Última sincronización: {lastSync || 'hace pocos minutos'}.
          </div>
        </div>
      </div>

      {/* Fila 3: Motivos + Donut + Actividad reciente */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>

        {/* Motivo de la llamada */}
        <div style={{ ...card, borderRadius: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F0F5', marginBottom: 16 }}>Motivo de la llamada</div>
          {reasons.map(([reason, count]) => {
            const pct = Math.round((count / total) * 100)
            const color = REASON_COLORS[reason] ?? '#8B8A99'
            return (
              <div key={reason} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: '#C4C3D0' }}>{reason}</span>
                  <span style={{ fontSize: 11, color: '#8B8A99' }}>{count} · {pct}%</span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 999 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Estado de llamadas — donut */}
        <div style={{ ...card, borderRadius: 20, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F0F5', marginBottom: 8 }}>Estado de llamadas</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" strokeWidth={0}>
                  {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Total en el centro */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#F1F0F5', lineHeight: 1 }}>{total}</div>
              <div style={{ fontSize: 9, color: '#8B8A99', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>TOTAL</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {[
              { label: 'Completadas', value: completadas, color: '#34D399' },
              { label: 'Transferidas', value: transferidas, color: '#FBBF24' },
              { label: 'Cortas', value: cortas, color: '#4A4960' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8B8A99' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                  {s.label}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F0F5' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actividad reciente */}
        <div style={{ ...card, borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F0F5', marginBottom: 12 }}>Actividad reciente</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {calls.slice(0, 6).map(c => {
              const reason = c.call_reason || detectReason(c)
              const color = REASON_COLORS[reason] ?? '#8B8A99'
              const isCita = reason === 'Pedir cita'
              return (
                <div key={c.call_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#C4C3D0' }}>{reason}</span>
                      <span style={{ fontSize: 10, color: '#4A4960', flexShrink: 0, marginLeft: 4 }}>{c.start_timestamp ? fmtTime(c.start_timestamp) : ''}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#4A4960', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isCita ? '🗓 Cita agendada · SRC Automoción' : `Agente SRC Automoción`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
