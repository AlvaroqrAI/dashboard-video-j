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
        setTimeout(poll, 1500)
      } else {
        setConfirming(false)
        setError('No pudimos confirmar el pago aún. Recarga en unos segundos.')
      }
    }
    void poll()
    return () => { cancelled = true }
  }, [params, refreshProfile, navigate])

  const addPaymentMethod = async () => {
    setError(null)
    if (DEMO_MODE) { markPaymentAdded(); navigate('/'); return }
    setLoading(true)
    try {
      const { url } = await invokeFunction<{ url: string }>('create-checkout-session', {})
      if (!url) throw new Error('No se recibió la URL de Stripe.')
      window.location.href = url
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'No se pudo abrir el checkout de Stripe.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0E14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#181922', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '2.5rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>

        <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 300, height: 200, background: 'radial-gradient(rgba(124,111,224,0.2),transparent 65%)', pointerEvents: 'none' }} />

        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔧</div>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#F1F0F5', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
          Activa tu cuenta
        </h1>
        <p style={{ fontSize: '0.82rem', color: '#8B8A99', lineHeight: 1.6, marginBottom: '2rem' }}>
          Para empezar a usar MecanIA necesitas añadir un método de pago. La gestión es segura a través de Stripe.
        </p>

        {confirming ? (
          <p style={{ fontSize: 12, color: '#9B8FEF' }}>Confirmando tu pago…</p>
        ) : (
          <button
            type="button"
            onClick={addPaymentMethod}
            disabled={loading}
            style={{ width: '100%', background: '#7C6FE0', color: '#fff', border: 'none', borderRadius: 9, padding: '0.85rem', fontSize: '0.95rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontFamily: 'inherit', boxShadow: '0 4px 20px rgba(124,111,224,0.3)' }}
          >
            {loading ? 'Abriendo Stripe…' : 'Añadir método de pago'}
          </button>
        )}

        {error && (
          <div style={{ marginTop: '1rem', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '0.6rem', fontSize: '0.8rem', color: '#F87171' }}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => signOut()}
          style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#4A4960', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Salir
        </button>
      </div>
    </div>
  )
}
