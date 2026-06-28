import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Topbar from './Topbar'
import { useAuth } from '@/context/AuthContext'

const navIcons: Record<string, React.ReactElement> = {
  metrics: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  clients: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  agents: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.6 10.8a15.05 15.05 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.56.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.56 3.57a1 1 0 0 1-.25 1.02L6.6 10.8z"/></svg>,
  plans: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  alerts: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
}

const nav = [
  { to: '/admin', label: 'Métricas globales', end: true, iconKey: 'metrics' },
  { to: '/admin/clients', label: 'Clientes', iconKey: 'clients' },
  { to: '/admin/agents', label: 'Agentes', iconKey: 'agents' },
  { to: '/admin/plans', label: 'Planes y precios', iconKey: 'plans' },
  { to: '/admin/alerts', label: 'Alertas', iconKey: 'alerts' },
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
    document.title = `${match?.label ?? 'Admin'} · Admin · MecanIA`
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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0D0E14' }}>
      <aside style={{ width: 240, flexShrink: 0, background: '#12131A', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>

        {/* Logo */}
        <div style={{ height: 64, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#F1F0F5' }}>
            Mecan<span style={{ color: '#9B8FEF' }}>IA</span>
          </span>
          <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 600, background: 'rgba(124,111,224,0.15)', color: '#9B8FEF', border: '1px solid rgba(124,111,224,0.3)', borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: 12 }}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => isActive ? {
                background: 'rgba(124,111,224,0.12)',
                color: '#C4BCFF',
                border: '1px solid rgba(124,111,224,0.28)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12.5,
                fontWeight: 500,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              } : {
                color: '#8B8A99',
                border: '1px solid transparent',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12.5,
                fontWeight: 400,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ opacity: 0.7, display: 'flex', alignItems: 'center' }}>{navIcons[item.iconKey]}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Usuario */}
        <div ref={ref} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
          {open && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#1E1F2B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, marginBottom: 4, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#7C6FE0,#C4BCFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>{initials}</div>
                <span style={{ fontSize: 11, color: '#8B8A99', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</span>
              </div>
              <NavLink to="/admin/settings" onClick={() => setOpen(false)} style={{ display: 'block', padding: '9px 14px', fontSize: 12, color: '#F1F0F5', textDecoration: 'none' }}>
                Ajustes
              </NavLink>
              <button type="button" onClick={handleSignOut} style={{ width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 12, color: '#F87171', background: 'none', border: 'none', cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.06)', fontFamily: 'inherit' }}>
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

      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />
        <main style={{ flex: 1, overflowY: 'auto', background: '#0D0E14', padding: '24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
