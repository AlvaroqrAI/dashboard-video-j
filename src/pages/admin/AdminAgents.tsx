import { useEffect, useState } from 'react'
import { Card, PageHeader } from '@/components/ui/Card'
import { supabase, invokeFunction } from '@/lib/supabase'

interface AgentRow {
  id: string
  user_id: string | null
  retell_agent_id: string | null
  name: string
  status: 'active' | 'paused'
  webhook_url: string | null
  created_at: string
}

interface ClientOption {
  id: string
  full_name: string | null
  email: string | null
}

const inputCls =
  'border border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-0'
const btnCls =
  'bg-black px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-neutral-800 disabled:opacity-40'

export default function AdminAgents() {
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)

  // Formulario: sirve tanto para crear como para editar (si editingId != null).
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [retellAgentId, setRetellAgentId] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<'active' | 'paused'>('active')
  const [submitting, setSubmitting] = useState(false)
  const [webhookBusy, setWebhookBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(
    null,
  )

  async function fetchData() {
    setLoading(true)
    const [agentsRes, clientsRes] = await Promise.all([
      supabase
        .from('agents')
        .select('id, user_id, retell_agent_id, name, status, webhook_url, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'client')
        .order('created_at', { ascending: false }),
    ])
    setAgents((agentsRes.data ?? []) as AgentRow[])
    setClients((clientsRes.data ?? []) as ClientOption[])
    setLoading(false)
  }

  useEffect(() => {
    void fetchData()
  }, [])

  const clientName = (id: string | null) => {
    if (!id) return 'Sin asignar'
    const c = clients.find((c) => c.id === id)
    return c?.full_name || c?.email || '—'
  }

  function resetForm() {
    setEditingId(null)
    setClientId('')
    setRetellAgentId('')
    setName('')
    setStatus('active')
  }

  function startEdit(a: AgentRow) {
    setEditingId(a.id)
    setClientId(a.user_id ?? '')
    setRetellAgentId(a.retell_agent_id ?? '')
    setName(a.name)
    setStatus(a.status)
    setShowForm(true)
    setFeedback(null)
  }

  async function handleDelete(a: AgentRow) {
    if (!window.confirm('¿Eliminar este agente?')) return
    const { error } = await supabase.from('agents').delete().eq('id', a.id)
    if (error) {
      setFeedback({ text: error.message, ok: false })
    } else {
      setFeedback({ text: 'Agente eliminado.', ok: true })
      await fetchData()
    }
  }

  // Configura el agent-level webhook URL en Retell para que las llamadas se
  // guarden en la BD. Devuelve un mensaje de error o null si fue bien.
  async function configureWebhook(agentId: string): Promise<string | null> {
    try {
      await invokeFunction('set-agent-webhook', { agentId })
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'No se pudo configurar el webhook.'
    }
  }

  async function handleSubmit() {
    if (!retellAgentId) {
      setFeedback({ text: 'Indica el Agent ID.', ok: false })
      return
    }
    setSubmitting(true)
    setFeedback(null)
    const payload = {
      user_id: clientId || null,
      retell_agent_id: retellAgentId,
      name: name || retellAgentId,
      status,
    }
    const { data, error } = editingId
      ? await supabase
          .from('agents')
          .update(payload)
          .eq('id', editingId)
          .select('id')
          .single()
      : await supabase.from('agents').insert(payload).select('id').single()

    if (error) {
      setFeedback({ text: error.message, ok: false })
      setSubmitting(false)
      return
    }

    // Configurar el webhook a nivel de agente en Retell.
    const webhookErr = data?.id ? await configureWebhook(data.id) : null
    setFeedback({
      text: webhookErr
        ? `Agente guardado, pero el webhook no se configuró: ${webhookErr}`
        : editingId
          ? 'Agente actualizado y webhook configurado.'
          : 'Agente creado y webhook configurado.',
      ok: !webhookErr,
    })
    resetForm()
    setShowForm(false)
    await fetchData()
    setSubmitting(false)
  }

  // Botón manual para (re)configurar el webhook de un agente existente.
  async function handleConfigureWebhook(a: AgentRow) {
    setWebhookBusy(a.id)
    setFeedback(null)
    const webhookErr = await configureWebhook(a.id)
    setFeedback(
      webhookErr
        ? { text: webhookErr, ok: false }
        : { text: 'Webhook configurado en Retell.', ok: true },
    )
    setWebhookBusy(null)
    await fetchData()
  }

  const active = agents.filter((a) => a.status === 'active').length

  return (
    <div>
      <PageHeader
        title="Agentes"
        subtitle={`${agents.length} agentes · ${active} activos`}
        action={
          <button
            type="button"
            onClick={() => {
              if (showForm) resetForm()
              setShowForm((v) => !v)
              setFeedback(null)
            }}
            className={btnCls}
          >
            {showForm ? 'Cancelar' : '+ Nuevo agente'}
          </button>
        }
      />

      {feedback && (
        <p
          className={`mb-4 text-xs font-bold uppercase tracking-wide ${
            feedback.ok ? 'text-black' : 'text-red-600'
          }`}
        >
          {feedback.text}
        </p>
      )}

      {showForm && (
        <Card className="mb-4">
          <h2 className="mb-6 text-xs font-bold uppercase tracking-[0.15em] text-black">
            {editingId ? 'Editar agente' : 'Nuevo agente'}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del agente"
              className={inputCls}
            />
            <input
              value={retellAgentId}
              onChange={(e) => setRetellAgentId(e.target.value)}
              placeholder="Agent ID (de Retell)"
              className={inputCls}
            />
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={inputCls}
            >
              <option value="">— Sin asignar —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name || c.email}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'paused')}
              className={inputCls}
            >
              <option value="active">Activo</option>
              <option value="paused">Pausado</option>
            </select>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className={btnCls}
            >
              {submitting
                ? 'Guardando…'
                : editingId
                  ? 'Guardar cambios'
                  : 'Crear agente'}
            </button>
            {feedback && !feedback.ok && (
              <span className="border border-black bg-black px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">
                {feedback.text}
              </span>
            )}
          </div>
        </Card>
      )}

      <Card className="p-0">
        {loading ? (
          <p className="px-5 py-6 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Cargando…
          </p>
        ) : agents.length === 0 ? (
          <p className="px-5 py-6 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Aún no hay agentes.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Agente
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Cliente
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Agent ID
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Estado
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Webhook
                </th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-neutral-200 last:border-0 hover:bg-neutral-50"
                >
                  <td className="px-5 py-4 font-bold text-black">{a.name}</td>
                  <td className="px-5 py-4 text-neutral-600">
                    {clientName(a.user_id)}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-neutral-500">
                    {a.retell_agent_id || '—'}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`border border-black px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
                        a.status === 'active'
                          ? 'bg-black text-white'
                          : 'bg-white text-black'
                      }`}
                    >
                      {a.status === 'active' ? 'Activo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {a.webhook_url ? (
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-black">
                        ✓ Conectado
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-400">
                        Sin configurar
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => void handleConfigureWebhook(a)}
                      disabled={webhookBusy === a.id}
                      className="text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60 disabled:opacity-40"
                    >
                      {webhookBusy === a.id ? 'Configurando…' : 'Webhook'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      className="ml-4 text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(a)}
                      className="ml-4 text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
