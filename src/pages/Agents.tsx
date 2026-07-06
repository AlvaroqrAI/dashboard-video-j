import { useEffect, useState } from 'react'
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

export default function Agents() {
  const { user } = useAuth()
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState<AgentRow | null>(null)
  const [detail, setDetail] = useState<AgentPrompt | null>(null)
  const [draft, setDraft] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (!user) return
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
      const d = await invokeFunction<AgentPrompt>('retell-agent', { action: 'get', agentId: a.id })
      setDetail(d)
      setDraft(d.prompt ?? '')
    } catch (e) {
      setFeedback({ text: e instanceof Error ? e.message : 'No se pudo cargar el prompt.', ok: false })
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
      await invokeFunction('retell-agent', { action: 'update-prompt', agentId: editing.id, prompt: draft })
      setFeedback({ text: 'Prompt guardado correctamente.', ok: true })
    } catch (e) {
      setFeedback({ text: e instanceof Error ? e.message : 'No se pudo guardar.', ok: false })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: '#7C6FE0', textTransform: 'uppercase', marginBottom: 4 }}>MECANIA</p>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#F1F0F5', letterSpacing: '-0.02em' }}>Agentes de voz</h1>
        <p style={{ fontSize: 13, color: '#4A4960', marginTop: 4 }}>Gestiona los agentes asignados a tu cuenta</p>
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: '#4A4960', letterSpacing: '0.1em' }}>Cargando…</p>
      ) : agents.length === 0 ? (
        <div style={{ background: '#13141C', border: '1px solid #2A2B35', borderRadius: 12, padding: '2rem', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#4A4960' }}>Tu administrador aún no te ha asignado agentes.</p>
        </div>
      ) : (
        <div style={{ background: '#13141C', border: '1px solid #2A2B35', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2A2B35' }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#4A4960', textTransform: 'uppercase' }}>Agente</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#4A4960', textTransform: 'uppercase' }}>Agent ID</th>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#4A4960', textTransform: 'uppercase' }}>Estado</th>
                <th style={{ padding: '12px 20px' }} />
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #2A2B35' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 700, color: '#F1F0F5' }}>{a.name}</td>
                  <td style={{ padding: '16px 20px', fontFamily: 'monospace', fontSize: 12, color: '#4A4960' }}>{a.retell_agent_id || '—'}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '4px 10px', borderRadius: 6,
                      background: a.status === 'active' ? 'rgba(124,111,224,0.15)' : 'rgba(74,73,96,0.2)',
                      color: a.status === 'active' ? '#9B8FEF' : '#4A4960',
                      border: `1px solid ${a.status === 'active' ? 'rgba(124,111,224,0.3)' : '#2A2B35'}`
                    }}>
                      {a.status === 'active' ? 'Activo' : 'Pausado'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => void openEditor(a)}
                      disabled={!a.retell_agent_id}
                      style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: '#7C6FE0', background: 'none', border: 'none', cursor: 'pointer', opacity: a.retell_agent_id ? 1 : 0.3
                      }}
                    >
                      Editar prompt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal editor */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', padding: '1rem' }}>
          <div style={{ background: '#13141C', border: '1px solid #2A2B35', borderRadius: 16, width: '100%', maxWidth: 760, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2A2B35', padding: '1rem 1.5rem' }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#F1F0F5' }}>{detail?.agent_name || editing.name}</h2>
              <button type="button" onClick={closeEditor} style={{ fontSize: 11, fontWeight: 700, color: '#4A4960', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Cerrar</button>
            </div>

            <div style={{ overflowY: 'auto', padding: '1.5rem' }}>
              {loadingDetail ? (
                <p style={{ fontSize: 12, color: '#4A4960' }}>Cargando prompt…</p>
              ) : detail && !detail.editable ? (
                <p style={{ fontSize: 13, color: '#4A4960', background: '#0D0E14', border: '1px solid #2A2B35', borderRadius: 8, padding: '1rem' }}>
                  Este agente usa un flujo de conversación ({detail.engine_type}) y no tiene un prompt único editable desde aquí.
                </p>
              ) : detail ? (
                <>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#4A4960', textTransform: 'uppercase', marginBottom: 8 }}>Prompt del agente</p>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={18}
                    style={{ width: '100%', resize: 'vertical', background: '#0D0E14', border: '1px solid #2A2B35', borderRadius: 8, padding: '0.75rem', fontFamily: 'monospace', fontSize: 12, color: '#F1F0F5', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box' }}
                  />
                </>
              ) : (
                <p style={{ fontSize: 12, color: '#EF4444' }}>{feedback?.text || 'No se pudo cargar el prompt.'}</p>
              )}
            </div>

            {detail?.editable && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid #2A2B35', padding: '1rem 1.5rem' }}>
                <button
                  type="button"
                  onClick={() => void savePrompt()}
                  disabled={saving}
                  style={{ background: '#7C6FE0', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                {feedback && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: feedback.ok ? '#7C6FE0' : '#EF4444' }}>{feedback.text}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
