// Lógica de filtrado por rango de fecha para los gráficos del dashboard.
// Soporta los presets Hoy / Esta semana / Este mes y un rango personalizado.

import { demoDailyMetrics, demoHourlyToday } from './demo'

export type RangePreset = 'today' | 'week' | 'month' | 'custom'

export interface RangeState {
  preset: RangePreset
  from?: string // ISO yyyy-mm-dd, sólo para 'custom'
  to?: string
}

export interface ChartPoint {
  label: string
  calls: number
  cost: number
}

export interface RangedMetrics {
  points: ChartPoint[]
  totalCalls: number
  totalCost: number
  avgCalls: number // media de llamadas por punto (hora o día)
  granularity: 'hour' | 'day'
}

const DOW_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function isoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Lunes como primer día de la semana.
function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const dow = (x.getDay() + 6) % 7 // 0 = lunes
  x.setDate(x.getDate() - dow)
  return x
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// Etiqueta del eje X: día de la semana si el rango es corto, dd/mm si es largo.
function dayLabel(iso: string, withWeekday: boolean): string {
  const dt = parseISO(iso)
  if (withWeekday) return DOW_ES[dt.getDay()]
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function summarize(
  points: ChartPoint[],
  granularity: 'hour' | 'day',
): RangedMetrics {
  const totalCalls = points.reduce((s, p) => s + p.calls, 0)
  const totalCost = points.reduce((s, p) => s + p.cost, 0)
  const avgCalls = points.length ? Math.round(totalCalls / points.length) : 0
  return { points, totalCalls, totalCost, avgCalls, granularity }
}

// Devuelve la serie y los totales correspondientes al rango seleccionado.
export function computeRangedMetrics(range: RangeState): RangedMetrics {
  if (range.preset === 'today') {
    const points = demoHourlyToday.map((h) => ({
      label: h.hour,
      calls: h.calls,
      cost: h.cost,
    }))
    return summarize(points, 'hour')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let from: Date
  let to: Date
  if (range.preset === 'week') {
    from = startOfWeek(today)
    to = today
  } else if (range.preset === 'month') {
    from = startOfMonth(today)
    to = today
  } else {
    from = range.from ? parseISO(range.from) : startOfWeek(today)
    to = range.to ? parseISO(range.to) : today
    if (from > to) [from, to] = [to, from]
  }

  const fromIso = isoLocal(from)
  const toIso = isoLocal(to)
  const filtered = demoDailyMetrics.filter(
    (m) => m.date >= fromIso && m.date <= toIso,
  )
  const withWeekday = filtered.length <= 10
  const points = filtered.map((m) => ({
    label: dayLabel(m.date, withWeekday),
    calls: m.calls,
    cost: m.cost,
  }))
  return summarize(points, 'day')
}

// ---------------------------------------------------------------------------
// Métricas REALES desde la base de datos (call_logs), no demo.
// ---------------------------------------------------------------------------

export interface CallForMetrics {
  start_timestamp: string | null // ISO desde la BD
  cost_cents?: number | null
}

// Límites del rango (fechas reales) y granularidad de los gráficos.
export function rangeBounds(range: RangeState): {
  from: Date
  to: Date
  granularity: 'hour' | 'day'
} {
  const now = new Date()
  if (range.preset === 'today') {
    const from = new Date(now)
    from.setHours(0, 0, 0, 0)
    const to = new Date(now)
    to.setHours(23, 59, 59, 999)
    return { from, to, granularity: 'hour' }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let from: Date
  let to: Date
  if (range.preset === 'week') {
    from = startOfWeek(today)
    to = new Date(today)
  } else if (range.preset === 'month') {
    from = startOfMonth(today)
    to = new Date(today)
  } else {
    from = range.from ? parseISO(range.from) : startOfWeek(today)
    to = range.to ? parseISO(range.to) : today
    if (from > to) [from, to] = [to, from]
  }
  to = new Date(to)
  to.setHours(23, 59, 59, 999)
  return { from, to, granularity: 'day' }
}

// Construye la serie y los totales a partir de las llamadas reales del rango.
export function computeMetricsFromCalls(
  calls: CallForMetrics[],
  range: RangeState,
): RangedMetrics {
  const { from, to, granularity } = rangeBounds(range)
  const inRange = calls.filter((c) => {
    if (!c.start_timestamp) return false
    const t = new Date(c.start_timestamp).getTime()
    return t >= from.getTime() && t <= to.getTime()
  })

  if (granularity === 'hour') {
    const buckets: ChartPoint[] = Array.from({ length: 24 }, (_, h) => ({
      label: `${String(h).padStart(2, '0')}h`,
      calls: 0,
      cost: 0,
    }))
    for (const c of inRange) {
      const h = new Date(c.start_timestamp as string).getHours()
      buckets[h].calls += 1
      buckets[h].cost += (c.cost_cents ?? 0) / 100
    }
    buckets.forEach((b) => (b.cost = Math.round(b.cost * 100) / 100))
    return summarize(buckets, 'hour')
  }

  // Un punto por día (incluye días a cero para una serie continua).
  const dayMap = new Map<string, ChartPoint>()
  const days: ChartPoint[] = []
  const cursor = new Date(from)
  cursor.setHours(0, 0, 0, 0)
  const last = new Date(to)
  last.setHours(0, 0, 0, 0)
  const withWeekday = (last.getTime() - cursor.getTime()) / 86_400_000 <= 10
  // Tope de seguridad para rangos enormes.
  let guard = 0
  while (cursor <= last && guard < 800) {
    const key = isoLocal(cursor)
    const pt: ChartPoint = { label: dayLabel(key, withWeekday), calls: 0, cost: 0 }
    dayMap.set(key, pt)
    days.push(pt)
    cursor.setDate(cursor.getDate() + 1)
    guard++
  }
  for (const c of inRange) {
    const key = isoLocal(new Date(c.start_timestamp as string))
    const pt = dayMap.get(key)
    if (pt) {
      pt.calls += 1
      pt.cost += (c.cost_cents ?? 0) / 100
    }
  }
  days.forEach((b) => (b.cost = Math.round(b.cost * 100) / 100))
  return summarize(days, 'day')
}

// Buckets agregados que devuelve la RPC client_call_series (agregación en BD).
export interface SeriesBucket {
  bucket_key: string
  calls: number
  cost_cents: number
}

// Convierte los buckets agregados en el servidor en la serie continua del gráfico
// (rellena los huecos a cero). O(nº de buckets), nunca O(nº de llamadas).
export function seriesToMetrics(
  range: RangeState,
  buckets: SeriesBucket[],
): RangedMetrics {
  const map = new Map(buckets.map((b) => [b.bucket_key, b]))
  const { from, to, granularity } = rangeBounds(range)

  if (granularity === 'hour') {
    const dayKey = isoLocal(from)
    const points: ChartPoint[] = Array.from({ length: 24 }, (_, h) => {
      const b = map.get(`${dayKey}T${String(h).padStart(2, '0')}`)
      return {
        label: `${String(h).padStart(2, '0')}h`,
        calls: Number(b?.calls ?? 0),
        cost: Number(b?.cost_cents ?? 0) / 100,
      }
    })
    return summarize(points, 'hour')
  }

  const days: ChartPoint[] = []
  const cursor = new Date(from)
  cursor.setHours(0, 0, 0, 0)
  const last = new Date(to)
  last.setHours(0, 0, 0, 0)
  const withWeekday = (last.getTime() - cursor.getTime()) / 86_400_000 <= 10
  let guard = 0
  while (cursor <= last && guard < 800) {
    const key = isoLocal(cursor)
    const b = map.get(key)
    days.push({
      label: dayLabel(key, withWeekday),
      calls: Number(b?.calls ?? 0),
      cost: Number(b?.cost_cents ?? 0) / 100,
    })
    cursor.setDate(cursor.getDate() + 1)
    guard++
  }
  return summarize(days, 'day')
}

// Texto legible del rango activo, para títulos y resúmenes.
export function rangeLabel(range: RangeState): string {
  switch (range.preset) {
    case 'today':
      return 'Hoy'
    case 'week':
      return 'Esta semana'
    case 'month':
      return 'Este mes'
    case 'custom': {
      if (!range.from || !range.to) return 'Personalizado'
      const f = range.from.split('-').slice(1).reverse().join('/')
      const t = range.to.split('-').slice(1).reverse().join('/')
      return `${f} – ${t}`
    }
  }
}

// Fecha ISO de hoy y de hace N días, útiles para inicializar el rango personalizado.
export function isoToday(): string {
  const d = new Date()
  return isoLocal(d)
}

export function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoLocal(d)
}
