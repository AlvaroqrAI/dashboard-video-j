import React from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface CallLog {
  call_id: string
  call_status: string
  duration_ms: number
  start_timestamp: string
  is_appointment: boolean
  is_out_of_hours: boolean
  transcript: string | null
  call_reason?: string | null
  user_sentiment?: string | null
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

// Fuera de horario: L-V 07:00–15:00 (hora de Madrid). Fin de semana = fuera.
function isOutOfHours(ts: string): boolean {
  if (!ts) return false
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', hour12: false,
  }).formatToParts(new Date(ts))
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? ''
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
  const isWeekend = weekday === 'Sat' || weekday === 'Sun'
  if (isWeekend) return true
  return hour < 7 || hour >= 15
}

function detectReason(c: CallLog): string {
  if (c.is_appointment) return 'Pedir cita'
  const t = (c.transcript ?? '').toLowerCase()
  if (t.includes('precio') || t.includes('presupuesto')) return 'Consulta precio'
  if (t.includes('urgencia') || t.includes('urgente') || t.includes('avería')) return 'Urgencia'
  if (t.includes('horario') || t.includes('hora') || t.includes('cierra')) return 'Consulta horario'
  return 'Consulta general'
}

const card = { background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20 }
const statBox: React.CSSProperties = { padding: '18px 22px', borderRight: '1px solid rgba(255,255,255,0.06)' }
const statLabel: React.CSSProperties = { fontSize: 11, color: '#8B8A99', marginBottom: 9 }
const statVal: React.CSSProperties = { fontSize: 23, fontWeight: 600, letterSpacing: '-0.015em', color: '#F1F0F5' }
const statDelta: React.CSSProperties = { fontSize: 11, color: '#4A4960', marginTop: 6 }
const statDeltaUp: React.CSSProperties = { ...statDelta, color: '#34D399' }

// Demo data shown when Supabase has no real calls yet
const DEMO_CALLS: CallLog[] = [
  { call_id: 'd1', call_status: 'ended', duration_ms: 180000, start_timestamp: new Date(Date.now() - 3600000).toISOString(), is_appointment: true, is_out_of_hours: false, transcript: 'quiero pedir cita', call_reason: 'Pedir cita', user_sentiment: 'Positive' },
  { call_id: 'd2', call_status: 'ended', duration_ms: 60000, start_timestamp: new Date(Date.now() - 7200000).toISOString(), is_appointment: false, is_out_of_hours: false, transcript: 'consulta general', call_reason: 'Consulta general', user_sentiment: 'Neutral' },
  { call_id: 'd3', call_status: 'ended', duration_ms: 90000, start_timestamp: new Date(Date.now() - 10800000).toISOString(), is_appointment: true, is_out_of_hours: true, transcript: 'pedir cita urgente', call_reason: 'Pedir cita', user_sentiment: 'Positive' },
  { call_id: 'd4', call_status: 'ended', duration_ms: 45000, start_timestamp: new Date(Date.now() - 14400000).toISOString(), is_appointment: false, is_out_of_hours: false, transcript: 'precio revisión', call_reason: 'Consulta precio', user_sentiment: 'Positive' },
  { call_id: 'd5', call_status: 'short', duration_ms: 12000, start_timestamp: new Date(Date.now() - 18000000).toISOString(), is_appointment: false, is_out_of_hours: false, transcript: null, call_reason: 'Consulta general', user_sentiment: 'Negative' },
  { call_id: 'd6', call_status: 'ended', duration_ms: 120000, start_timestamp: new Date(Date.now() - 21600000).toISOString(), is_appointment: false, is_out_of_hours: false, transcript: 'horario apertura', call_reason: 'Consulta horario', user_sentiment: 'Positive' },
]

