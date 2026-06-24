import { useEffect, useState } from 'react'
import { Card, PageHeader, EmptyState } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'

interface CallRow {
  call_id: string
  user_id: string | null
  agent_id: string | null
  agent_name: string | null
  direction: string | null
  from_number: string | null
  to_number: string | null
  duration_ms: number | null
  start_timestamp: string | null
  disconnection_reason: string | null
  recording_url: string | null
  transcript: string | null
  call_summary: string | null
  user_sentiment: string | null
}

interface ClientOption {
  id: string
  full_name: string | null
  email: string | null
}

function fmtDuration(ms?: number | null) {
  if (!ms) return '—'
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminCalls() {
  const [calls, setCalls] = useState<CallRow[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selected, setSelected] = useState<CallRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      // RLS (call_logs_admin_select) deja al admin ver todas las llamadas.
      const [callsRes, clientsRes] = await Promise.all([
        supabase
          .from('call_logs')
          .select(
            'call_id, user_id, agent_id, agent_name, direction, from_number, to_number, duration_ms, start_timestamp, disconnection_reason, recording_url, transcript, call_summary, user_sentiment',
          )
          .order('start_timestamp', { ascending: false })
          .limit(500),
        supabase.from('profiles').select('id, full_name, email'),
      ])
      if (callsRes.error) setError(callsRes.error.message)
      else setCalls((callsRes.data ?? []) as CallRow[])
      setClients((clientsRes.data ?? []) as ClientOption[])
      setLoading(false)
    }
    void load()
  }, [])

  const clientName = (id: string | null) => {
    if (!id) return '—'
    const c = clients.find((c) => c.id === id)
    return c?.full_name || c?.email || '—'
  }

  return (
    <div>
      <PageHeader
        title="Llamadas"
        subtitle={`${calls.length} llamadas registradas (todos los clientes)`}
      />

      {error && (
        <p className="mb-6 border border-black bg-black px-3 py-2 text-xs font-medium uppercase tracking-wide text-white">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Cargando…
        </p>
      ) : calls.length === 0 ? (
        <EmptyState message="Aún no hay llamadas registradas." />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="p-0 lg:col-span-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black text-left">
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                    Cliente
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                    Agente
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                    De → A
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                    Duración
                  </th>
                  <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c) => (
                  <tr
                    key={c.call_id}
                    onClick={() => setSelected(c)}
                    className={`cursor-pointer border-b border-neutral-200 last:border-0 hover:bg-neutral-50 ${
                      selected?.call_id === c.call_id ? 'bg-neutral-100' : ''
                    }`}
                  >
                    <td className="px-5 py-4 font-bold text-black">
                      {clientName(c.user_id)}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {c.agent_name || c.agent_id || '—'}
                      <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                        {c.direction === 'inbound' ? 'Entrante' : 'Saliente'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-neutral-600">
                      {c.from_number || '—'} → {c.to_number || '—'}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {fmtDuration(c.duration_ms)}
                    </td>
                    <td className="px-5 py-4 text-neutral-500">
                      {fmtDate(c.start_timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            {selected ? (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.05em] text-black">
                  {clientName(selected.user_id)}
                </h2>
                <p className="mt-1 text-xs text-neutral-500">
                  {selected.agent_name || selected.agent_id || '—'}
                </p>
                <p className="mt-1 font-mono text-xs text-neutral-500">
                  {selected.from_number || '—'} → {selected.to_number || '—'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="border border-black bg-black px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
                    {selected.direction === 'inbound' ? 'Entrante' : 'Saliente'}
                  </span>
                  {selected.user_sentiment && (
                    <span className="border border-black bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-black">
                      {selected.user_sentiment}
                    </span>
                  )}
                  {selected.disconnection_reason && (
                    <span className="border border-neutral-300 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-500">
                      {selected.disconnection_reason}
                    </span>
                  )}
                </div>

                {selected.call_summary && (
                  <div className="mt-6">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-black">
                      Resumen
                    </p>
                    <p className="text-xs leading-relaxed text-neutral-700">
                      {selected.call_summary}
                    </p>
                  </div>
                )}

                <div className="mt-6">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-black">
                    Grabación
                  </p>
                  {selected.recording_url ? (
                    <audio
                      controls
                      className="w-full"
                      src={selected.recording_url}
                    />
                  ) : (
                    <p className="text-xs text-neutral-400">Sin grabación.</p>
                  )}
                </div>

                <div className="mt-6">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-black">
                    Transcripción
                  </p>
                  <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-700">
                    {selected.transcript || 'Sin transcripción.'}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="py-12 text-center text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Selecciona una llamada para ver su grabación y transcripción.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
