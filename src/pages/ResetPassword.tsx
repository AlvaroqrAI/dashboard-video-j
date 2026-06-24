import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Al llegar desde el email, Supabase deja una sesión de recuperación activa,
  // así que updateUser puede cambiar la contraseña directamente.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md border-2 border-black bg-white p-10">
        <h1 className="text-3xl font-black uppercase leading-[0.9] tracking-tighter text-black">
          Nueva contraseña
        </h1>
        <p className="mt-4 mb-8 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
          Introduce tu nueva contraseña
        </p>

        {done ? (
          <p className="text-xs font-bold uppercase tracking-wide text-black">
            Contraseña actualizada. Redirigiendo al inicio de sesión…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nueva contraseña"
              className="w-full border border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-0"
            />
            {error && (
              <p className="border border-black bg-black px-3 py-2 text-xs font-medium uppercase tracking-wide text-white">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black py-3 text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-neutral-800 disabled:opacity-40"
            >
              {loading ? 'Guardando…' : 'Actualizar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
