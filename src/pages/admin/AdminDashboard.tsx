import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { Card, PageHeader } from '@/components/ui/Card'
import DateRangeFilter from '@/components/ui/DateRangeFilter'
import { computeRangedMetrics, rangeLabel, type RangeState } from '@/lib/metrics'
import { demoClients } from '@/lib/demo'

export default function AdminDashboard() {
  const [range, setRange] = useState<RangeState>({ preset: 'week' })
  const metrics = useMemo(() => computeRangedMetrics(range), [range])
  const label = rangeLabel(range)

  const totalClients = demoClients.length
  const activeClients = demoClients.filter((c) => c.status === 'active').length
  const mrr = demoClients.reduce((s, c) => s + c.mrr, 0)
  const paying = demoClients.filter((c) => c.mrr > 0).length

  const stats = [
    { label: 'Clientes totales', value: totalClients },
    { label: 'Clientes activos', value: activeClients },
    { label: `Llamadas · ${label}`, value: metrics.totalCalls.toLocaleString('es-ES') },
    { label: 'MRR', value: `${mrr} €` },
    { label: 'Clientes de pago', value: paying },
    { label: 'ARR estimado', value: `${mrr * 12} €` },
  ]

  return (
    <div>
      <PageHeader
        title="Métricas globales"
        subtitle="Actividad agregada de todos tus clientes y agentes"
        action={<DateRangeFilter value={range} onChange={setRange} />}
      />

      <div className="grid grid-cols-1 gap-px border border-black bg-black sm:grid-cols-2 lg:grid-cols-3">
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

      <Card className="mt-8">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-black">
            Volumen de llamadas · {label}
          </h2>
          <span className="text-xs font-medium uppercase tracking-[0.15em] text-neutral-500">
            {metrics.totalCalls.toLocaleString('es-ES')} llamadas · {metrics.totalCost} €
          </span>
        </div>
        <div className="h-72">
          {metrics.points.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
              Sin datos en el rango
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.points}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                <XAxis dataKey="label" stroke="#a3a3a3" fontSize={11} />
                <YAxis stroke="#a3a3a3" fontSize={11} />
                <Tooltip />
                <Bar dataKey="calls" fill="#0a0a0a" radius={[0, 0, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  )
}
