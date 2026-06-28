import { useEffect, useRef, useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const icons: Record<string, JSX.Element> = {
  home: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  phone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.6 10.8a15.05 15.05 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.56.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.56 3.57a1 1 0 0 1-.25 1.02L6.6 10.8z"/></svg>,
  calls: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/></svg>,
  calendar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
}

const nav = [
  { to: '/', label: 'Inicio', end: true, icon: icons.home },
  { to: '/agents', label: 'Mi Agente', icon: icons.phone },
  { to: '/calls', label: 'Llamadas', icon: icons.calls },
  { to: '/calendar', label: 'Calendario', icon: icons.calendar },
]

export default function Sidebar() {
  const { user, profile, signOut } = useAuth()
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
    <aside style={{ background: '#12131A', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      className="flex w-60 shrink-0 flex-col">

      {/* Logo */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        className="flex h-16 items-center px-6">
        <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#F1F0F5' }}>
          Mecan<span style={{ color: '#9B8FEF' }}>IA</span>
        </span>
      </div>

      {/* Taller badge */}
      <div style={{ margin: '10px', padding: '10px 12px', background: 'rgba(124,111,224,0.08)', border: '1px solid rgba(124,111,224,0.25)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '9px' }}>
        <div style={{ width: 30, height: 30, borderRadius: '8px', background: 'rgba(124,111,224,0.15)', border: '1px solid rgba(124,111,224,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🔧</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F0F5' }}>SRC Automoción</div>
          <div style={{ fontSize: 10, color: '#34D399', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', display: 'inline-block' }} />
            Agente activo
          </div>
        </div>
      </div>

      {/* Volver a admin si el usuario es admin */}
      {profile?.role === 'admin' && (
        <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Link to="/admin" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(124,111,224,0.08)', border: '1px solid rgba(124,111,224,0.2)', textDecoration: 'none', color: '#9B8FEF', fontSize: 11, fontWeight: 600 }}>
            ← Panel de administración
          </Link>
        </div>
      )}

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => isActive ? {
              background: 'rgba(124,111,224,0.12)',
              color: '#C4BCFF',
              border: '1px solid rgba(124,111,224,0.28)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12.5px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
            } : {
              color: '#8B8A99',
              border: '1px solid transparent',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '12.5px',
              fontWeight: 400,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
            }}
          >
            <span style={{ opacity: 0.7, display: 'flex', alignItems: 'center' }}>{item.icon}</span>{item.label}
          </NavLink>
        ))}
      </nav>

      {/* Usuario */}
      <div ref={ref} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
        {open && (
          <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#1E1F2B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', marginBottom: 4, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#7C6FE0,#C4BCFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{initials}</div>
              <span style={{ fontSize: 11, color: '#8B8A99', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</span>
            </div>
            <NavLink to="/settings" onClick={() => setOpen(false)} style={{ display: 'block', padding: '9px 14px', fontSize: 12, color: '#F1F0F5', textDecoration: 'none' }}>
              Ajustes
            </NavLink>
            <button type="button" onClick={handleSignOut} style={{ width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 12, color: '#F87171', background: 'none', border: 'none', cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              Cerrar sesión
            </button>
          </div>
        )}

        <button type="button" onClick={() => setOpen(v => !v)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#7C6FE0,#C4BCFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>
          <span style={{ flex: 1, textAlign: 'left', fontSize: 11, color: '#8B8A99', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</span>
          <span style={{ fontSize: 12, color: '#4A4960' }}>···</span>
        </button>
      </div>
    </aside>
  )
}
