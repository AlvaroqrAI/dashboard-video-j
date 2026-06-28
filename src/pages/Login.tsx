import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { DEMO_MODE } from '@/lib/demo'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const { signIn, demoLogin } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetMsg, setResetMsg] = useState<string | null>(null)

  const handleForgot = async () => {
    setError(null)
    setResetMsg(null)
    if (!email) { setError('Escribe tu email arriba y pulsa de nuevo.'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) setError(error.message)
    else setResetMsg('Si el email existe, te hemos enviado un enlace para restablecer la contraseña.')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const profile = await signIn(email, password)
      if (profile.role === 'admin') navigate('/admin', { replace: true })
      else if (!profile.payment_method_added) navigate('/onboarding', { replace: true })
      else navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email o contraseña incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0E14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#181922', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '2.5rem', position: 'relative', overflow: 'hidden' }}>

        {/* Glow decorativo */}
        <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 300, height: 200, background: 'radial-gradient(rgba(124,111,224,0.22),transparent 65%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ marginBottom: '0.3rem', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#F1F0F5' }}>
          Mecan<span style={{ color: '#9B8FEF' }}>IA</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#4A4960', marginBottom: '2rem' }}>
          Panel de control · SRC Automoción
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8B8A99', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', background: '#1E1F2B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#F1F0F5', padding: '0.75rem 1rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#8B8A99', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', background: '#1E1F2B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#F1F0F5', padding: '0.75rem 1rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '0.6rem 0.9rem', fontSize: '0.8rem', color: '#F87171' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: '#7C6FE0', color: '#fff', border: 'none', borderRadius: 9, padding: '0.85rem', fontSize: '0.95rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, boxShadow: '0 4px 20px rgba(124,111,224,0.3)', fontFamily: 'inherit' }}
          >
            {loading ? 'Accediendo…' : 'Entrar →'}
          </button>

          <button
            type="button"
            onClick={handleForgot}
            style={{ background: 'none', border: 'none', color: '#4A4960', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ¿Olvidaste tu contraseña?
          </button>

          {resetMsg && (
            <p style={{ fontSize: '0.75rem', color: '#34D399' }}>{resetMsg}</p>
          )}
        </form>

        {DEMO_MODE && (
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.2rem' }}>
            <p style={{ textAlign: 'center', fontSize: '0.7rem', color: '#4A4960', marginBottom: '0.75rem' }}>
              Modo demo — entra sin credenciales
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => { demoLogin('admin'); navigate('/admin') }}
                style={{ flex: 1, background: '#7C6FE0', color: '#fff', border: 'none', borderRadius: 8, padding: '0.7rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => { demoLogin('client'); navigate('/') }}
                style={{ flex: 1, background: '#1E1F2B', color: '#F1F0F5', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.7rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cliente
              </button>
            </div>
          </div>
        )}

        <p style={{ marginTop: '1.5rem', fontSize: '0.7rem', color: '#4A4960', textAlign: 'center' }}>
          🔒 Acceso seguro · Tus datos están cifrados
        </p>
      </div>
    </div>
  )
}