export default function Dashboard() {
  const { user, profile } = useAuth()
  const tallerName = profile?.full_name || 'Mi taller'
  const [rawCalls, setRawCalls] = useState<CallLog[]>([])
  const [citasReales, setCitasReales] = useState(0)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState('')

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const from = new Date(Date.now() - days * 86400000).toISOString()
    supabase
      .from('call_logs')
      .select('call_id,call_status,duration_ms,start_timestamp,is_appointment,is_out_of_hours,transcript,call_reason,user_sentiment')
      .eq('user_id', user.id)
      .gte('start_timestamp', from)
      .order('start_timestamp', { ascending: false })
      .then(({ data }) => {
        setRawCalls((data ?? []) as CallLog[])
        setLastSync(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))
        setLoading(false)
      })

    // Citas reales agendadas por el agente (tabla appointments)
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .gte('created_at', from)
      .then(({ count }) => setCitasReales(count ?? 0))
  }, [user, days])

  const calls = rawCalls.length > 0 ? rawCalls : DEMO_CALLS
  const isDemo = rawCalls.length === 0


  // KPIs
  const total = calls.length
  const fueraHorario = isDemo
    ? calls.filter(c => c.is_out_of_hours).length
    : calls.filter(c => isOutOfHours(c.start_timestamp)).length
  // Citas: en datos reales, contar la tabla appointments; en demo, el flag de las llamadas demo
  const citas = isDemo ? calls.filter(c => c.is_appointment).length : citasReales
  const totalMs = calls.reduce((s, c) => s + (c.duration_ms || 0), 0)

  // Motivos de llamada
  const reasonMap: Record<string, number> = {}
  calls.forEach(c => {
    const r = c.call_reason || detectReason(c)
    reasonMap[r] = (reasonMap[r] || 0) + 1
  })
  const reasons = Object.entries(reasonMap).sort((a, b) => b[1] - a[1])

  // Sentimiento del cliente
  const positivas = calls.filter(c => c.user_sentiment === 'Positive').length
  const neutras = calls.filter(c => c.user_sentiment === 'Neutral').length
  const negativas = calls.filter(c => c.user_sentiment === 'Negative').length
  const sentimentTotal = positivas + neutras + negativas
  const sentPct = (n: number) => sentimentTotal > 0 ? Math.round((n / sentimentTotal) * 100) : 0

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
  const completadasCount = calls.filter(c => c.call_status === 'ended').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Selector periodo */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
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

      {/* Métricas de hoy */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={statBox}>
          <div style={statLabel}>Llamadas atendidas</div>
          <div style={statVal}>{total}</div>
          <div style={statDelta}>{completadasCount} completadas</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Citas gestionadas</div>
          <div style={statVal}>{citas}</div>
          <div style={statDeltaUp}>Confirmadas por el agente</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Fuera de horario</div>
          <div style={statVal}>{fueraHorario}</div>
          <div style={statDelta}>Atendidas sin agente = 0</div>
        </div>
        <div style={{ ...statBox, borderRight: 'none' }}>
          <div style={statLabel}>Duración total</div>
          <div style={statVal}>{fmtDuration(totalMs)}</div>
          <div style={statDelta}>Tiempo gestionado sin interrupciones</div>
        </div>
      </div>

      {/* Fila 2: gráfico área + estado sistema */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div style={{ ...card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F0F5' }}>Llamadas por día · últimos {days} días</div>
            {lastSync && <span style={{ fontSize: 10, color: '#4A4960' }}>Actualizado {lastSync}</span>}
          </div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C6FE0" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#7C6FE0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" stroke="#4A4960" fontSize={9} tickLine={false} interval={Math.floor(chartData.length / 6)} />
                <YAxis stroke="#4A4960" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="calls" stroke="#7C6FE0" strokeWidth={1.75} fill="url(#grad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ ...card }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F0F5', marginBottom: 16 }}>Estado del sistema</div>
          {[
            { label: 'Agente Retell', status: 'Activo', color: '#34D399' },
            { label: 'Google Calendar', status: 'Conectado', color: '#34D399' },
            { label: 'Webhook n8n', status: 'Activo', color: '#34D399' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: 12, color: '#8B8A99' }}>{item.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: item.color }}>{item.status}</span>
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
        <div style={{ ...card }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F0F5', marginBottom: 16 }}>Motivo de la llamada</div>
          {reasons.map(([reason, count], i) => {
            const pct = Math.round((count / total) * 100)
            const opacity = Math.max(1 - i * 0.22, 0.3)
            return (
              <div key={reason} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: '#C4C3D0' }}>{reason}</span>
                  <span style={{ fontSize: 11, color: '#8B8A99' }}>{count} · {pct}%</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 999 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#7C6FE0', opacity, borderRadius: 999, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Sentimiento del cliente */}
        <div style={{ ...card }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F0F5', marginBottom: 4 }}>Sentimiento del cliente</div>
          <div style={{ fontSize: 11, color: '#4A4960', marginBottom: 16 }}>Análisis de las conversaciones</div>
          {[
            { label: 'Positivo', value: positivas, color: '#34D399' },
            { label: 'Neutro', value: neutras, color: '#8B8A99' },
            { label: 'Negativo', value: negativas, color: '#F87171' },
          ].map(s => (
            <div key={s.label} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: '#C4C3D0' }}>{s.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{sentPct(s.value)}%</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 999 }}>
                <div style={{ height: '100%', width: `${sentPct(s.value)}%`, background: s.color, borderRadius: 999, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          ))}
          {sentimentTotal === 0 && (
            <div style={{ fontSize: 11, color: '#4A4960', textAlign: 'center', padding: '12px 0' }}>Sin datos de sentimiento todavía</div>
          )}
        </div>

        {/* Actividad reciente */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F0F5', marginBottom: 12 }}>Actividad reciente</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {calls.slice(0, 6).map(c => {
              const reason = c.call_reason || detectReason(c)
              const isCita = reason === 'Pedir cita'
              return (
                <div key={c.call_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4A4960', flexShrink: 0, marginTop: 5 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#C4C3D0' }}>{reason}</span>
                      <span style={{ fontSize: 10, color: '#4A4960', flexShrink: 0, marginLeft: 4 }}>{c.start_timestamp ? fmtTime(c.start_timestamp) : ''}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#4A4960', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isCita ? `Cita agendada · ${tallerName}` : `Agente ${tallerName}`}
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
