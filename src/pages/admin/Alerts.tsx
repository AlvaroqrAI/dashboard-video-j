import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, PageHeader, EmptyState } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'

// Fila de alerta real (tabla public.alerts) enriquecida con datos del cliente.
interface AlertRow {
  id: string
  user_id: string
  type: string
  title: string
  message: string | null
  is_read: boolean
  created_at: string
  clientName: string
  clientEmail: string | null
}

// Monocromo: las alertas de mayor severidad se rellenan; las informativas van en contorno.
const typeStyles: Record<string, string> = {
  payment: 'bg-black text-white',
  critical: 'bg-black text-white',
  warning: 'bg-white text-black',
  info: 'bg-white text-black',
}

const typeLabels: Record<string, string> = {
  payment: 'Impago',
  critical: 'Crítica',
  warning: 'Aviso',
  info: 'Información',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchAlerts() {
    setLoading(true)
    // 1) Todas las alertas (el admin puede leerlas todas por RLS).
    const { data: alertData } = await supabase
      .from('alerts')
      .select('id, user_id, type, title, message, is_read, created_at')
      .order('created_at', { ascending: false })

    const rows = (alertData ?? []) as Omit<AlertRow, 'clientName' | 'clientEmail'>[]

    // 2) Resolver el nombre/email de cada cliente (no hay FK directa alerts→profiles).
    const ids = [...new Set(rows.map((r) => r.user_id))]
    const nameById = new Map<string, { name: string; email: string | null }>()
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids)
      for (const p of profs ?? []) {
        nameById.set(p.id as string, {
          name: (p.full_name as string) || (p.email as string) || 'Cliente',
          email: (p.email as string) ?? null,
        })
      }
    }

    setAlerts(
      rows.map((r) => ({
        ...r,
        clientName: nameById.get(r.user_id)?.name ?? 'Cliente',
        clientEmail: nameById.get(r.user_id)?.email ?? null,
      })),
    )
    setLoading(false)
  }

  // Elimina una alerta (solo admin; permitido por RLS "alerts_admin_write").
  async function deleteAlert(id: string) {
    if (!window.confirm('¿Eliminar esta alerta? No se puede deshacer.')) return
    setAlerts((prev) => prev.filter((a) => a.id !== id))
    const { error } = await supabase.from('alerts').delete().eq('id', id)
    if (error) {
      // Si falla, recargamos para reflejar el estado real.
      void fetchAlerts()
    }
  }

  useEffect(() => {
    void fetchAlerts()
  }, [])

  return (
    <div>
      <PageHeader
        title="Alertas"
        subtitle={`${alerts.length} alerta(s) enviada(s)`}
        action={
          <button
            type="button"
            onClick={() => void fetchAlerts()}
            className="border border-black bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.15em] text-black hover:bg-black hover:text-white"
          >
            Actualizar
          </button>
        }
      />

      {loading ? (
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Cargando…
        </p>
      ) : alerts.length === 0 ? (
        <EmptyState message="Aún no has enviado ninguna alerta" />
      ) : (
        <div className="space-y-6">
          {alerts.map((a) => (
            <Card key={a.id} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`border border-black px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
                      typeStyles[a.type] ?? 'bg-white text-black'
                    }`}
                  >
                    {typeLabels[a.type] ?? a.type}
                  </span>
                  <Link
                    to={`/admin/clients/${a.user_id}`}
                    className="text-xs font-bold uppercase tracking-[0.15em] text-black underline underline-offset-4 hover:opacity-60"
                  >
                    {a.clientName}
                  </Link>
                  {!a.is_read && (
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">
                      No leída
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-bold text-black">{a.title}</p>
                {a.message && (
                  <p className="mt-1 text-sm text-neutral-500">{a.message}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-xs uppercase tracking-[0.15em] text-neutral-500">
                  {formatDate(a.created_at)}
                </span>
                <button
                  type="button"
                  onClick={() => void deleteAlert(a.id)}
                  className="text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60"
                >
                  Eliminar
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
