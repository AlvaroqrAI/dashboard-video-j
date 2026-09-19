import { useEffect, useState } from 'react'
import { PageHeader, Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TICKET_MEDIO, PLAN_MENSUAL, COSTE_SECRETARIA_ANUAL } from '@/lib/constants'

interface ApptForRoi {
  appointment_date: string // yyyy-mm-dd
  appointment_time: string // HH:mm:ss
}

// Fuera de horario: mismo criterio que Dashboard.tsx (L-V 07:00–15:00, fin de semana = fuera).
function isApptOutOfHours(a: ApptForRoi): boolean {
  const dow = new Date(`${a.appointment_date}T00:00:00`).getDay()
  if (dow === 0 || dow === 6) return true
  const hour = parseInt(a.appointment_time.slice(0, 2), 10)
  return hour < 7 || hour >= 15
}

const DEMO_APPTS: ApptForRoi[] = [
  { appointment_date: '2026-08-03', appointment_time: '09:00' },
  { appointment_date: '2026-08-04', appointment_time: '10:30' },
  { appointment_date: '2026-08-05', appointment_time: '20:15' },
  { appointment_date: '2026-08-07', appointment_time: '11:00' },
  { appointment_date: '2026-08-08', appointment_time: '09:30' }, // sábado
  { appointment_date: '2026-08-10', appointment_time: '16:00' },
  { appointment_date: '2026-08-12', appointment_time: '08:15' },
]

const statBox: React.CSSProperties = { padding: '18px 22px', borderRight: '1px solid rgba(255,255,255,0.06)' }
const statLabel: React.CSSProperties = { fontSize: 11, color: '#8B8A99', marginBottom: 9 }
const statVal: React.CSSProperties = { fontSize: 23, fontWeight: 600, letterSpacing: '-0.015em', color: '#F1F0F5' }
const statDelta: React.CSSProperties = { fontSize: 11, color: '#4A4960', marginTop: 6 }
const statDeltaUp: React.CSSProperties = { ...statDelta, color: '#34D399' }

function fmtEUR(n: number) {
  return `${Math.round(n).toLocaleString('es-ES')} €`
}

// Planes de precio disponibles hoy (ver pricing-y-propuestas): 299€/mes sin permanencia,
// o 249€/mes con compromiso de 6-12 meses pagado por adelantado.
const PLANES_DISPONIBLES = [249, 299]

