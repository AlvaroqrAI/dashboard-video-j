import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const nav = [
  { to: '/', label: 'Resumen', end: true },
  { to: '/agents', label: 'Agentes de voz' },
  { to: '/calls', label: 'Llamadas' },
  { to: '/phone-numbers', label: 'Números' },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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
    <aside className="flex w-60 shrink-0 flex-col border-r border-black bg-white">
      <div className="flex h-16 items-center border-b border-black px-6 text-lg font-black uppercase tracking-tighter text-black">
        Voice Dashboard
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
                  ? 'bg-black text-white'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-black'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Usuario */}
      <div ref={ref} className="relative border-t border-black">
        {open && (
          <div className="absolute bottom-full left-0 right-0 border border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {/* Cabecera del popover */}
            <div className="flex items-center gap-3 border-b border-black px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-black text-xs font-black text-white">
                {initials}
              </div>
              <span className="truncate text-xs font-medium text-neutral-500">{user?.email}</span>
            </div>
            {/* Opciones */}
            <NavLink
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-[0.15em] text-black transition-colors hover:bg-neutral-100"
            >
              Ajustes
            </NavLink>
            <NavLink
              to="/billing"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-[0.15em] text-black transition-colors hover:bg-neutral-100"
            >
              Facturación
            </NavLink>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 border-t border-black px-4 py-3 text-xs font-bold uppercase tracking-[0.15em] text-black transition-colors hover:bg-black hover:text-white"
            >
              Cerrar sesión
            </button>
          </div>
        )}

        <button
          type="button"
          aria-label="Menú de usuario"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-4 transition-colors hover:bg-neutral-100"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-black text-xs font-black text-white">
            {initials}
          </div>
          <span className="flex-1 truncate text-left text-xs font-medium text-neutral-500">
            {user?.email}
          </span>
          <span className="text-xs text-neutral-400">···</span>
        </button>
      </div>
    </aside>
  )
}
