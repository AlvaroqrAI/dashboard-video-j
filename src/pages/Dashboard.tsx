import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { useEffect, useMemo, useState } from 'react'
import { Card, PageHeader } from '@/components/ui/Card'
import DateRangeFilter from '@/components/ui/DateRangeFilter'
import {
  rangeBounds,
  rangeLabel,
  seriesToMetrics,
  type RangeState,
  type SeriesBucket,
} from '@/lib/metrics'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface AlertRow {
  id: string
  type: string
  title: string
  message: string | null
  created_at: string
}

export default function Dashboard() {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [range, setRange] = useState<RangeState>({ preset: 'week' })
  // Serie AGREGADA en el servidor (no se traen filas individuales).
  const [buckets, setBuckets] = useState<SeriesBucket[]>([])
  const [activeAgents, setActiveAgents] = useState(0)

  // Alertas reales del cliente sin descartar (las descartadas no se vuelven a mostrar).
  useEffect(() => {
    if (!user) return
    supabase
      .from('alerts')
      .select('id, type, title, message, created_at')
      .eq('user_id', user.id)
      .eq('dismissed', false)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setAlerts((data ?? []) as AlertRow[]))
  }, [user])

  // Nº de agentes activos (conteo en BD, sin traer filas).
  useEffect(() => {
    if (!user) return
    supabase
      .from('agents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active')
      .then(({ count }) => setActiveAgents(count ?? 0))
  }, [user])

  // Métricas del rango: AGREGADAS EN POSTGRES vía RPC (escala a millones de
  // llamadas, porque agrupa en el servidor y solo devuelve un punto por bucket).
  useEffect(() => {
    if (!user) return
    const { from, to, granularity } = rangeBounds(range)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    supabase
      .rpc('client_call_series', {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_bucket: granularity,
        p_tz: tz,
      })
      .then(({ data }) => setBuckets((data ?? []) as SeriesBucket[]))
  }, [user, range])

  // Cierra una alerta: la marca como descartada y la oculta. Las de pago no se
  // pueden cerrar (la RLS también lo bloquea como salvaguarda en el backend).
  async function dismissAlert(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    await supabase.from('alerts').update({ dismissed: true }).eq('id', id)
  }

  const metrics = useMemo(
    () => seriesToMetrics(range, buckets),
    [buckets, range],
  )
  const label = rangeLabel(range)
  const unit = metrics.granularity === 'hour' ? 'por hora' : 'por día'

  const stats = [
    { label: 'Llamadas', value: metrics.totalCalls.toLocaleString('es-ES') },
    {
      label: 'Gasto',
      value: `${metrics.totalCost.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} €`,
    },
    { label: 'Agentes activos', value: activeAgents.toLocaleString('es-ES') },
    { label: `Media ${unit}`, value: metrics.avgCalls.toLocaleString('es-ES') },
  ]

  return (
    <div>
      <PageHeader
        title="Resumen"
        subtitle="Tu actividad de agentes de voz"
        action={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {/* Alertas reales del cliente. Las de pago no se pueden cerrar. */}
      {alerts.map((a) => {
        const dark = a.type === 'payment' || a.type === 'critical'
        const canClose = a.type !== 'payment'
        return (
          <div
            key={a.id}
            className={`mb-3 flex items-start justify-between gap-4 border px-4 py-3 text-xs font-medium uppercase tracking-wide ${
              dark ? 'border-black bg-black text-white' : 'border-black bg-white text-black'
            }`}
          >
            <span className="min-w-0">
              <span className="font-bold">{a.title}</span>
              {a.message ? ` — ${a.message}` : ''}
            </span>
            {canClose && (
              <button
                type="button"
                onClick={() => void dismissAlert(a.id)}
                aria-label="Cerrar alerta"
                className={`shrink-0 text-base font-bold leading-none hover:opacity-60 ${
                  dark ? 'text-white' : 'text-black'
                }`}
              >
                ✕
              </button>
            )}
          </div>
        )
      })}

      <div className="grid grid-cols-1 gap-px bg-black sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              {s.label}
            </p>
            <p className="mt-3 text-5xl font-black tabular text-black">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-6 text-xs font-bold uppercase tracking-[0.15em] text-black">
            Llamadas · {label}
          </h2>
          <div className="h-64">
            {metrics.points.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Sin datos en el rango
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.points}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0a0a0a" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#0a0a0a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                  <XAxis dataKey="label" stroke="#a3a3a3" fontSize={11} />
                  <YAxis stroke="#a3a3a3" fontSize={11} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    stroke="#0a0a0a"
                    fill="url(#g)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="mb-6 text-xs font-bold uppercase tracking-[0.15em] text-black">
            Gasto (€) · {label}
          </h2>
          <div className="h-64">
            {metrics.points.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Sin datos en el rango
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                  <XAxis dataKey="label" stroke="#a3a3a3" fontSize={11} />
                  <YAxis stroke="#a3a3a3" fontSize={11} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="#0a0a0a"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