export default function Rentabilidad() {
  const { user } = useAuth()
  const [rawAppts, setRawAppts] = useState<ApptForRoi[]>([])
  const [loading, setLoading] = useState(true)
  const [planPrice, setPlanPrice] = useState<number>(PLAN_MENSUAL)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    supabase
      .from('appointments')
      .select('appointment_date,appointment_time')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .gte('appointment_date', from)
      .then(({ data }) => {
        setRawAppts((data ?? []) as ApptForRoi[])
        setLoading(false)
      })

    // Consulta aislada a propósito: si la columna plan_price aún no existe en Supabase
    // (migración 0010 sin aplicar todavía), esto falla en silencio y usamos el valor
    // por defecto — nunca debe poder romper el login ni el resto de la app.
    supabase
      .from('profiles')
      .select('plan_price')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data?.plan_price) setPlanPrice(data.plan_price)
      })
  }, [user])

  function selectPlan(price: number) {
    setPlanPrice(price)
    if (!user) return
    supabase.from('profiles').update({ plan_price: price }).eq('id', user.id).then(({ error }) => {
      if (error) console.warn('No se pudo guardar el plan seleccionado (¿falta aplicar la migración 0010?):', error.message)
    })
  }

  const appts = rawAppts.length > 0 ? rawAppts : DEMO_APPTS
  const isDemo = rawAppts.length === 0

  const citas = appts.length
  const ingresoMensual = citas * TICKET_MEDIO
  const fueraCitas = appts.filter(isApptOutOfHours).length
  const valorFueraHorario = fueraCitas * TICKET_MEDIO
  const costePorCita = citas > 0 ? planPrice / citas : null
  const ahorroAnual = (COSTE_SECRETARIA_ANUAL / 12 - planPrice) * 12
  const proyeccion12 = ingresoMensual * 12

  const comparativa = [
    { label: 'Coste anual', secretaria: fmtEUR(COSTE_SECRETARIA_ANUAL), mecania: fmtEUR(planPrice * 12) },
    { label: 'Horario', secretaria: 'L–V, 8h–16h', mecania: '24/7, 365 días' },
    { label: 'Bajas y vacaciones', secretaria: 'Hay que cubrirlas', mecania: 'Nunca' },
    { label: 'Escalar a más talleres', secretaria: 'Contratar y formar', mecania: 'Inmediato' },
    { label: 'Tiempo de respuesta', secretaria: 'Variable', mecania: '< 2 segundos' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="Rentabilidad"
        subtitle="Frente al coste de una recepcionista a jornada completa"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#4A4960' }}>Tu plan:</span>
            {PLANES_DISPONIBLES.map(p => (
              <button key={p} onClick={() => selectPlan(p)}
                style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  background: planPrice === p ? '#7C6FE0' : 'transparent',
                  borderColor: planPrice === p ? '#7C6FE0' : 'rgba(255,255,255,0.1)',
                  color: planPrice === p ? '#fff' : '#8B8A99',
                }}>
                {p} €/mes
              </button>
            ))}
          </div>
        }
      />

      {isDemo && !loading && (
        <div style={{ fontSize: 11, color: '#FBBF24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '6px 12px', display: 'inline-flex', alignSelf: 'flex-start' }}>
          Datos demo — se sustituyen por tus citas reales en cuanto Sara empiece a agendar
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={statBox}>
          <div style={statLabel}>Ahorro anual vs. secretaria</div>
          <div style={{ ...statVal, color: '#34D399' }}>+{fmtEUR(ahorroAnual)}</div>
          <div style={statDeltaUp}>Frente a 27.000 €/año</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Recuperado fuera de horario</div>
          <div style={statVal}>{fmtEUR(valorFueraHorario)}</div>
          <div style={statDelta}>{fueraCitas} citas que se habrían perdido sin 24/7</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Coste por cita conseguida</div>
          <div style={statVal}>{costePorCita !== null ? fmtEUR(costePorCita) : '—'}</div>
          <div style={statDelta}>Cuota del plan ÷ citas cerradas</div>
        </div>
        <div style={{ ...statBox, borderRight: 'none' }}>
          <div style={statLabel}>Facturación proyectada</div>
          <div style={statVal}>{fmtEUR(proyeccion12)}</div>
          <div style={statDelta}>A 12 meses, extrapolando los últimos 30 días</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#F1F0F5', marginBottom: 4 }}>Secretaria vs. MecanIA</div>
          <div style={{ fontSize: 11.5, color: '#4A4960', marginBottom: 16 }}>La comparación que ya usas en ventas, ahora dentro del panel</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '7px 8px 11px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#4A4960', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)' }} />
                <th style={{ textAlign: 'right', padding: '7px 8px 11px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#4A4960', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Secretaria</th>
                <th style={{ textAlign: 'right', padding: '7px 8px 11px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#4A4960', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>MecanIA</th>
              </tr>
            </thead>
            <tbody>
              {comparativa.map(row => (
                <tr key={row.label}>
                  <td style={{ padding: '11px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', color: '#F1F0F5', fontWeight: 500 }}>{row.label}</td>
                  <td style={{ padding: '11px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'right', color: '#4A4960', fontWeight: 500 }}>{row.secretaria}</td>
                  <td style={{ padding: '11px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'right', color: '#F1F0F5', fontWeight: 600 }}>{row.mecania}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#F1F0F5', marginBottom: 4 }}>Cómo se calcula</div>
          <div style={{ fontSize: 11.5, color: '#4A4960', marginBottom: 16 }}>Transparencia sobre de dónde salen estos números</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 12, color: '#8B8A99', lineHeight: 1.6 }}>
            <div>
              <strong style={{ color: '#F1F0F5' }}>Ahorro anual:</strong> coste medio de una recepcionista a jornada completa en España (27.000 €/año) menos tu cuota de MecanIA ({planPrice} €/mes).
            </div>
            <div>
              <strong style={{ color: '#F1F0F5' }}>Recuperado fuera de horario:</strong> citas cerradas por Sara fuera del horario habitual del taller (antes de las 7h, después de las 15h, o en fin de semana) × ticket medio ({TICKET_MEDIO} €).
            </div>
            <div>
              <strong style={{ color: '#F1F0F5' }}>Facturación proyectada:</strong> extrapolación lineal del ritmo de citas de los últimos 30 días. Es una estimación, no una previsión ajustada por estacionalidad.
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
