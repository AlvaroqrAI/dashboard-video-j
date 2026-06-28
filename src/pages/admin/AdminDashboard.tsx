import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import DateRangeFilter from '@/components/ui/DateRangeFilter'
import { computeRangedMetrics, rangeLabel, type RangeState } from '@/lib/metrics'
import { supabase } from '@/lib/supabase'

interface ClientRow {
  id: string
  email: string | null
  full_name: string | null
}

const SvgIcons: Record<string, React.ReactElement> = {
  workshop: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  phone: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6.6 10.8a15.05 15.05 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.56.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.56 3.57a1 1 0 0 1-.25 1.02L6.6 10.8z"/></svg>,
  euro: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8C15.5 6 13.5 5 11 5c-4 0-7 3-7 7s3 7 7 7c2.5 0 4.5-1 6-3"/><path d="M3 12h9M3 9h7"/></svg>,
  trend: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
}

function KpiCard({ label, value, color, badge, sub, iconKey }: {
  label: string; value: string | number; color: string
  badge: { text: string; bg: string; color: string }
  sub: string; iconKey: string
}) {
  return (
    <div style={{ background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${color}44, transparent)` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ color, opacity: 0.8 }}>{SvgIcons[iconKey]}</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#8B8A99', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: value.toString().length > 6 ? 22 : 28, fontWeight: 800, color, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 8 }}>{value}</div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: badge.bg, color: badge.color, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, border: `1px solid ${badge.color}33` }}>{badge.text}</div>
      <div style={{ fontSize: 10, color: '#4A4960', marginTop: 6, lineHeight: 1.4 }}>{sub}</div>
    </div>
  )
}

const S = {
  card: { background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 24 } as React.CSSProperties,
  label: { fontSize: 10, fontWeight: 600, color: '#4A4960', textTransform: 'uppercase' as const, letterSpacing: '0.12em', marginBottom: 10 },
}

export default function AdminDashboard() {
  const [range, setRange] = useState<RangeState>({ preset: 'week' })
  const metrics = useMemo(() => computeRangedMetrics(range), [range])
  const label = rangeLabel(range)
  const navigate = useNavigate()

  const [clients, setClients] = useState<ClientRow[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [activeTallers, setActiveTallers] = useState(0)
  const [totalAppointments, setTotalAppointments] = useState(0)
  const TICKET_AVG = 200 // € por cita estimada

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'client')
      .then(({ data }) => setClients((data ?? []) as ClientRow[]))

    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'client')
      .eq('payment_method_added', true)
      .then(({ count }) => setActiveTallers(count ?? 0))

    supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .eq('is_appointment', true)
      .then(({ count }) => setTotalAppointments(count ?? 0))
  }, [])

  // Llamadas reales ya disponibles en metrics (misma fuente que el gráfico)
  const realCalls = metrics.totalCalls
  const mensual = totalAppointments * TICKET_AVG
  const anual = mensual * 12

  const kpis = [
    {
      label: 'Talleres activos', value: activeTallers, color: '#9B8FEF', iconKey: 'workshop',
      badge: { text: `${clients.length} registrados`, bg: 'rgba(155,143,239,0.12)', color: '#9B8FEF' },
      sub: 'talleres con agente activo',
    },
    {
      label: 'Llamadas gestionadas', value: realCalls.toLocaleString('es-ES'), color: '#7C6FE0', iconKey: 'phone',
      badge: { text: `${totalAppointments} citas`, bg: 'rgba(124,111,224,0.12)', color: '#7C6FE0' },
      sub: 'total acumulado de todos los talleres',
    },
    {
      label: 'Facturación pot. mensual', value: `${mensual.toLocaleString('es-ES')} €`, color: '#34D399', iconKey: 'euro',
      badge: { text: `${totalAppointments} citas × ${TICKET_AVG} €`, bg: 'rgba(52,211,153,0.12)', color: '#34D399' },
      sub: 'estimado por citas agendadas',
    },
    {
      label: 'Facturación pot. anual', value: `${anual.toLocaleString('es-ES')} €`, color: '#34D399', iconKey: 'trend',
      badge: { text: 'proyección × 12', bg: 'rgba(52,211,153,0.12)', color: '#34D399' },
      sub: 'basado en el ritmo actual de citas',
    },
  ]

  const tooltipStyle = {
    backgroundColor: '#1E1F2B',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    color: '#F1F0F5',
    fontSize: 12,
  }

  const selectedName = selectedClient === 'all'
    ? null
    : clients.find(c => c.id === selectedClient)?.full_name ?? clients.find(c => c.id === selectedClient)?.email ?? 'Taller'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <span style={{ width: 14, height: 2, background: '#7C6FE0', borderRadius: 1, display: 'inline-block' }} />
            Panel de administración
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#F1F0F5', letterSpacing: '-0.02em', margin: 0 }}>Métricas globales</h1>
          <p style={{ fontSize: 12, color: '#8B8A99', marginTop: 4 }}>Actividad agregada de todos los clientes y agentes</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
          {/* Selector de taller */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#4A4960', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Taller</span>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedClient}
                onChange={e => setSelectedClient(e.target.value)}
                style={{
                  background: '#181922', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                  color: '#F1F0F5', fontSize: 12, fontWeight: 500, padding: '7px 32px 7px 12px',
                  fontFamily: 'inherit', cursor: 'pointer', outline: 'none', appearance: 'none',
                  minWidth: 180,
                }}
              >
                <option value="all">Todos los talleres</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.full_name ?? c.email}</option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#8B8A99', fontSize: 10, pointerEvents: 'none' }}>▼</span>
            </div>
            {selectedClient !== 'all' && (
              <button
                onClick={() => navigate('/')}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.08)', color: '#34D399', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Ver panel →
              </button>
            )}
          </div>
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
      </div>

      {/* Banner taller seleccionado */}
      {selectedName && (
        <div style={{ background: 'rgba(124,111,224,0.08)', border: '1px solid rgba(124,111,224,0.2)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14 }}>🔧</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#C4BCFF' }}>{selectedName}</span>
          <span style={{ fontSize: 11, color: '#8B8A99' }}>— mostrando métricas de este taller</span>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Chart */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={S.label}>Volumen de llamadas · {label}</div>
          <span style={{ fontSize: 11, color: '#8B8A99' }}>
            {metrics.totalCalls.toLocaleString('es-ES')} llamadas · {metrics.totalCost} €
          </span>
        </div>
        <div style={{ height: 220 }}>
          {metrics.points.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A4960', fontSize: 12 }}>
              Sin datos en el rango seleccionado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.points}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C6FE0" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7C6FE0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" stroke="#4A4960" fontSize={10} tickLine={false} />
                <YAxis stroke="#4A4960" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="calls" stroke="#7C6FE0" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
