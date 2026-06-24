import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

/** Requiere usuario autenticado. */
export default function ProtectedRoute() {
  const { profile, user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
        Cargando…
      </div>
    )
  }

  if (!user && !profile) return <Navigate to="/login" replace />

  return <Outlet />
}
