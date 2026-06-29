import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

interface CallRow {
  call_id: string
  agent_id: string | null
  agent_name: string | null
  direction: string | null
  from_number: string | null
  to_number: string | null
  duration_ms: number | null
  start_timestamp: string | null
  disconnection_reason: string | null
  recording_url: string | null
  transcript: string | null
  call_summary: string | null
  user_sentiment: string | null
  call_successful: boolean | null
  call_reason: string | null
}

interface AgentOption { retell_agent_id: string | null; name: string }

interface Filters {
  search: string; callId: string; agentId: string; direction: string
  sentiment: string; result: string; fromNumber: string; toNumber: string
  dateFrom: string; dateTo: string
}

const emptyFilters: Filters = { search:'', callId:'', agentId:'', direction:'', sentiment:'', result:'', fromNumber:'', toNumber:'', dateFrom:'', dateTo:'' }
const PAGE_SIZE = 25
const COLS = 'call_id, agent_id, agent_name, direction, from_number, to_number, duration_ms, start_timestamp, disconnection_reason, recording_url, transcript, call_summary, user_sentiment, call_successful, call_reason'

const inp: React.CSSProperties = { width:'100%', background:'#0D0E14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#F1F0F5', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }
const lbl: React.CSSProperties = { fontSize:10, fontWeight:600, color:'#4A4960', textTransform:'uppercase' as const, letterSpacing:'0.1em', marginBottom:5, display:'block' }

function fmtDuration(ms?: number | null) {
  if (!ms) return '—'
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
}
function sanitize(t: string) { return t.replace(/[,()*%\\:]/g, ' ').trim() }

function extractMotivo(transcript: string | null): string {
  if (!transcript) return ''
  const MOTIVOS: Record<string, string> = {
    'aceite': 'Cambio aceite/filtro', 'filtro': 'Cambio aceite/filtro',
    'frenos': 'Frenos', 'pastillas': 'Frenos',
    'revisión': 'Revisión', 'revision': 'Revisión', 'itv': 'Revisión ITV',
    'neumático': 'Neumáticos', 'neumatico': 'Neumáticos', 'rueda': 'Neumáticos',
    'batería': 'Batería', 'bateria': 'Batería',
    'mantenimiento': 'Mantenimiento', 'diagnós': 'Diagnóstico',
  }
  const lower = transcript.toLowerCase()
  for (const [key, label] of Object.entries(MOTIVOS)) {
    if (lower.includes(key)) return label
  }
  return ''
}

function sentimentColor(s: string | null) {
  if (s === 'Positive') return { color:'#34D399', bg:'rgba(52,211,153,0.1)', border:'rgba(52,211,153,0.3)' }
  if (s === 'Negative') return { color:'#F87171', bg:'rgba(248,113,113,0.1)', border:'rgba(248,113,113,0.3)' }
  return { color:'#8B8A99', bg:'rgba(139,138,153,0.1)', border:'rgba(139,138,153,0.2)' }
}

