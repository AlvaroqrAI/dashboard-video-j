import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Topbar from './Topbar'
import { useAuth } from '@/context/AuthContext'

const nav = [
  { to: '/admin', label: 'Métricas globales', end: true },
  { to: '/admin/clients', label: 'Clientes' },
  { to: '/admin/agents', label: 'Agentes' },
  { to: '/admin/plans', label: 'Planes y precios' },
  { to: '/admin/alerts', label: 'Alertas' },
]

export default function AdminLayout() {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const match = nav.find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
    )
    const label = match?.label ?? 'Admin'
    document.title = `${label} · Admin · UmindsAI`
  }, [location.pathname])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '??'

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="flex w-60 shrink-0 flex-col border-r border-black bg-black">
        <div className="flex h-16 items-center border-b border-neutral-800 px-6 text-lg font-black uppercase tracking-tighter text-white">
          Admin · UmindsAI
        </div>
        <nav className="flex flex-1 flex-col gap-px p-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-4 py-3 text-xs font-bold uppercase tracking-[0.15em] transition-colors ${
                  isActive
                    ? 'bg-white text-black'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Usuario */}
        <div ref={ref} className="relative border-t border-neutral-800">
          {open && (
            <div className="absolute bottom-full left-0 right-0 border border-neutral-800 bg-neutral-900 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
              <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-white text-xs font-black text-black">
                  {initials}
                </div>
                <span className="truncate text-xs font-medium text-neutral-400">{user?.email}</span>
              </div>
              <NavLink
                to="/admin/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-[0.15em] text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
              >
                Ajustes
              </NavLink>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 border-t border-neutral-800 px-4 py-3 text-xs font-bold uppercase tracking-[0.15em] text-neutral-300 transition-colors hover:bg-white hover:text-black"
              >
                Cerrar sesión
              </button>
            </div>
          )}

          <button
            type="button"
            aria-label="Menú de usuario"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-4 transition-colors hover:bg-neutral-800"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-white text-xs font-black text-black">
              {initials}
            </div>
            <span className="flex-1 truncate text-left text-xs font-medium text-neutral-400">
              {user?.email}
            </span>
            <span className="text-xs text-neutral-600">···</span>
          </button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto bg-white p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
