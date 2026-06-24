import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

/**
 * Bloquea el panel de cliente hasta que se añade un método de pago.
 * Los administradores no pasan por esta verificación.
 */
export default function PaymentGate() {
  const { profile } = useAuth()

  if (profile && profile.role === 'client' && !profile.payment_method_added) {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}
