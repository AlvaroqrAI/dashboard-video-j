import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader, Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { SkeletonStatRow, SkeletonTableRows } from '@/components/ui/Skeleton'

interface Ticket {
  id: string
  subject: string
  message: string
  status: 'open' | 'in_progress' | 'closed'
  created_at: string
}

type Filter = 'all' | Ticket['status']

const STATUS_LABEL: Record<Ticket['status'], string> = { open: 'Abierto', in_progress: 'En progreso', closed: 'Cerrado' }
const STATUS_COLOR: Record<Ticket['status'], string> = { open: '#FBBF24', in_progress: '#9B8FEF', closed: '#34D399' }

const statBox: React.CSSProperties = { padding: '18px 22px', borderRight: '1px solid rgba(255,255,255,0.06)' }
const statLabel: React.CSSProperties = { fontSize: 11, color: '#8B8A99', marginBottom: 9 }
const statVal: React.CSSProperties = { fontSize: 23, fontWeight: 600, letterSpacing: '-0.015em', color: '#F1F0F5' }
const statDelta: React.CSSProperties = { fontSize: 11, color: '#4A4960', marginTop: 6 }
const inp: React.CSSProperties = { width: '100%', background: '#0D0E14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, color: '#F1F0F5', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const fieldLbl: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5, display: 'block' }

const ringIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.2" />
    <path d="M6.2 6.2l3.4 3.4M17.8 6.2l-3.4 3.4M6.2 17.8l3.4-3.4M17.8 17.8l-3.4-3.4" />
  </svg>
)

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function Tickets() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    if (!user) return
    setLoading(true); setError(null)
    supabase.from('tickets').select('id, subject, message, status, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setTickets((data ?? []) as Ticket[])
        setLoading(false)
      })
  }

  useEffect(load, [user])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !subject.trim() || !message.trim()) return
    setSubmitting(true)
    const { data, error } = await supabase.from('tickets')
      .insert({ user_id: user.id, subject: subject.trim(), message: message.trim() })
      .select('id, subject, message, status, created_at').single()
    setSubmitting(false)
    if (error) { setError(error.message); return }
    if (data) setTickets(t => [data as Ticket, ...t])
    setSubject(''); setMessage(''); setShowForm(false)
    showToast('Ticket creado — te responderemos en breve')
  }

  const counts = useMemo(() => ({
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  }), [tickets])

  const resolvedPct = counts.all > 0 ? Math.round((counts.closed / counts.all) * 100) : 0

  const visible = tickets
    .filter(t => filter === 'all' || t.status === filter)
    .filter(t => !search.trim() || t.subject.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="Tickets"
        subtitle="Consulta tus solicitudes anteriores y abre tickets nuevos para el equipo."
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={load} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#F1F0F5', cursor: 'pointer', fontFamily: 'inherit' }}>
              Actualizar
            </button>
            <button type="button" onClick={() => setShowForm(true)} style={{ background: '#7C6FE0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Nueva solicitud
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
          <SkeletonTableRows rows={5} cols={4} />
        </>
      ) : (
        <>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={statBox}>
          <div style={statLabel}>Tickets totales</div>
          <div style={statVal}>{counts.all}</div>
          <div style={statDelta}>Desde el inicio del proyecto</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Abiertos</div>
          <div style={{ ...statVal, color: counts.open > 0 ? '#FBBF24' : '#F1F0F5' }}>{counts.open}</div>
          <div style={statDelta}>{counts.open > 0 ? `${counts.open} requieren respuesta` : 'Nada pendiente'}</div>
        </div>
        <div style={statBox}>
          <div style={statLabel}>Tiempo medio</div>
          <div style={statVal}>—</div>
          <div style={statDelta}>Sin respuestas todavía</div>
        </div>
        <div style={{ ...statBox, borderRight: 'none' }}>
          <div style={statLabel}>Resueltos</div>
          <div style={{ ...statVal, color: counts.closed > 0 ? '#34D399' : '#F1F0F5' }}>{counts.closed}</div>
          <div style={statDelta}>{resolvedPct}% del total</div>
        </div>
      </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, alignItems: 'start' }}>

          {/* Filtros */}
          <Card style={{ padding: 10 }}>
            {([['all', 'Todos'], ['open', 'Abiertos'], ['in_progress', 'En progreso'], ['closed', 'Cerrados']] as [Filter, string][]).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setFilter(key)}
                style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: filter === key ? 'rgba(124,111,224,0.12)' : 'transparent',
                  color: filter === key ? '#C4BCFF' : '#8B8A99', fontSize: 12.5, fontWeight: filter === key ? 600 : 500, marginBottom: 2,
                }}>
                {label}
                <span style={{ fontSize: 11, color: '#4A4960' }}>{counts[key]}</span>
              </button>
            ))}
          </Card>

          {/* Lista */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F0F5' }}>Solicitudes de soporte</div>
                <div style={{ fontSize: 11, color: '#4A4960', marginTop: 2 }}>Historial completo de tus tickets</div>
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por asunto…"
                style={{ background: '#0D0E14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#F1F0F5', fontFamily: 'inherit', outline: 'none', minWidth: 200 }} />
            </div>

            {visible.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ width: 44, height: 44, margin: '0 auto 14px', borderRadius: '50%', background: '#131318', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A4960' }}>
                  {ringIcon}
                </div>
                <p style={{ fontSize: 12, color: '#4A4960' }}>
                  {tickets.length === 0 ? 'Todavía no hay tickets. Crea el primero.' : 'Ningún ticket coincide con el filtro.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {visible.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#F1F0F5' }}>{t.subject}</div>
                      <div style={{ fontSize: 11, color: '#8B8A99', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 420 }}>{t.message}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: STATUS_COLOR[t.status] }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[t.status], display: 'inline-block' }} />
                        {STATUS_LABEL[t.status]}
                      </span>
                      <span style={{ fontSize: 10, color: '#4A4960' }}>{fmtDate(t.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
        </>
      )}

      {/* Modal nueva solicitud */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: '#181922', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 22 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: '#F1F0F5', marginBottom: 16 }}>Nueva solicitud</div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <span style={fieldLbl}>Asunto</span>
                <input value={subject} onChange={e => setSubject(e.target.value)} required style={inp} placeholder="¿En qué podemos ayudarte?" />
              </div>
              <div>
                <span style={fieldLbl}>Mensaje</span>
                <textarea value={message} onChange={e => setMessage(e.target.value)} required rows={4} style={{ ...inp, resize: 'vertical' as const }} placeholder="Cuéntanos con detalle qué necesitas…" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#F1F0F5', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                <button type="submit" disabled={submitting} style={{ background: '#7C6FE0', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, fontFamily: 'inherit' }}>
                  {submitting ? 'Enviando…' : 'Enviar solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
