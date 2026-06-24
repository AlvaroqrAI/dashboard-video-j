import { useEffect, useMemo, useState } from 'react'
import { Card, PageHeader, EmptyState } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

// Fila de call_logs (alimentada por el webhook de Retell).
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
}

interface AgentOption {
  retell_agent_id: string | null
  name: string
}

interface Filters {
  search: string
  callId: string
  agentId: string
  direction: string
  sentiment: string
  result: string
  fromNumber: string
  toNumber: string
  dateFrom: string
  dateTo: string
}

const emptyFilters: Filters = {
  search: '',
  callId: '',
  agentId: '',
  direction: '',
  sentiment: '',
  result: '',
  fromNumber: '',
  toNumber: '',
  dateFrom: '',
  dateTo: '',
}

const PAGE_SIZE = 25
const COLS =
  'call_id, agent_id, agent_name, direction, from_number, to_number, duration_ms, start_timestamp, disconnection_reason, recording_url, transcript, call_summary, user_sentiment, call_successful'

const inputCls =
  'border border-black bg-white px-3 py-2 text-xs text-black outline-none focus:border-black placeholder:text-neutral-400'
const labelCls =
  'mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500'

function fmtDuration(ms?: number | null) {
  if (!ms) return '—'
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
// Quita caracteres que romperían la sintaxis del filtro .or() de PostgREST.
function sanitize(term: string) {
  return term.replace(/[,()*%\\:]/g, ' ').trim()
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
  // Filtros aplicados (con debounce) que disparan la consulta real.
  const [applied, setApplied] = useState<Filters>(emptyFilters)

  // Agentes del cliente para el desplegable (consulta pequeña, una vez).
  useEffect(() => {
    if (!user) return
    supabase
      .from('agents')
      .select('retell_agent_id, name')
      .eq('user_id', user.id)
      .then(({ data }) => setAgents((data ?? []) as AgentOption[]))
  }, [user])

  // Debounce: al cambiar los filtros, espera 350 ms y vuelve a la página 0.
  useEffect(() => {
    const t = setTimeout(() => {
      setApplied(filters)
      setPage(0)
    }, 350)
    return () => clearTimeout(t)
  }, [filters])

  // Consulta server-side: TODOS los filtros van a Postgres (no al navegador).
  useEffect(() => {
    if (!user) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      // RLS ya restringe a las llamadas del cliente; el filtro explícito por
      // user_id ayuda al planificador a usar el índice (user_id, start_timestamp).
      let q = supabase
        .from('call_logs')
        .select(COLS, { count: 'estimated' })
        .eq('user_id', user.id)
        .order('start_timestamp', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      if (applied.agentId) q = q.eq('agent_id', applied.agentId)
      if (applied.direction) q = q.eq('direction', applied.direction)
      if (applied.sentiment) q = q.eq('user_sentiment', applied.sentiment)
      if (applied.result === 'success') q = q.eq('call_successful', true)
      if (applied.result === 'fail') q = q.eq('call_successful', false)
      if (applied.callId) q = q.ilike('call_id', `%${applied.callId}%`)
      if (applied.fromNumber) q = q.ilike('from_number', `%${applied.fromNumber}%`)
      if (applied.toNumber) q = q.ilike('to_number', `%${applied.toNumber}%`)
      if (applied.dateFrom)
        q = q.gte('start_timestamp', new Date(`${applied.dateFrom}T00:00:00`).toISOString())
      if (applied.dateTo)
        q = q.lte('start_timestamp', new Date(`${applied.dateTo}T23:59:59.999`).toISOString())
      const term = sanitize(applied.search)
      if (term) {
        q = q.or(
          [
            `call_id.ilike.*${term}*`,
            `agent_name.ilike.*${term}*`,
            `from_number.ilike.*${term}*`,
            `to_number.ilike.*${term}*`,
            `call_summary.ilike.*${term}*`,
          ].join(','),
        )
      }

      const { data, error, count } = await q
      if (cancelled) return
      if (error) {
        setError(error.message)
        setRows([])
      } else {
        setRows((data ?? []) as CallRow[])
        setCount(count ?? null)
      }
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [user, applied, page])

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  const activeFilters = useMemo(
    () => Object.values(filters).some((v) => v !== ''),
    [filters],
  )

  const hasNext = rows.length === PAGE_SIZE
  const rangeStart = count === 0 ? 0 : page * PAGE_SIZE + 1
  const rangeEnd = page * PAGE_SIZE + rows.length

  return (
    <div>
      <PageHeader
        title="Llamadas"
        subtitle="Historial con grabaciones y transcripciones"
      />

      {error && (
        <p className="mb-6 border border-black bg-black px-3 py-2 text-xs font-medium uppercase tracking-wide text-white">
          {error}
        </p>
      )}

      {/* Filtros (se aplican en la base de datos) */}
      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-black">
            Filtros
          </h2>
          {activeFilters && (
            <button
              type="button"
              onClick={() => setFilters(emptyFilters)}
              className="text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Búsqueda general</label>
            <input
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              placeholder="ID, agente, números, resumen…"
              className={`w-full ${inputCls}`}
            />
          </div>
          <div>
            <label className={labelCls}>ID de la llamada</label>
            <input
              value={filters.callId}
              onChange={(e) => setFilter('callId', e.target.value)}
              placeholder="call_..."
              className={`w-full ${inputCls}`}
            />
          </div>
          <div>
            <label className={labelCls}>Agente</label>
            <select
              value={filters.agentId}
              onChange={(e) => setFilter('agentId', e.target.value)}
              className={`w-full ${inputCls}`}
            >
              <option value="">Todos</option>
              {agents.map((a) => (
                <option
                  key={a.retell_agent_id ?? a.name}
                  value={a.retell_agent_id ?? ''}
                >
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Dirección</label>
            <select
              value={filters.direction}
              onChange={(e) => setFilter('direction', e.target.value)}
              className={`w-full ${inputCls}`}
            >
              <option value="">Todas</option>
              <option value="inbound">Entrante</option>
              <option value="outbound">Saliente</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Sentimiento</label>
            <select
              value={filters.sentiment}
              onChange={(e) => setFilter('sentiment', e.target.value)}
              className={`w-full ${inputCls}`}
            >
              <option value="">Todos</option>
              <option value="Positive">Positivo</option>
              <option value="Neutral">Neutral</option>
              <option value="Negative">Negativo</option>
              <option value="Unknown">Desconocido</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Resultado</label>
            <select
              value={filters.result}
              onChange={(e) => setFilter('result', e.target.value)}
              className={`w-full ${inputCls}`}
            >
              <option value="">Todos</option>
              <option value="success">Éxito</option>
              <option value="fail">Fallo</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Nº origen (desde)</label>
            <input
              value={filters.fromNumber}
              onChange={(e) => setFilter('fromNumber', e.target.value)}
              placeholder="+34…"
              className={`w-full ${inputCls}`}
            />
          </div>
          <div>
            <label className={labelCls}>Nº destino (a)</label>
            <input
              value={filters.toNumber}
              onChange={(e) => setFilter('toNumber', e.target.value)}
              placeholder="+34…"
              className={`w-full ${inputCls}`}
            />
          </div>
          <div>
            <label className={labelCls}>Desde</label>
            <input
              type="date"
              value={filters.dateFrom}
              max={filters.dateTo || undefined}
              onChange={(e) => setFilter('dateFrom', e.target.value)}
              className={`w-full ${inputCls}`}
            />
          </div>
          <div>
            <label className={labelCls}>Hasta</label>
            <input
              type="date"
              value={filters.dateTo}
              min={filters.dateFrom || undefined}
              onChange={(e) => setFilter('dateTo', e.target.value)}
              className={`w-full ${inputCls}`}
            />
          </div>
        </div>
      </Card>

      {loading && rows.length === 0 ? (
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
          Cargando…
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Lista + paginación */}
          <div className="lg:col-span-2">
            <Card className="p-0">
              {rows.length === 0 ? (
                <div className="p-6">
                  <EmptyState message="Ninguna llamada coincide con los filtros." />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-black text-left">
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                        Agente
                      </th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                        De → A
                      </th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                        Duración
                      </th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                        Fecha
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => (
                      <tr
                        key={c.call_id}
                        onClick={() => setSelected(c)}
                        className={`cursor-pointer border-b border-neutral-200 last:border-0 hover:bg-neutral-50 ${
                          selected?.call_id === c.call_id ? 'bg-neutral-100' : ''
                        }`}
                      >
                        <td className="px-5 py-4 font-bold text-black">
                          {c.agent_name || c.agent_id || '—'}
                          <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                            {c.direction === 'inbound' ? 'Entrante' : 'Saliente'}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-neutral-600">
                          {c.from_number || '—'} → {c.to_number || '—'}
                        </td>
                        <td className="px-5 py-4 text-neutral-600">
                          {fmtDuration(c.duration_ms)}
                        </td>
                        <td className="px-5 py-4 text-neutral-500">
                          {fmtDate(c.start_timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Controles de paginación */}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                {rows.length > 0
                  ? `${rangeStart}–${rangeEnd}${
                      count != null ? ` de ~${count.toLocaleString('es-ES')}` : ''
                    }`
                  : '0 resultados'}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || loading}
                  className="border border-black px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-black hover:bg-neutral-100 disabled:opacity-30"
                >
                  Anterior
                </button>
                <span className="text-xs font-bold tabular text-black">
                  {page + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasNext || loading}
                  className="border border-black px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-black hover:bg-neutral-100 disabled:opacity-30"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>

          {/* Detalle */}
          <Card>
            {selected ? (
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.05em] text-black">
                  {selected.agent_name || selected.agent_id || '—'}
                </h2>
                <p className="mt-1 font-mono text-[10px] text-neutral-400">
                  {selected.call_id}
                </p>
                <p className="mt-1 font-mono text-xs text-neutral-500">
                  {selected.from_number || '—'} → {selected.to_number || '—'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="border border-black bg-black px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
                    {selected.direction === 'inbound' ? 'Entrante' : 'Saliente'}
                  </span>
                  {selected.user_sentiment && (
                    <span className="border border-black bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-black">
                      {selected.user_sentiment}
                    </span>
                  )}
                  {selected.call_successful != null && (
                    <span className="border border-neutral-300 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-500">
                      {selected.call_successful ? 'Éxito' : 'Fallo'}
                    </span>
                  )}
                  {selected.disconnection_reason && (
                    <span className="border border-neutral-300 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-500">
                      {selected.disconnection_reason}
                    </span>
                  )}
                </div>

                {selected.call_summary && (
                  <div className="mt-6">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-black">
                      Resumen
                    </p>
                    <p className="text-xs leading-relaxed text-neutral-700">
                      {selected.call_summary}
                    </p>
                  </div>
                )}

                <div className="mt-6">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-black">
                    Grabación
                  </p>
                  {selected.recording_url ? (
                    <audio
                      controls
                      className="w-full"
                      src={selected.recording_url}
                    />
                  ) : (
                    <p className="text-xs text-neutral-400">Sin grabación.</p>
                  )}
                </div>

                <div className="mt-6">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-black">
                    Transcripción
                  </p>
                  <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-700">
                    {selected.transcript || 'Sin transcripción.'}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="py-12 text-center text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
                Selecciona una llamada para ver su grabación y transcripción.
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
