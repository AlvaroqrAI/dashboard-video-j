import { useEffect, useState } from 'react'
import { PageHeader, Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface ServiceRow {
  id: string
  name: string
  price_text: string | null
  duration_min: number
  requires_quote: boolean
  blocks_capacity: boolean
  operator: string | null
  active: boolean
}

// Catálogo de ejemplo — solo se muestra si el taller aún no ha cargado servicios reales.
const DEMO_SERVICES: ServiceRow[] = [
  { id: 'd1', name: 'Cambio de aceite y filtro', price_text: '65 €', duration_min: 30, requires_quote: false, blocks_capacity: true, operator: null, active: true },
  { id: 'd2', name: 'Revisión pre-ITV', price_text: '45 €', duration_min: 60, requires_quote: false, blocks_capacity: true, operator: null, active: true },
  { id: 'd3', name: 'Cambio de pastillas de freno', price_text: '95 €', duration_min: 45, requires_quote: false, blocks_capacity: true, operator: null, active: true },
  { id: 'd4', name: 'Cambio de neumáticos (par)', price_text: '180 €', duration_min: 50, requires_quote: false, blocks_capacity: true, operator: null, active: true },
  { id: 'd5', name: 'Carga de aire acondicionado', price_text: '55 €', duration_min: 40, requires_quote: false, blocks_capacity: true, operator: 'Cristian', active: true },
  { id: 'd6', name: 'Diagnóstico de avería', price_text: '30 €', duration_min: 30, requires_quote: false, blocks_capacity: true, operator: null, active: true },
  { id: 'd7', name: 'Cambio de correa de distribución', price_text: null, duration_min: 180, requires_quote: true, blocks_capacity: false, operator: null, active: true },
  { id: 'd8', name: 'Chapa y pintura', price_text: null, duration_min: 0, requires_quote: true, blocks_capacity: false, operator: null, active: true },
]

// Best-effort: extrae el primer número de un price_text tipo "65 €" o "20-25 €".
// Si no hay un número claro (a presupuestar), no cuenta para la media.
function parsePrice(priceText: string | null): number | null {
  if (!priceText) return null
  const match = priceText.replace(',', '.').match(/\d+(\.\d+)?/)
  return match ? parseFloat(match[0]) : null
}

const statBox: React.CSSProperties = { padding: '18px 22px', borderRight: '1px solid rgba(255,255,255,0.06)' }
const statLabel: React.CSSProperties = { fontSize: 11, color: '#8B8A99', marginBottom: 9 }
const statVal: React.CSSProperties = { fontSize: 23, fontWeight: 600, letterSpacing: '-0.015em', color: '#F1F0F5' }
const statDelta: React.CSSProperties = { fontSize: 11, color: '#4A4960', marginTop: 6 }

export default function Services() {
  const { user } = useAuth()
  const [rawServices, setRawServices] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    supabase
      .from('services')
      .select('id,name,price_text,duration_min,requires_quote,blocks_capacity,operator,active')
      .eq('user_id', user.id)
      .order('name', { ascending: true })
      .then(({ data }) => {
        setRawServices((data ?? []) as ServiceRow[])
        setLoading(false)
      })
  }, [user])

  const services = rawServices.length > 0 ? rawServices : DEMO_SERVICES
  const isDemo = rawServices.length === 0

  const activos = services.filter(s => s.active).length
  const conPresupuesto = services.filter(s => s.requires_quote).length
  const conPrecio = services.map(s => parsePrice(s.price_text)).filter((p): p is number => p !== null)
  const precioMedio = conPrecio.length ? Math.round(conPrecio.reduce((a, b) => a + b, 0) / conPrecio.length) : null
  const conDuracion = services.filter(s => s.duration_min > 0)
  const duracionMedia = conDuracion.length ? Math.round(conDuracion.reduce((a, b) => a + b.duration_min, 0) / conDuracion.length) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader title="Servicios" subtitle="Catálogo cargado en Sara para presupuestar y agendar" />

      {isDemo && !loading && (
        <div style={{ fontSize: 11, color: '#FBBF24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '6px 12px', display: 'inline-flex', alignSelf: 'flex-start' }}>
          Catálogo de ejemplo — carga tus servicios reales para que Sara los use en llamadas
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={statBox}>
          <div style={statLabel}>Servicios activos</div>
          <div style={statVal}>{activos}</div>
          <div style={statDelta}>Con precio y duración cargados</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Requieren presupuesto</div>
          <div style={statVal}>{conPresupuesto}</div>
          <div style={statDelta}>No bloquean agenda</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Precio medio</div>
          <div style={statVal}>{precioMedio !== null ? `${precioMedio} €` : '—'}</div>
          <div style={statDelta}>Servicios con precio fijo</div>
        </div>
        <div style={{ ...statBox, borderRight: 'none' }}>
          <div style={statLabel}>Duración media</div>
          <div style={statVal}>{duracionMedia} min</div>
          <div style={statDelta}>Ocupación por elevador</div>
        </div>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '15px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 12.5, fontWeight: 700, color: '#F1F0F5' }}>
          Catálogo de servicios
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Servicio', 'Precio', 'Duración', 'Operario asignado', 'Bloquea agenda', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#4A4960', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#F1F0F5' }}>{s.name}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: s.price_text ? '#8B8A99' : '#4A4960' }}>{s.price_text || 'A presupuestar'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#8B8A99' }}>{s.duration_min > 0 ? `${s.duration_min} min` : '—'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#8B8A99' }}>{s.operator || 'Cualquiera'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#8B8A99' }}>{s.blocks_capacity ? 'Sí' : 'No'}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#8B8A99', fontWeight: 500 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.active ? '#34D399' : '#4A4960', display: 'inline-block' }} />
                      {s.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
