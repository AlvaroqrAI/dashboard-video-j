import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader, Card } from '@/components/ui/Card'
import { SkeletonStatRow, SkeletonTableRows } from '@/components/ui/Skeleton'
import { supabase, invokeFunction } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'

type Status = 'recibido' | 'diagnostico' | 'en_reparacion' | 'listo' | 'entregado'

interface Vehicle {
  id: string
  plate: string
  car_model: string | null
  client_name: string | null
  client_phone: string | null
}

interface Repair {
  id: string
  status: Status
  description: string | null
  sms_sent_at: string | null
  updated_at: string
  vehicle: Vehicle | null
}

const STATUS_ORDER: Status[] = ['recibido', 'diagnostico', 'en_reparacion', 'listo', 'entregado']
const STATUS_LABEL: Record<Status, string> = { recibido: 'Recibido', diagnostico: 'Diagnóstico', en_reparacion: 'En reparación', listo: 'Listo', entregado: 'Entregado' }
const STATUS_COLOR: Record<Status, string> = { recibido: '#8B8A99', diagnostico: '#9B8FEF', en_reparacion: '#FBBF24', listo: '#34D399', entregado: '#4A4960' }

const statBox: React.CSSProperties = { padding: '18px 22px', borderRight: '1px solid rgba(255,255,255,0.06)' }
const statLabel: React.CSSProperties = { fontSize: 11, color: '#8B8A99', marginBottom: 9 }
const statVal: React.CSSProperties = { fontSize: 23, fontWeight: 600, letterSpacing: '-0.015em', color: '#F1F0F5' }
const statDelta: React.CSSProperties = { fontSize: 11, color: '#4A4960', marginTop: 6 }
const inp: React.CSSProperties = { width: '100%', background: '#0D0E14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#F1F0F5', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const fieldLbl: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5, display: 'block' }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function normalizePlate(p: string) { return p.toUpperCase().replace(/[\s-]/g, '') }

