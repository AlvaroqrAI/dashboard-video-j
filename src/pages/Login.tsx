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

  // Envía el correo de restablecimiento de contraseña (admin o cliente).
  const handleForgot = async () => {
    setError(null)
    setResetMsg(null)
    if (!email) {
      setError('Escribe tu email arriba y pulsa de nuevo.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) setError(error.message)
    else
      setResetMsg(
        'Si el email existe, te hemos enviado un enlace para restablecer la contraseña.',
      )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const profile = await signIn(email, password)
      // Redirige según el rol devuelto por el backend.
      if (profile.role === 'admin') {
        navigate('/admin', { replace: true })
      } else if (!profile.payment_method_added) {
        navigate('/onboarding', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email o contraseña incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md border-2 border-black bg-white p-10">
        <h1 className="text-5xl font-black uppercase leading-[0.9] tracking-tighter text-black">
          Voice
          <br />
          Dashboard
        </h1>
        <p className="mt-4 mb-10 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
          Inicia sesión en tu cuenta
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-black">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-0"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-black">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-0"
            />
          </div>

          {error && (
            <p className="border border-black bg-black px-3 py-2 text-xs font-medium uppercase tracking-wide text-white">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black py-3 text-xs font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
          >
            {loading ? 'Accediendo…' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={handleForgot}
            className="w-full text-center text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 hover:text-black"
          >
            ¿Olvidaste tu contraseña?
          </button>

          {resetMsg && (
            <p className="text-xs font-medium uppercase tracking-wide text-black">
              {resetMsg}
            </p>
          )}
        </form>

        {DEMO_MODE && (
          <div className="mt-8 border-t-2 border-black pt-6">
            <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
              Modo demo — entra sin credenciales
            </p>
            <div className="flex gap-px bg-black">
              <button
                type="button"
                onClick={() => { demoLogin('admin'); navigate('/admin') }}
                className="flex-1 bg-black py-3 text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-neutral-800"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => { demoLogin('client'); navigate('/') }}
                className="flex-1 bg-white py-3 text-xs font-bold uppercase tracking-[0.15em] text-black hover:bg-neutral-100"
              >
                Cliente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
