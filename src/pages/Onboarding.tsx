import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { DEMO_MODE } from '@/lib/demo'
import { invokeFunction } from '@/lib/supabase'

export default function Onboarding() {
  const { profile, markPaymentAdded, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Al volver de Stripe Checkout, esperamos a que el webhook marque el pago.
  useEffect(() => {
    if (params.get('checkout') !== 'success' || DEMO_MODE) return
    setConfirming(true)
    let cancelled = false
    let tries = 0
    const poll = async () => {
      const p = await refreshProfile()
      if (cancelled) return
      if (p?.payment_method_added) {
        navigate('/', { replace: true })
      } else if (tries++ < 10) {
        setTimeout(poll, 1500) // reintenta hasta ~15s
      } else {
        setConfirming(false)
        setError(
          'No pudimos confirmar el pago aún. Recarga en unos segundos o reinténtalo.',
        )
      }
    }
    void poll()
    return () => {
      cancelled = true
    }
  }, [params, refreshProfile, navigate])

  const addPaymentMethod = async () => {
    setError(null)
    if (DEMO_MODE) {
      markPaymentAdded()
      navigate('/')
      return
    }
    setLoading(true)
    try {
      // Sin priceId → Checkout en modo 'setup' (registrar tarjeta sin cobro).
      const { url } = await invokeFunction<{ url: string }>(
        'create-checkout-session',
        {},
      )
      if (!url) throw new Error('No se recibió la URL de Stripe.')
      window.location.href = url
    } catch (err) {
      setLoading(false)
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo abrir el checkout de Stripe.',
      )
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md border-2 border-black bg-white p-10 text-center">
        <h1 className="text-3xl font-black uppercase leading-[0.95] tracking-tighter text-black">
          Añade un método de pago
        </h1>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.15em] leading-relaxed text-neutral-500">
          Hola {profile?.full_name}. Para empezar a usar tus agentes de voz,
          necesitas registrar un método de pago. La gestión es segura a través de
          Stripe.
        </p>

        {confirming ? (
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.15em] text-black">
            Confirmando tu pago…
          </p>
        ) : (
          <button
            type="button"
            onClick={addPaymentMethod}
            disabled={loading}
            className="mt-8 w-full bg-black py-3 text-xs font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
          >
            {loading ? 'Abriendo Stripe…' : 'Añadir método de pago'}
          </button>
        )}

        {error && (
          <p className="mt-4 border border-black bg-black px-3 py-2 text-xs font-medium uppercase tracking-wide text-white">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => signOut()}
          className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 hover:text-black"
        >
          Salir
        </button>
      </div>
    </div>
  )
}
