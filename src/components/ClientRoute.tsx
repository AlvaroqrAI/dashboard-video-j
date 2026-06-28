import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

/**
 * Rutas del panel de cliente.
 * Admins también pueden acceder para ver la vista cliente.
 */
export default function ClientRoute() {
  return <Outlet />
}
