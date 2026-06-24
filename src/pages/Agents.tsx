import { useEffect, useState } from 'react'
import { Card, EmptyState, PageHeader } from '@/components/ui/Card'
import { supabase, invokeFunction } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface AgentRow {
  id: string
  retell_agent_id: string | null
  name: string
  status: 'active' | 'paused'
}

interface AgentPrompt {
  editable: boolean
  agent_name: string
  voice_id: string | null
  language: string | null
  engine_type: string
  prompt: string
}

const btnCls =
  'bg-black px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-neutral-800 disabled:opacity-40'

export default function Agents() {
  const { user } = useAuth()
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)

  // Editor de prompt
  const [editing, setEditing] = useState<AgentRow | null>(null)
  const [detail, setDetail] = useState<AgentPrompt | null>(null)
  const [draft, setDraft] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(
    null,
  )

  useEffect(() => {
    if (!user) return
    // RLS solo devuelve los agentes del propio cliente.
    supabase
      .from('agents')
      .select('id, retell_agent_id, name, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setAgents((data ?? []) as AgentRow[])
        setLoading(false)
      })
  }, [user])

  async function openEditor(a: AgentRow) {
    setEditing(a)
    setDetail(null)
    setDraft('')
    setFeedback(null)
    setLoadingDetail(true)
    try {
      const d = await invokeFunction<AgentPrompt>('retell-agent', {
        action: 'get',
        agentId: a.id,
      })
      setDetail(d)
      setDraft(d.prompt ?? '')
    } catch (e) {
      setFeedback({
        text: e instanceof Error ? e.message : 'No se pudo cargar el prompt.',
        ok: false,
      })
    } finally {
      setLoadingDetail(false)
    }
  }

  function closeEditor() {
    setEditing(null)
    setDetail(null)
    setDraft('')
    setFeedback(null)
  }

  async function savePrompt() {
    if (!editing) return
    setSaving(true)
    setFeedback(null)
    try {
      await invokeFunction('retell-agent', {
        action: 'update-prompt',
        agentId: editing.id,
        prompt: draft,
      })
      setFeedback({ text: 'Prompt guardado.', ok: true })
    } catch (e) {
      setFeedback({
        text: e instanceof Error ? e.message : 'No se pudo guardar.',
        ok: false,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Agentes de voz"
        subtitle="Edita el prompt de los agentes activados en tu cuenta"
      />

      {loading ? (
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
          Cargando…
        </p>
      ) : agents.length === 0 ? (
        <EmptyState message="Tu administrador aún no te ha asignado agentes." />
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Agente
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Agent ID
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Estado
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
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => void openEditor(a)}
                      disabled={!a.retell_agent_id}
                      className="text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60 disabled:opacity-30"
                    >
                      Editar prompt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Editor de prompt (overlay) */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col border-2 border-black bg-white">
            <div className="flex items-center justify-between border-b-2 border-black px-6 py-4">
              <h2 className="text-sm font-bold uppercase tracking-[0.05em] text-black">
                {detail?.agent_name || editing.name}
              </h2>
              <button
                type="button"
                onClick={closeEditor}
                className="text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60"
              >
                Cerrar
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              {loadingDetail ? (
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Cargando prompt…
                </p>
              ) : detail && !detail.editable ? (
                <p className="border border-black bg-neutral-50 px-3 py-3 text-xs text-neutral-700">
                  Este agente usa un flujo de conversación ({detail.engine_type})
                  y no tiene un prompt único editable desde aquí.
                </p>
              ) : detail ? (
                <>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                    Prompt del agente
                  </label>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={18}
                    className="w-full resize-y border border-black bg-white p-3 font-mono text-xs leading-relaxed text-black outline-none focus:border-black"
                  />
                </>
              ) : (
                <p className="border border-black bg-black px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">
                  {feedback?.text || 'No se pudo cargar el prompt.'}
                </p>
              )}
            </div>

            {detail?.editable && (
              <div className="flex items-center gap-3 border-t-2 border-black px-6 py-4">
                <button
                  type="button"
                  onClick={() => void savePrompt()}
                  disabled={saving}
                  className={btnCls}
                >
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                {feedback && (
                  <span
                    className={`text-xs font-bold uppercase tracking-wide ${
                      feedback.ok ? 'text-black' : 'text-red-600'
                    }`}
                  >
                    {feedback.text}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
