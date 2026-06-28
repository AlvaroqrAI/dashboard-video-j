import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const pageTitles: Record<string, string> = {
  '/': 'Inicio',
  '/agents': 'Mi Agente',
  '/calls': 'Llamadas',
  '/calendar': 'Calendario',
  '/billing': 'Facturación',
  '/settings': 'Ajustes',
}

export default function DashboardLayout() {
  const location = useLocation()

  useEffect(() => {
    const label = pageTitles[location.pathname] ?? 'Dashboard'
    document.title = `${label} · MecanIA`
  }, [location.pathname])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0D0E14' }}>
      <Sidebar />
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />
        <main style={{ flex: 1, overflowY: 'auto', background: '#0D0E14', padding: '20px 24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