export default function Reparaciones() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [repairs, setRepairs] = useState<Repair[]>([])
  const [vehicleCount, setVehicleCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ plate: '', car_model: '', client_name: '', client_phone: '', description: '' })

  const load = () => {
    if (!user) return
    setLoading(true); setError(null)
    supabase.from('repairs')
      .select('id, status, description, sms_sent_at, updated_at, vehicle:vehicles(id, plate, car_model, client_name, client_phone)')
      .eq('user_id', user.id).order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setRepairs((data ?? []) as unknown as Repair[])
        setLoading(false)
      })
    supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setVehicleCount(count ?? 0))
  }

  useEffect(load, [user])

  const counts = useMemo(() => ({
    activas: repairs.filter(r => r.status === 'recibido' || r.status === 'diagnostico' || r.status === 'en_reparacion').length,
    listas: repairs.filter(r => r.status === 'listo').length,
    entregadas: repairs.filter(r => r.status === 'entregado').length,
  }), [repairs])

  async function moveStatus(repair: Repair, newStatus: Status) {
    if (repair.status === newStatus) return
    const prev = repair.status
    setRepairs(rs => rs.map(r => r.id === repair.id ? { ...r, status: newStatus } : r))
    const { error } = await supabase.from('repairs')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', repair.id)
    if (error) {
      setRepairs(rs => rs.map(r => r.id === repair.id ? { ...r, status: prev } : r))
      showToast('No se pudo actualizar el estado', 'error')
      return
    }
    if (newStatus === 'listo' && !repair.sms_sent_at && repair.vehicle?.client_phone) {
      const v = repair.vehicle
      const msg = `Hola${v.client_name ? ' ' + v.client_name : ''}, tu ${v.car_model || 'vehículo'} (matrícula ${v.plate}) ya está listo para recoger. ¡Te esperamos!`
      try {
        const res = await invokeFunction<{ sent: boolean; reason?: string }>('send-sms', { to: v.client_phone, message: msg })
        if (res.sent) {
          await supabase.from('repairs').update({ sms_sent_at: new Date().toISOString() }).eq('id', repair.id)
          setRepairs(rs => rs.map(r => r.id === repair.id ? { ...r, sms_sent_at: new Date().toISOString() } : r))
          showToast('Estado actualizado y SMS enviado al cliente')
        } else {
          showToast('Estado actualizado — el envío de SMS todavía no está conectado')
        }
      } catch {
        showToast('Estado actualizado — el envío de SMS todavía no está conectado')
      }
    } else {
      showToast(`Movido a "${STATUS_LABEL[newStatus]}"`)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !form.plate.trim() || !form.description.trim()) return
    setSubmitting(true)
    const plate = normalizePlate(form.plate)
    const { data: vehicle, error: vErr } = await supabase.from('vehicles')
      .upsert({
        user_id: user.id, plate,
        car_model: form.car_model.trim() || null,
        client_name: form.client_name.trim() || null,
        client_phone: form.client_phone.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,plate' })
      .select('id, plate, car_model, client_name, client_phone').single()

    if (vErr || !vehicle) { setSubmitting(false); setError(vErr?.message ?? 'No se pudo guardar el vehículo'); return }

    const { data: repair, error: rErr } = await supabase.from('repairs')
      .insert({ user_id: user.id, vehicle_id: vehicle.id, description: form.description.trim(), status: 'recibido' })
      .select('id, status, description, sms_sent_at, updated_at').single()

    setSubmitting(false)
    if (rErr || !repair) { setError(rErr?.message ?? 'No se pudo crear la reparación'); return }

    setRepairs(rs => [{ ...repair, vehicle } as Repair, ...rs])
    setForm({ plate: '', car_model: '', client_name: '', client_phone: '', description: '' })
    setShowForm(false)
    showToast('Reparación creada')
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="Reparaciones"
        subtitle="Estado de cada vehículo — el agente lo consulta si el cliente pregunta, y se avisa por SMS cuando está listo."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={load} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#F1F0F5', cursor: 'pointer', fontFamily: 'inherit' }}>
              Actualizar
            </button>
            <button type="button" onClick={() => setShowForm(true)} style={{ background: '#7C6FE0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Nueva reparación
            </button>
          </div>
        }
      />

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '10px 16px', fontSize: 12, color: '#F87171' }}>{error}</div>
      )}

      {loading ? (
        <>
          <SkeletonStatRow />
          <SkeletonTableRows rows={5} cols={5} />
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={statBox}>
              <div style={statLabel}>Reparaciones activas</div>
              <div style={statVal}>{counts.activas}</div>
              <div style={statDelta}>Recibido, diagnóstico o en reparación</div>
            </div>
            <div style={statBox}>
              <div style={statLabel}>Listas para recoger</div>
              <div style={{ ...statVal, color: counts.listas > 0 ? '#34D399' : '#F1F0F5' }}>{counts.listas}</div>
              <div style={statDelta}>Cliente avisado por SMS</div>
            </div>
            <div style={statBox}>
              <div style={statLabel}>Entregadas</div>
              <div style={statVal}>{counts.entregadas}</div>
              <div style={statDelta}>Histórico</div>
            </div>
            <div style={{ ...statBox, borderRight: 'none' }}>
              <div style={statLabel}>Vehículos registrados</div>
              <div style={statVal}>{vehicleCount}</div>
              <div style={statDelta}>Reconocidos por matrícula</div>
            </div>
          </div>

          <Card>
            {repairs.length === 0 ? (
              <div style={{ padding: '32px 24px', textAlign: 'center', fontSize: 12, color: '#4A4960' }}>
                Todavía no hay reparaciones registradas. Crea la primera.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Vehículo', 'Cliente', 'Descripción', 'Estado', 'Actualizado'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {repairs.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F0F5', fontFamily: 'monospace' }}>{r.vehicle?.plate ?? '—'}</div>
                        {r.vehicle?.car_model && <div style={{ fontSize: 11, color: '#8B8A99', marginTop: 2 }}>{r.vehicle.car_model}</div>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 12, color: '#F1F0F5' }}>{r.vehicle?.client_name || '—'}</div>
                        {r.vehicle?.client_phone && <div style={{ fontSize: 11, color: '#8B8A99', marginTop: 2, fontFamily: 'monospace' }}>{r.vehicle.client_phone}</div>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#C4C3D0', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <select value={r.status} onChange={e => moveStatus(r, e.target.value as Status)}
                          style={{ background: '#0D0E14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '5px 8px', fontSize: 11.5, fontWeight: 600, color: STATUS_COLOR[r.status], fontFamily: 'inherit', cursor: 'pointer' }}>
                          {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#8B8A99' }}>{fmtDate(r.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}

      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: '#181922', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#F1F0F5', marginBottom: 16 }}>Nueva reparación</div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <span style={fieldLbl}>Matrícula</span>
                  <input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} required style={inp} placeholder="1234 BCD" />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={fieldLbl}>Modelo</span>
                  <input value={form.car_model} onChange={e => setForm(f => ({ ...f, car_model: e.target.value }))} style={inp} placeholder="Seat León" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <span style={fieldLbl}>Cliente</span>
                  <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} style={inp} placeholder="Nombre" />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={fieldLbl}>Teléfono</span>
                  <input value={form.client_phone} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))} style={inp} placeholder="+34…" />
                </div>
              </div>
              <div>
                <span style={fieldLbl}>Descripción de la avería</span>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required rows={3} style={{ ...inp, resize: 'vertical' as const }} placeholder="Qué necesita el vehículo…" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#F1F0F5', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                <button type="submit" disabled={submitting} style={{ background: '#7C6FE0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, fontFamily: 'inherit' }}>
                  {submitting ? 'Creando…' : 'Crear reparación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
