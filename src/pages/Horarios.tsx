import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { PageHeader, Card } from '@/components/ui/Card'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface CallRow { start_timestamp: string | null; duration_ms: number | null; call_successful: boolean | null }

const DAYS = 30

function fmtDurationShort(ms: number) {
  const totalSec = Math.round(ms / 1000)
  return `${Math.floor(totalSec / 60)}m ${totalSec % 60}s`
}

// Fuera de horario laboral real: L-V 07:00–15:00 (hora de Madrid), fin de semana = fuera.
// Misma regla que usa Inicio — no la del sombreado del gráfico, que es solo visual (8h–20h).
function isOutOfHours(ts: string): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', hour12: false,
  }).formatToParts(new Date(ts))
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? ''
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
  if (weekday === 'Sat' || weekday === 'Sun') return true
  return hour < 7 || hour >= 15
}

const tooltipStyle = { backgroundColor: '#1E1F2B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#F1F0F5', fontSize: 12 }

export default function Horarios() {
  const { user } = useAuth()
  const [calls, setCalls] = useState<CallRow[]>([])
  const [citasCreadas, setCitasCreadas] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const from = new Date(Date.now() - DAYS * 86400000).toISOString()
    supabase.from('call_logs').select('start_timestamp, duration_ms, call_successful')
      .eq('user_id', user.id).gte('start_timestamp', from)
      .then(({ data }) => { setCalls((data ?? []) as CallRow[]); setLoading(false) })

    supabase.from('appointments').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).neq('status', 'cancelled').gte('created_at', from)
      .then(({ count }) => setCitasCreadas(count ?? 0))
  }, [user])

  const total = calls.length
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
  calls.forEach(c => {
    if (!c.start_timestamp) return
    hourly[new Date(c.start_timestamp).getHours()].count++
  })
  const chartData = hourly.map(h => ({ label: `${h.hour}h`, count: h.count, dimmed: h.hour < 8 || h.hour >= 20 }))
  const peak = hourly.reduce((best, h) => (h.count > best.count ? h : best), hourly[0])

  const withDuration = calls.filter(c => c.duration_ms != null)
  const avgMs = withDuration.length > 0 ? withDuration.reduce((s, c) => s + (c.duration_ms || 0), 0) / withDuration.length : 0
  const withResult = calls.filter(c => c.call_successful != null)
  const resolutionPct = withResult.length > 0 ? Math.round((withResult.filter(c => c.call_successful).length / withResult.length) * 100) : null
  const fueraHorario = calls.filter(c => c.start_timestamp && isOutOfHours(c.start_timestamp)).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader title="Horarios" subtitle="Cuándo llaman tus clientes y cómo responde el agente." />

      <div style={{ fontSize: 10, fontWeight: 600, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 14, height: 2, background: '#7C6FE0', borderRadius: 1, display: 'inline-block' }} />
        Análisis de horarios
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <SkeletonCard height={260} />
          <SkeletonCard height={260} />
        </div>
      ) : total === 0 ? (
        <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 12, color: '#4A4960' }}>Todavía no hay llamadas en los últimos {DAYS} días para analizar.</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F0F5' }}>Volumen por hora del día</div>
            <div style={{ fontSize: 11, color: '#4A4960', marginTop: 2, marginBottom: 16 }}>Tono atenuado = fuera de horario laboral (antes de 8h / después de 20h)</div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" stroke="#4A4960" fontSize={9} tickLine={false} axisLine={false} interval={1} />
                  <YAxis stroke="#4A4960" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.dimmed ? 'rgba(124,111,224,0.35)' : '#7C6FE0'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F0F5' }}>Métricas de horario</div>
            <div style={{ fontSize: 11, color: '#4A4960', marginTop: 2, marginBottom: 16 }}>Resumen del periodo</div>
            {[
              { label: 'Hora pico', value: `${peak.hour}:00h` },
              { label: 'Fuera de horario', value: `${fueraHorario} llamadas` },
              { label: 'Duración media', value: avgMs > 0 ? fmtDurationShort(avgMs) : '—' },
              { label: 'Tasa de resolución', value: resolutionPct != null ? `${resolutionPct}%` : '—', color: resolutionPct != null ? '#34D399' : undefined },
              { label: 'Citas creadas', value: String(citasCreadas) },
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 12, color: '#8B8A99' }}>{m.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: m.color || '#F1F0F5' }}>{m.value}</span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}
