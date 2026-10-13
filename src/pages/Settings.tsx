import { useEffect, useState } from 'react'
import { PageHeader, Card } from '@/components/ui/Card'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { DEMO_MODE } from '@/lib/demo'
import { DAY_KEYS, DAY_LABELS, TIMEZONES, useBusinessHours, type BusinessHours, type DayKey } from '@/lib/businessHours'

const cardTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#F1F0F5' }
const cardSub: React.CSSProperties = { fontSize: 11, color: '#4A4960', marginTop: 2, lineHeight: 1.5 }
const fieldLbl: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }
const timeInp: React.CSSProperties = { background: '#0D0E14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#F1F0F5', fontFamily: 'inherit', outline: 'none', colorScheme: 'dark' }

export default function Settings() {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const { hours: saved, loading, setHours: setSaved } = useBusinessHours()
  const [draft, setDraft] = useState<BusinessHours>(saved)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setDraft(saved) }, [saved])

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  function setDay(key: DayKey, value: { open: string; close: string } | null) {
    setDraft(d => ({ ...d, days: { ...d.days, [key]: value } }))
  }

  async function save() {
    setError(null)
    for (const k of DAY_KEYS) {
      const d = draft.days[k]
      if (d && d.close <= d.open) { setError(`${DAY_LABELS[k]}: la hora de cierre debe ser posterior a la de apertura.`); return }
    }
    if (DEMO_MODE) { setSaved(draft); showToast('Modo demo: el horario no se guarda en la base de datos'); return }
    if (!user) return
    setSaving(true)
    const { error: err } = await supabase.from('profiles').update({ business_hours: draft }).eq('id', user.id)
    setSaving(false)
    if (err) { setError('No se pudo guardar el horario. Inténtalo de nuevo.'); return }
    setSaved(draft)
    showToast('Horario del taller guardado')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <PageHeader title="Ajustes" subtitle="Tu cuenta y el horario de tu taller" />

      <Card>
        <div style={{ ...cardTitle, marginBottom: 14 }}>Cuenta</div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div style={fieldLbl}>Nombre</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F1F0F5' }}>{profile?.full_name || '—'}</div>
          </div>
          <div>
            <div style={fieldLbl}>Email</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F1F0F5' }}>{user?.email || '—'}</div>
          </div>
        </div>
      </Card>

      <Card>
        <div style={cardTitle}>Horario del taller</div>
        <div style={{ ...cardSub, marginBottom: 16 }}>
          Define cuándo está abierto tu taller. El panel lo usa para calcular las llamadas y citas fuera de horario, el ROI y el análisis de horarios. El horario que el agente da por teléfono se configura en el propio agente: si lo cambias aquí, avísanos para actualizarlo también allí.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', opacity: loading ? 0.5 : 1 }}>
          {DAY_KEYS.map(k => {
            const d = draft.days[k]
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ width: 92, fontSize: 12.5, color: d ? '#F1F0F5' : '#4A4960' }}>{DAY_LABELS[k]}</span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#8B8A99', cursor: 'pointer', width: 86 }}>
                  <input type="checkbox" checked={!!d} style={{ accentColor: '#7C6FE0' }}
                    onChange={e => setDay(k, e.target.checked ? { open: '09:00', close: '18:00' } : null)} />
                  {d ? 'Abierto' : 'Cerrado'}
                </label>
                {d && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="time" value={d.open} style={timeInp} aria-label={`${DAY_LABELS[k]} apertura`}
                      onChange={e => setDay(k, { ...d, open: e.target.value })} />
                    <span style={{ fontSize: 11, color: '#4A4960' }}>a</span>
                    <input type="time" value={d.close} style={timeInp} aria-label={`${DAY_LABELS[k]} cierre`}
                      onChange={e => setDay(k, { ...d, close: e.target.value })} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={fieldLbl}>Zona horaria</div>
            <select value={draft.tz} onChange={e => setDraft(d => ({ ...d, tz: e.target.value }))}
              style={{ ...timeInp, padding: '7px 10px', cursor: 'pointer' }}>
              {TIMEZONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => { setDraft(saved); setError(null) }} disabled={!dirty || saving}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#F1F0F5', cursor: 'pointer', fontFamily: 'inherit', opacity: !dirty || saving ? 0.4 : 1 }}>
              Descartar
            </button>
            <button type="button" onClick={save} disabled={!dirty || saving}
              style={{ background: '#7C6FE0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', opacity: !dirty || saving ? 0.4 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar horario'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#F87171' }}>{error}</div>
        )}
      </Card>

      <Card>
        <div style={cardTitle}>Integración de voz</div>
        <div style={cardSub}>
          La integración con la plataforma de voz la gestiona tu proveedor. Si necesitas cambios en tus agentes, contacta con tu administrador.
        </div>
      </Card>
    </div>
  )
}
