import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import DateRangeFilter from '@/components/ui/DateRangeFilter'
import { computeRangedMetrics, rangeLabel, type RangeState } from '@/lib/metrics'
import { demoClients } from '@/lib/demo'
import { supabase } from '@/lib/supabase'

interface ClientRow {
  id: string
  email: string | null
  full_name: string | null
}

function KpiCard({ label, value, color, badge, sub, icon }: {
  label: string; value: string | number; color: string
  badge: { text: string; bg: string; color: string }
  sub: string; icon: string
}) {
  return (
    <div style={{ background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${color}44, transparent)` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
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

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'client')
      .then(({ data }) => setClients((data ?? []) as ClientRow[]))
  }, [])

  const totalClients = demoClients.length
  const activeClients = demoClients.filter((c) => c.status === 'active').length
  const mrr = demoClients.reduce((s, c) => s + c.mrr, 0)
  const paying = demoClients.filter((c) => c.mrr > 0).length

  const kpis = [
    { label: 'Clientes totales', value: totalClients, color: '#9B8FEF', icon: '🏢', badge: { text: `${activeClients} activos`, bg: 'rgba(155,143,239,0.12)', color: '#9B8FEF' }, sub: 'talleres registrados en la plataforma' },
    { label: 'Clientes activos', value: activeClients, color: '#34D399', icon: '✅', badge: { text: `${Math.round(activeClients / totalClients * 100)}% del total`, bg: 'rgba(52,211,153,0.12)', color: '#34D399' }, sub: 'con agente en funcionamiento' },
    { label: `Llamadas · ${label}`, value: metrics.totalCalls.toLocaleString('es-ES'), color: '#9B8FEF', icon: '📞', badge: { text: 'en el periodo', bg: 'rgba(155,143,239,0.12)', color: '#9B8FEF' }, sub: 'gestionadas por todos los agentes' },
    { label: 'MRR', value: `${mrr} €`, color: '#34D399', icon: '💰', badge: { text: 'ingresos recurrentes', bg: 'rgba(52,211,153,0.12)', color: '#34D399' }, sub: 'facturación mensual recurrente' },
    { label: 'Clientes de pago', value: paying, color: '#FBBF24', icon: '⭐', badge: { text: 'con suscripción', bg: 'rgba(251,191,36,0.12)', color: '#FBBF24' }, sub: 'con método de pago activo' },
    { label: 'ARR estimado', value: `${mrr * 12} €`, color: '#34D399', icon: '📈', badge: { text: 'proyección anual', bg: 'rgba(52,211,153,0.12)', color: '#34D399' }, sub: 'basado en MRR actual × 12' },
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
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
