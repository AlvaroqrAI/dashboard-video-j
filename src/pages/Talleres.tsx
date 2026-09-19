import { PageHeader, Card } from '@/components/ui/Card'

// Página puramente informativa — sin consultas a Supabase. La gestión multi-taller
// (varias sedes bajo una misma cuenta) todavía no existe en el modelo de datos;
// esto solo comunica que está en camino, no simula sedes que no existen.
export default function Talleres() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader title="Talleres" subtitle="Gestión multi-sede" />

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#FBBF24' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#FBBF24', display: 'inline-block' }} />
          En desarrollo
        </div>
        <div style={{ fontSize: 11.5, color: '#4A4960', marginTop: 14, lineHeight: 1.6 }}>
          Próximamente podrás gestionar varios talleres bajo una misma cuenta MecanIA, con métricas y agentes independientes por sede.
        </div>
      </Card>
    </div>
  )
}
