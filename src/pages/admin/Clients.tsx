import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/Card'
import { supabase, invokeFunction } from '@/lib/supabase'

interface ClientRow {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
  payment_method_added: boolean | null
  created_at: string
}

const input: React.CSSProperties = {
  width: '100%', background: '#0D0E14', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#F1F0F5',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
  background: '#7C6FE0', color: '#fff', border: 'none', borderRadius: 9,
  padding: '9px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit', letterSpacing: '0.04em',
}

export default function Clients() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [retellApiKey, setRetellApiKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)

  async function fetchClients() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, payment_method_added, created_at')
      .eq('role', 'client')
      .order('created_at', { ascending: false })
    if (error) { console.error(error.message); setClients([]) }
    else setClients((data ?? []) as ClientRow[])
    setLoading(false)
  }

  useEffect(() => { void fetchClients() }, [])

  async function handleCreate() {
    setSubmitting(true); setFeedback(null)
    try {
      await invokeFunction('create-client', { email, password, full_name: fullName, retellApiKey: retellApiKey || undefined })
      setFullName(''); setEmail(''); setPassword(''); setRetellApiKey('')
      setShowForm(false)
      setFeedback({ text: 'Cliente creado correctamente.', ok: true })
      await fetchClients()
    } catch (err) {
      setFeedback({ text: `No se pudo crear el cliente: ${err instanceof Error ? err.message : 'Error'}`, ok: false })
    } finally { setSubmitting(false) }
  }

  async function handleDelete(userId: string) {
    if (!window.confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) return
    setFeedback(null)
    try {
      await invokeFunction('delete-client', { userId })
      setFeedback({ text: 'Cliente eliminado.', ok: true })
      await fetchClients()
    } catch (err) {
      setFeedback({ text: `No se pudo eliminar: ${err instanceof Error ? err.message : 'Error'}`, ok: false })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Clientes"
        subtitle="Gestiona las cuentas de tus clientes"
        action={
          <button type="button" onClick={() => setShowForm(v => !v)} style={btnPrimary}>
            {showForm ? 'Cancelar' : '+ Nuevo cliente'}
          </button>
        }
      />

      {feedback && (
        <div style={{ background: feedback.ok ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${feedback.ok ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`, borderRadius: 10, padding: '10px 16px', fontSize: 12, color: feedback.ok ? '#34D399' : '#F87171' }}>
          {feedback.text}
        </div>
      )}

      {showForm && (
        <div style={{ background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#F1F0F5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>Nuevo cliente</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input style={input} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nombre / empresa" />
            <input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
            <input style={input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" />
            <input style={input} type="password" value={retellApiKey} onChange={e => setRetellApiKey(e.target.value)} placeholder="API Key de Retell (opcional)" />
          </div>
          <button type="button" onClick={() => void handleCreate()} disabled={submitting} style={{ ...btnPrimary, marginTop: 16, opacity: submitting ? 0.5 : 1 }}>
            {submitting ? 'Creando…' : 'Crear cliente'}
          </button>
        </div>
      )}

      <div style={{ background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '32px 24px', fontSize: 12, color: '#4A4960' }}>Cargando…</div>
        ) : clients.length === 0 ? (
          <div style={{ padding: '32px 24px', fontSize: 12, color: '#4A4960' }}>Aún no hay clientes.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Cliente', 'Estado de pago', 'Alta', ''].map(h => (
                  <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F0F5' }}>{c.full_name}</div>
                    <div style={{ fontSize: 11, color: '#8B8A99', marginTop: 2 }}>{c.email}</div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    {c.payment_method_added ? (
                      <span style={{ background: 'rgba(52,211,153,0.12)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Método añadido</span>
                    ) : (
                      <span style={{ background: 'rgba(251,191,36,0.1)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Pendiente</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 20px', fontSize: 12, color: '#8B8A99' }}>
                    {new Date(c.created_at).toLocaleDateString('es-ES')}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <Link to={`/admin/clients/${c.id}`} style={{ fontSize: 12, fontWeight: 600, color: '#9B8FEF', textDecoration: 'none', marginRight: 16 }}>Gestionar →</Link>
                    <button type="button" onClick={() => void handleDelete(c.id)} style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: '#F87171', cursor: 'pointer', fontFamily: 'inherit' }}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
