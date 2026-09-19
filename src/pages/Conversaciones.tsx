import { PageHeader, Card } from '@/components/ui/Card'

// Página puramente informativa — sin consultas a Supabase. El canal de WhatsApp
// (agente "Álex") está bloqueado por la verificación de Meta Business; hasta que
// esté activo, esto solo comunica el estado, no simula datos que no existen.
export default function Conversaciones() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader title="Conversaciones" subtitle="WhatsApp · Álex" />

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1E1F2B', color: '#8B8A99', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>A</div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F1F0F5' }}>Álex</div>
            <div style={{ fontSize: 10.5, color: '#4A4960', marginTop: 1 }}>Asistente de WhatsApp</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#FBBF24' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
            En desarrollo
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: '#4A4960', marginTop: 14, lineHeight: 1.6 }}>
          Mismo motor que Sara — mismos servicios, disponibilidad y calendario — en un canal de texto. Pensado para clientes que prefieren escribir antes que llamar.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ padding: '14px 4px 0', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, color: '#4A4960', marginBottom: 6 }}>Lanzamiento previsto</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#F1F0F5' }}>Finales de septiembre</div>
          </div>
          <div style={{ padding: '14px 4px 0', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 10, color: '#4A4960', marginBottom: 6 }}>Motivo</div>
            <div style={{ fontSize: 11.5, color: '#8B8A99' }}>Junta anual Driver, 320 talleres</div>
          </div>
          <div style={{ padding: '14px 4px 0' }}>
            <div style={{ fontSize: 10, color: '#4A4960', marginBottom: 6 }}>Bloqueo actual</div>
            <div style={{ fontSize: 11.5, color: '#FBBF24' }}>Verificación de Meta Business</div>
          </div>
        </div>
      </Card>
    </div>
  )
}