export default function Calls() {
  const { user } = useAuth()
  const [rows, setRows] = useState<CallRow[]>([])
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [selected, setSelected] = useState<CallRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [applied, setApplied] = useState<Filters>(emptyFilters)

  useEffect(() => {
    if (!user) return
    supabase.from('agents').select('retell_agent_id, name').eq('user_id', user.id)
      .then(({ data }) => setAgents((data ?? []) as AgentOption[]))
  }, [user])

  useEffect(() => {
    const t = setTimeout(() => { setApplied(filters); setPage(0) }, 350)
    return () => clearTimeout(t)
  }, [filters])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const run = async () => {
      setLoading(true); setError(null)
      let q = supabase.from('call_logs').select(COLS, { count:'estimated' })
        .eq('user_id', user.id).order('start_timestamp', { ascending:false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      if (applied.agentId) q = q.eq('agent_id', applied.agentId)
      if (applied.direction) q = q.eq('direction', applied.direction)
      if (applied.sentiment) q = q.eq('user_sentiment', applied.sentiment)
      if (applied.result === 'success') q = q.eq('call_successful', true)
      if (applied.result === 'fail') q = q.eq('call_successful', false)
      if (applied.callId) q = q.ilike('call_id', `%${applied.callId}%`)
      if (applied.fromNumber) q = q.ilike('from_number', `%${applied.fromNumber}%`)
      if (applied.toNumber) q = q.ilike('to_number', `%${applied.toNumber}%`)
      if (applied.dateFrom) q = q.gte('start_timestamp', new Date(`${applied.dateFrom}T00:00:00`).toISOString())
      if (applied.dateTo) q = q.lte('start_timestamp', new Date(`${applied.dateTo}T23:59:59.999`).toISOString())
      const term = sanitize(applied.search)
      if (term) q = q.or([`call_id.ilike.*${term}*`,`agent_name.ilike.*${term}*`,`from_number.ilike.*${term}*`,`to_number.ilike.*${term}*`,`call_summary.ilike.*${term}*`].join(','))
      const { data, error, count } = await q
      if (cancelled) return
      if (error) { setError(error.message); setRows([]) }
      else { setRows((data ?? []) as CallRow[]); setCount(count ?? null) }
      setLoading(false)
    }
    void run()
    return () => { cancelled = true }
  }, [user, applied, page])

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters(f => ({ ...f, [key]: value }))
  }

  const activeFilters = useMemo(() => Object.values(filters).some(v => v !== ''), [filters])
  const hasNext = rows.length === PAGE_SIZE
  const rangeStart = count === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd = page * PAGE_SIZE + rows.length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <PageHeader title="Llamadas" subtitle="Historial con grabaciones y transcripciones" />

      {error && (
        <div style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', borderRadius:10, padding:'10px 16px', fontSize:12, color:'#F87171' }}>{error}</div>
      )}

      {/* Filtros */}
      <div style={{ background:'#181922', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:10, fontWeight:700, color:'#4A4960', textTransform:'uppercase', letterSpacing:'0.12em' }}>Filtros</span>
          {activeFilters && (
            <button type="button" onClick={() => setFilters(emptyFilters)} style={{ background:'none', border:'none', fontSize:11, fontWeight:600, color:'#9B8FEF', cursor:'pointer', fontFamily:'inherit' }}>Limpiar filtros</button>
          )}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12 }}>
          <div style={{ gridColumn:'span 2' }}>
            <span style={lbl}>Búsqueda general</span>
            <input style={inp} value={filters.search} onChange={e => setFilter('search', e.target.value)} placeholder="ID, agente, números, resumen…" />
          </div>
          <div>
            <span style={lbl}>ID de la llamada</span>
            <input style={inp} value={filters.callId} onChange={e => setFilter('callId', e.target.value)} placeholder="call_..." />
          </div>
          <div>
            <span style={lbl}>Agente</span>
            <select style={inp} value={filters.agentId} onChange={e => setFilter('agentId', e.target.value)}>
              <option value="">Todos</option>
              {agents.map(a => <option key={a.retell_agent_id ?? a.name} value={a.retell_agent_id ?? ''}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <span style={lbl}>Dirección</span>
            <select style={inp} value={filters.direction} onChange={e => setFilter('direction', e.target.value)}>
              <option value="">Todas</option>
              <option value="inbound">Entrante</option>
              <option value="outbound">Saliente</option>
            </select>
          </div>
          <div>
            <span style={lbl}>Sentimiento</span>
            <select style={inp} value={filters.sentiment} onChange={e => setFilter('sentiment', e.target.value)}>
              <option value="">Todos</option>
              <option value="Positive">Positivo</option>
              <option value="Neutral">Neutral</option>
              <option value="Negative">Negativo</option>
              <option value="Unknown">Desconocido</option>
            </select>
          </div>
          <div>
            <span style={lbl}>Resultado</span>
            <select style={inp} value={filters.result} onChange={e => setFilter('result', e.target.value)}>
              <option value="">Todos</option>
              <option value="success">Éxito</option>
              <option value="fail">Fallo</option>
            </select>
          </div>
          <div>
            <span style={lbl}>Nº origen</span>
            <input style={inp} value={filters.fromNumber} onChange={e => setFilter('fromNumber', e.target.value)} placeholder="+34…" />
          </div>
          <div>
            <span style={lbl}>Nº destino</span>
            <input style={inp} value={filters.toNumber} onChange={e => setFilter('toNumber', e.target.value)} placeholder="+34…" />
          </div>
          <div>
            <span style={lbl}>Desde</span>
            <input type="date" style={inp} value={filters.dateFrom} max={filters.dateTo || undefined} onChange={e => setFilter('dateFrom', e.target.value)} />
          </div>
          <div>
            <span style={lbl}>Hasta</span>
            <input type="date" style={inp} value={filters.dateTo} min={filters.dateFrom || undefined} onChange={e => setFilter('dateTo', e.target.value)} />
          </div>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div style={{ fontSize:12, color:'#4A4960', padding:'24px 0' }}>Cargando…</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, alignItems:'start' }}>

          {/* Tabla */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ background:'#181922', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, overflow:'hidden' }}>
              {rows.length === 0 ? (
                <div style={{ padding:'32px 24px', fontSize:12, color:'#4A4960', textAlign:'center' }}>Ninguna llamada coincide con los filtros.</div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                      {['Motivo','Duración','Fecha','Estado'].map(h => (
                        <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:10, fontWeight:600, color:'#4A4960', textTransform:'uppercase', letterSpacing:'0.1em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(c => (
                      <tr key={c.call_id} onClick={() => setSelected(c)}
                        style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', cursor:'pointer', background: selected?.call_id === c.call_id ? 'rgba(124,111,224,0.08)' : 'transparent', transition:'background 0.1s' }}>
                        <td style={{ padding:'12px 16px' }}>
                          <span style={{ fontSize:13, fontWeight:600, color:'#F1F0F5' }}>
                            {c.call_reason || extractMotivo(c.transcript) || '—'}
                          </span>
                        </td>
                        <td style={{ padding:'12px 16px', fontSize:13, color:'#F1F0F5', fontWeight:600 }}>{fmtDuration(c.duration_ms)}</td>
                        <td style={{ padding:'12px 16px', fontSize:12, color:'#8B8A99' }}>{fmtDate(c.start_timestamp)}</td>
                        <td style={{ padding:'12px 16px' }}>
                          {c.call_successful == null
                            ? <span style={{ fontSize:11, color:'#8B8A99' }}>—</span>
                            : <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', padding:'3px 10px', borderRadius:6, color: c.call_successful ? '#34D399' : '#F87171', background: c.call_successful ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', border:`1px solid ${c.call_successful ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                                {c.call_successful ? 'Efectiva' : 'Fallida'}
                              </span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Paginación */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:11, color:'#4A4960' }}>
                {rows.length > 0 ? `${rangeStart}–${rangeEnd}${count != null ? ` de ~${count.toLocaleString('es-ES')}` : ''}` : '0 resultados'}
              </span>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading}
                  style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'6px 16px', fontSize:12, fontWeight:600, color:'#F1F0F5', cursor:'pointer', fontFamily:'inherit', opacity: page === 0 || loading ? 0.3 : 1 }}>
                  ← Anterior
                </button>
                <span style={{ fontSize:12, color:'#8B8A99', minWidth:20, textAlign:'center' }}>{page + 1}</span>
                <button type="button" onClick={() => setPage(p => p + 1)} disabled={!hasNext || loading}
                  style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'6px 16px', fontSize:12, fontWeight:600, color:'#F1F0F5', cursor:'pointer', fontFamily:'inherit', opacity: !hasNext || loading ? 0.3 : 1 }}>
                  Siguiente →
                </button>
              </div>
            </div>
          </div>

          {/* Panel detalle */}
          <div style={{ background:'#181922', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:20, position:'sticky', top:0 }}>
            {selected ? (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#F1F0F5' }}>{selected.agent_name || selected.agent_id || '—'}</div>
                  <div style={{ fontSize:10, color:'#4A4960', fontFamily:'monospace', marginTop:4 }}>{selected.call_id}</div>
                  <div style={{ fontSize:11, color:'#8B8A99', fontFamily:'monospace', marginTop:2 }}>{selected.from_number || '—'} → {selected.to_number || '—'}</div>
                </div>

                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', padding:'3px 10px', borderRadius:6, color: selected.direction === 'inbound' ? '#34D399' : '#9B8FEF', background: selected.direction === 'inbound' ? 'rgba(52,211,153,0.1)' : 'rgba(155,143,239,0.1)', border:`1px solid ${selected.direction === 'inbound' ? 'rgba(52,211,153,0.3)' : 'rgba(155,143,239,0.3)'}` }}>
                    {selected.direction === 'inbound' ? 'Entrante' : 'Saliente'}
                  </span>
                  {selected.user_sentiment && (() => { const sc = sentimentColor(selected.user_sentiment); return (
                    <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', padding:'3px 10px', borderRadius:6, color:sc.color, background:sc.bg, border:`1px solid ${sc.border}` }}>{selected.user_sentiment}</span>
                  )})()}
                  {selected.call_successful != null && (
                    <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', padding:'3px 10px', borderRadius:6, color: selected.call_successful ? '#34D399' : '#F87171', background: selected.call_successful ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', border:`1px solid ${selected.call_successful ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                      {selected.call_successful ? 'Éxito' : 'Fallo'}
                    </span>
                  )}
                </div>

                {selected.call_summary && (
                  <div>
                    <div style={{ fontSize:10, fontWeight:600, color:'#4A4960', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Resumen</div>
                    <p style={{ fontSize:12, color:'#C4BCFF', lineHeight:1.6 }}>{selected.call_summary}</p>
                  </div>
                )}

                <div>
                  <div style={{ fontSize:10, fontWeight:600, color:'#4A4960', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Grabación</div>
                  {selected.recording_url
                    ? <audio controls style={{ width:'100%', accentColor:'#7C6FE0' }} src={selected.recording_url} />
                    : <span style={{ fontSize:12, color:'#4A4960' }}>Sin grabación.</span>}
                </div>

                <div>
                  <div style={{ fontSize:10, fontWeight:600, color:'#4A4960', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Transcripción</div>
                  <div style={{ maxHeight:280, overflowY:'auto', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:14, fontSize:12, color:'#C4BCFF', lineHeight:1.7, whiteSpace:'pre-wrap' }}>
                    {selected.transcript
                      ? selected.transcript.split(/(?=Agent:|User:|Sara:|Cliente:)/).map((turn, i) => {
                          const isAgent = /^(Agent:|Sara:)/.test(turn.trim())
                          return <span key={i} style={{ display:'block', marginBottom:6, color: isAgent ? '#9B8FEF' : '#F1F0F5' }}>{turn.trim()}</span>
                        })
                      : <span style={{ color:'#4A4960' }}>Sin transcripción.</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding:'48px 0', textAlign:'center', fontSize:12, color:'#4A4960' }}>
                Selecciona una llamada para ver grabación y transcripción.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
