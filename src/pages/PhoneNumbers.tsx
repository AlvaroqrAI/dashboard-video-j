import { useEffect, useState } from 'react'
import { Card, PageHeader, EmptyState } from '@/components/ui/Card'
import { invokeFunction } from '@/lib/supabase'

interface RetellNumber {
  phone_number: string
  phone_number_pretty?: string
  inbound_agent_id: string | null
  outbound_agent_id: string | null
  nickname: string | null
}

interface AgentOption {
  retell_agent_id: string | null
  name: string
}

const inputCls =
  'border border-black bg-white px-2 py-1.5 text-xs outline-none focus:border-black'

export default function PhoneNumbers() {
  const [numbers, setNumbers] = useState<RetellNumber[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edición de asignación por número.
  const [editing, setEditing] = useState<string | null>(null)
  const [inbound, setInbound] = useState('')
  const [outbound, setOutbound] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await invokeFunction<{
        numbers: RetellNumber[]
        agents: AgentOption[]
      }>('retell-phone-numbers', { action: 'list' })
      setNumbers(data.numbers ?? [])
      setAgents(data.agents ?? [])
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudieron cargar los números.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const agentName = (id: string | null) => {
    if (!id) return '—'
    const a = agents.find((x) => x.retell_agent_id === id)
    return a?.name || id
  }

  function startEdit(n: RetellNumber) {
    setEditing(n.phone_number)
    setInbound(n.inbound_agent_id ?? '')
    setOutbound(n.outbound_agent_id ?? '')
  }

  async function saveAssign(n: RetellNumber) {
    setSaving(true)
    setError(null)
    try {
      await invokeFunction('retell-phone-numbers', {
        action: 'assign',
        phoneNumber: n.phone_number,
        inboundAgentId: inbound,
        outboundAgentId: outbound,
      })
      setEditing(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Números de teléfono"
        subtitle="Asigna qué agente atiende cada número (entrante y saliente)"
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
      ) : numbers.length === 0 ? (
        <EmptyState message="No hay números de teléfono en tu cuenta de Retell." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Número
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Alias
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Agente entrante
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Agente saliente
                </th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((n) => {
                const isEditing = editing === n.phone_number
                return (
                  <tr
                    key={n.phone_number}
                    className="border-b border-neutral-200 last:border-0 hover:bg-neutral-50"
                  >
                    <td className="px-5 py-4 font-bold text-black">
                      {n.phone_number_pretty || n.phone_number}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {n.nickname || '—'}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {isEditing ? (
                        <select
                          value={inbound}
                          onChange={(e) => setInbound(e.target.value)}
                          className={inputCls}
                        >
                          <option value="">— Sin asignar —</option>
                          {agents.map((a) => (
                            <option
                              key={a.retell_agent_id ?? a.name}
                              value={a.retell_agent_id ?? ''}
                            >
                              {a.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        agentName(n.inbound_agent_id)
                      )}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {isEditing ? (
                        <select
                          value={outbound}
                          onChange={(e) => setOutbound(e.target.value)}
                          className={inputCls}
                        >
                          <option value="">— Sin asignar —</option>
                          {agents.map((a) => (
                            <option
                              key={a.retell_agent_id ?? a.name}
                              value={a.retell_agent_id ?? ''}
                            >
                              {a.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        agentName(n.outbound_agent_id)
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => void saveAssign(n)}
                            disabled={saving}
                            className="text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60 disabled:opacity-40"
                          >
                            {saving ? 'Guardando…' : 'Guardar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-500 underline underline-offset-4 hover:opacity-60"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(n)}
                          className="text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60"
                        >
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
