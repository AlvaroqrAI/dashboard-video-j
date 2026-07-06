import { useAuth } from '@/context/AuthContext'

export default function Settings() {
  const { user, profile } = useAuth()

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: '#7C6FE0', textTransform: 'uppercase', marginBottom: 4 }}>MECANIA</p>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#F1F0F5', letterSpacing: '-0.02em' }}>Ajustes</h1>
        <p style={{ fontSize: 13, color: '#4A4960', marginTop: 4 }}>Información de tu cuenta</p>
      </div>

      {/* Cuenta */}
      <div style={{ background: '#13141C', border: '1px solid #2A2B35', borderRadius: 12, padding: '1.5rem', maxWidth: 560, marginBottom: '1.5rem' }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#4A4960', textTransform: 'uppercase', marginBottom: '1.2rem' }}>CUENTA</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: '#4A4960', textTransform: 'uppercase', marginBottom: 4 }}>NOMBRE</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#F1F0F5' }}>{profile?.full_name || '—'}</p>
          </div>
          <div style={{ height: 1, background: '#2A2B35' }} />
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: '#4A4960', textTransform: 'uppercase', marginBottom: 4 }}>EMAIL</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#F1F0F5' }}>{user?.email || '—'}</p>
          </div>
        </div>
      </div>

      {/* Integración de voz */}
      <div style={{ background: '#13141C', border: '1px solid #2A2B35', borderRadius: 12, padding: '1.5rem', maxWidth: 560 }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#4A4960', textTransform: 'uppercase', marginBottom: '0.8rem' }}>INTEGRACIÓN DE VOZ</p>
        <p style={{ fontSize: 13, color: '#4A4960', lineHeight: 1.6 }}>
          La integración con la plataforma de voz la gestiona tu proveedor. Si necesitas cambios en tus agentes, contacta con tu administrador.
        </p>
      </div>
    </div>
  )
}
