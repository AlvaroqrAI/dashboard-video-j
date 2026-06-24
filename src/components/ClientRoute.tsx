import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

/**
 * Rutas exclusivas del panel de cliente.
 * Si un administrador intenta acceder, se le redirige a su backoffice.
 */
export default function ClientRoute() {
  const { profile } = useAuth()
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />
  return <Outlet />
}
