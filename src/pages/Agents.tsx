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

interface Metrics {
  total: number
  citas: number
  tasa: number
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function Agents() {
  const { user } = useAuth()
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<Metrics>({ total: 0, citas: 0, tasa: 0 })

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

    supabase
      .from('call_logs')
      .select('call_id, is_appointment')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const total = (data ?? []).length
        const citas = (data ?? []).filter(c => c.is_appointment).length
        const tasa = total > 0 ? Math.round((citas / total) * 100) : 0
        setMetrics({ total, citas, tasa })
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

  const agent = agents[0]

  return (
    <div style={{ padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: '#7C6FE0', textTransform: 'uppercase', marginBottom: 4 }}>MECANIA</p>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#F1F0F5', letterSpacing: '-0.02em' }}>Mi Agente</h1>
        <p style={{ fontSize: 13, color: '#4A4960', marginTop: 4 }}>Gestiona tu asistente de voz</p>
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: '#4A4960' }}>Cargando…</p>
      ) : !agent ? (
        <div style={{ background: '#13141C', border: '1px solid #2A2B35', borderRadius: 12, padding: '2rem', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#4A4960' }}>Tu administrador aún no te ha asignado agentes.</p>
        </div>
      ) : (
        <>
          {/* Avatar card — estilo tarjeta de personaje */}
          <div style={{
            background: 'linear-gradient(160deg, rgba(124,111,224,0.12) 0%, #13141C 45%)',
            border: '1px solid rgba(124,111,224,0.3)', borderRadius: 20, padding: '2.5rem 2rem 2rem',
            marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center',
            position: 'relative', overflow: 'hidden'
          }}>
            {/* Glow decorativo */}
            <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,111,224,0.25) 0%, rgba(124,111,224,0) 70%)', pointerEvents: 'none' }} />

            {/* Avatar: imagen si existe /sara-avatar.png, si no iniciales */}
            <div style={{ position: 'relative', marginBottom: '1.2rem' }}>
              <div style={{
                width: 140, height: 140, borderRadius: '50%', overflow: 'hidden',
                border: '3px solid rgba(124,111,224,0.5)', boxShadow: '0 0 40px rgba(124,111,224,0.35)',
                background: 'linear-gradient(135deg, #7C6FE0, #9B8FEF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <img
                  src="/sara-avatar.png"
                  alt="Sara"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 18%' }}
                  onError={(e) => {
                    const el = e.currentTarget
                    el.style.display = 'none'
                    if (el.parentElement) {
                      el.parentElement.innerHTML = `<span style="font-size:42px;font-weight:800;color:#fff">${getInitials(agent.name)}</span>`
                    }
                  }}
                />
              </div>
              {/* Punto de estado sobre el avatar */}
              <div style={{
                position: 'absolute', bottom: 8, right: 8, width: 22, height: 22, borderRadius: '50%',
                background: agent.status === 'active' ? '#34D399' : '#4A4960',
                border: '3px solid #13141C'
              }} />
            </div>

            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#F1F0F5', margin: 0, letterSpacing: '-0.01em' }}>
              Sara <span style={{ color: '#9B8FEF' }}>— Recepcionista IA</span>
            </h2>
            <p style={{ fontSize: 13, color: '#8B8A9E', marginTop: 4 }}>{agent.name}</p>
            <p style={{ fontSize: 11, color: '#4A4960', fontFamily: 'monospace', marginTop: 2 }}>{agent.retell_agent_id || '—'}</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: '1.2rem' }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '5px 12px', borderRadius: 999,
                background: agent.status === 'active' ? 'rgba(52,211,153,0.12)' : 'rgba(74,73,96,0.2)',
                color: agent.status === 'active' ? '#34D399' : '#4A4960',
                border: `1px solid ${agent.status === 'active' ? 'rgba(52,211,153,0.3)' : '#2A2B35'}`
              }}>
                {agent.status === 'active' ? '● Activa 24/7' : '● Pausada'}
              </span>
              <button
                type="button"
                onClick={() => void openEditor(agent)}
                disabled={!agent.retell_agent_id}
                style={{
                  background: 'rgba(124,111,224,0.12)', border: '1px solid rgba(124,111,224,0.35)',
                  borderRadius: 999, padding: '5px 14px', fontSize: 11, fontWeight: 700,
                  color: '#9B8FEF', cursor: 'pointer', letterSpacing: '0.05em'
                }}
              >
                Editar prompt
              </button>
            </div>
          </div>

          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Llamadas totales', value: metrics.total, sub: 'desde el inicio' },
              { label: 'Citas agendadas', value: metrics.citas, sub: 'confirmadas por el agente' },
              { label: 'Tasa de conversión', value: `${metrics.tasa}%`, sub: 'llamadas → citas' },
            ].map(m => (
              <div key={m.label} style={{ background: '#13141C', border: '1px solid #2A2B35', borderRadius: 12, padding: '1.25rem' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#4A4960', textTransform: 'uppercase', marginBottom: 8 }}>{m.label}</p>
                <p style={{ fontSize: 32, fontWeight: 800, color: '#9B8FEF', margin: '0 0 4px' }}>{m.value}</p>
                <p style={{ fontSize: 11, color: '#4A4960', margin: 0 }}>{m.sub}</p>
              </div>
            ))}
          </div>
        </>
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
