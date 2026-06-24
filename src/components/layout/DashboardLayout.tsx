import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const pageTitles: Record<string, string> = {
  '/': 'Resumen',
  '/agents': 'Agentes de voz',
  '/calls': 'Llamadas',
  '/phone-numbers': 'Números',
  '/billing': 'Facturación',
  '/settings': 'Ajustes',
}

export default function DashboardLayout() {
  const location = useLocation()

  useEffect(() => {
    const label = pageTitles[location.pathname] ?? 'Dashboard'
    document.title = `${label} · Voice Dashboard`
  }, [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-white p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
