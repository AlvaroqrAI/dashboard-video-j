import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

const icons: Record<string, React.ReactElement> = {
  home: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  phone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6.6 10.8a15.05 15.05 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.56.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.56 3.57a1 1 0 0 1-.25 1.02L6.6 10.8z"/></svg>,
  robot: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V5"/><circle cx="12" cy="3.5" r="1.2"/><circle cx="9" cy="13" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1" fill="currentColor" stroke="none"/><path d="M9.5 17h5"/><path d="M4 12H2.5M21.5 12H20"/></svg>,
  calendar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  wrench: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 4.9L4 16.5V20h3.5l5.3-5.3a4 4 0 0 0 4.9-5.4l-2.6 2.6-2-2 2.6-2.6Z"/></svg>,
  trend: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 16 9.5 10.2 13.5 14 20 6.5"/><path d="M14.5 6.5H20V12"/></svg>,
  chat: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-4 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z"/></svg>,
  grid: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>,
  clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>,
  ring: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/><path d="M6.2 6.2l3.4 3.4M17.8 6.2l-3.4 3.4M6.2 17.8l3.4-3.4M17.8 17.8l-3.4-3.4"/></svg>,
  building: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 21v-4h6v4M8 7h1M15 7h1M8 11h1M15 11h1M8 15h1M15 15h1"/></svg>,
  gear: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>,
  car: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 16V11l2-5h12l2 5v5"/><path d="M4 16h16M6 16v2M18 16v2"/><circle cx="7.5" cy="16" r="1.3"/><circle cx="16.5" cy="16" r="1.3"/></svg>,
}

interface NavItem { to: string; label: string; end?: boolean; icon: React.ReactElement; tag?: string; dot?: string }

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Actividad',
    items: [
      { to: '/', label: 'Inicio', end: true, icon: icons.grid, dot: '#34D399' },
      { to: '/calls', label: 'Llamadas', icon: icons.phone },
      { to: '/conversaciones', label: 'Conversaciones', icon: icons.chat, tag: 'En desarrollo' },
      { to: '/calendar', label: 'Calendario', icon: icons.calendar },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { to: '/agents', label: 'Mi Agente', icon: icons.robot },
      { to: '/services', label: 'Servicios', icon: icons.wrench },
      { to: '/reparaciones', label: 'Reparaciones', icon: icons.car },
      { to: '/horarios', label: 'Horarios', icon: icons.clock },
    ],
  },
  {
    label: 'Analítica',
    items: [
      { to: '/rentabilidad', label: 'Rentabilidad', icon: icons.trend },
    ],
  },
  {
    label: 'Soporte',
    items: [
      { to: '/tickets', label: 'Tickets', icon: icons.ring },
    ],
  },
]

const bottomItems: NavItem[] = [
  { to: '/talleres', label: 'Talleres', icon: icons.building },
  { to: '/settings', label: 'Configuración', icon: icons.gear },
]

export default function Sidebar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const [indicator, setIndicator] = useState<{ top: number; height: number } | null>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useLayoutEffect(() => {
    const navEl = navRef.current
    const activeEl = navEl?.querySelector<HTMLElement>('a[aria-current="page"]')
    if (!navEl || !activeEl) { setIndicator(null); return }
    const navRect = navEl.getBoundingClientRect()
    const elRect = activeEl.getBoundingClientRect()
    setIndicator({ top: elRect.top - navRect.top + navEl.scrollTop, height: elRect.height })
  }, [location.pathname])

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
      <div style={{ margin: '10px', padding: '9px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '9px' }}>
        <div style={{ width: 26, height: 26, borderRadius: '6px', background: '#131318', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B8A99', flexShrink: 0 }}>{icons.wrench}</div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#F1F0F5' }}>{profile?.full_name || 'Mi taller'}</div>
          <div style={{ fontSize: 10, color: '#4A4960', marginTop: 1 }}>
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
      <nav ref={navRef} className="flex flex-1 flex-col p-3" style={{ overflowY: 'auto', position: 'relative' }}>
        {indicator && (
          <div style={{
            position: 'absolute',
            left: 12,
            right: 12,
            top: indicator.top,
            height: indicator.height,
            background: '#7C6FE0',
            borderRadius: 8,
            transition: 'top 220ms cubic-bezier(0.4,0,0.2,1), height 220ms cubic-bezier(0.4,0,0.2,1)',
            pointerEvents: 'none',
            zIndex: 0,
          }} />
        )}
        {navGroups.map((group, gi) => (
          <div key={group.label} style={{ marginTop: gi === 0 ? 0 : 16 }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.12em', padding: '0 10px 6px' }}>
              {group.label}
            </div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={({ isActive }) => isActive ? {
                  position: 'relative',
                  zIndex: 1,
                  background: 'transparent',
                  color: '#fff',
                  border: '1px solid transparent',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  textDecoration: 'none',
                  marginBottom: 1,
                  transition: 'color 150ms ease',
                } : {
                  position: 'relative',
                  zIndex: 1,
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
                  marginBottom: 1,
                  transition: 'color 150ms ease',
                }}
              >
                {({ isActive }) => (
                  <>
                    <span style={{ opacity: 0.7, display: 'flex', alignItems: 'center' }}>{item.icon}</span>{item.label}
                    {item.tag && <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: isActive ? 'rgba(255,255,255,0.85)' : '#9B8FEF' }}>{item.tag}</span>}
                    {item.dot && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: item.dot, display: 'inline-block' }} />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}

        {/* Talleres / Configuración — fuera de los grupos, como en la maqueta */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {bottomItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                position: 'relative',
                zIndex: 1,
                color: isActive ? '#fff' : '#8B8A99',
                border: '1px solid transparent',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12.5px',
                fontWeight: isActive ? 600 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                marginBottom: 1,
                transition: 'color 150ms ease',
              })}
            >
              <span style={{ opacity: 0.7, display: 'flex', alignItems: 'center' }}>{item.icon}</span>{item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Usuario */}
      <div ref={ref} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
        {open && (
          <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#1E1F2B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', marginBottom: 4, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1B1B22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#8B8A99' }}>{initials}</div>
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
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1B1B22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#8B8A99', flexShrink: 0 }}>{initials}</div>
          <span style={{ flex: 1, textAlign: 'left', fontSize: 11, color: '#8B8A99', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</span>
          <span style={{ fontSize: 12, color: '#4A4960' }}>···</span>
        </button>
      </div>
    </aside>
  )
}
