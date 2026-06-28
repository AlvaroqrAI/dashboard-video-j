import { useLocation } from 'react-router-dom'

const pageLabels: Record<string, string> = {
  '/': 'Inicio',
  '/agents': 'Mi Agente',
  '/calls': 'Llamadas',
  '/calendar': 'Calendario',
  '/billing': 'Facturación',
  '/settings': 'Ajustes',
}

export default function Topbar() {
  const location = useLocation()
  const label = pageLabels[location.pathname] ?? 'Dashboard'

  return (
    <header style={{ height: 50, background: '#12131A', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: '#4A4960' }}>Panel /</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#F1F0F5' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(124,111,224,0.1)', border: '1px solid rgba(124,111,224,0.25)', color: '#9B8FEF', padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 600 }}>
          🔧 SRC AUTOMOCIÓN
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#34D399' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', display: 'inline-block', animation: 'pulse 2s infinite' }} />
        En vivo
      </div>
    </header>
  )
}
