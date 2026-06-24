// Modo demo: permite navegar la estructura sin Supabase/Stripe/Retell reales.
// Se activa con VITE_DEMO_MODE=true (por defecto en desarrollo).
export const DEMO_MODE =
  (import.meta.env.VITE_DEMO_MODE as string | undefined) !== 'false'

export type Role = 'admin' | 'client'

export interface DemoProfile {
  id: string
  email: string
  full_name: string
  role: Role
  payment_method_added: boolean
}

export interface DemoClient {
  id: string
  full_name: string
  email: string
  status: 'active' | 'past_due' | 'canceled'
  plan: string
  agents: number
  calls: number
  mrr: number
}

export interface DemoCall {
  call_id: string
  agent: string
  type: 'inbound' | 'outbound'
  from: string
  to: string
  duration: string
  date: string
  status: 'ended' | 'error'
  transcript: string
  recording_url: string
}

export const demoClients: DemoClient[] = [
  { id: 'c1', full_name: 'Clínica Dental Sonríe', email: 'admin@sonrie.es', status: 'active', plan: 'Pro', agents: 2, calls: 412, mrr: 199 },
  { id: 'c2', full_name: 'Inmobiliaria Costa', email: 'info@costa.es', status: 'past_due', plan: 'Starter', agents: 1, calls: 98, mrr: 79 },
  { id: 'c3', full_name: 'Taller MecaExpress', email: 'contacto@mecaexpress.es', status: 'active', plan: 'Pro', agents: 3, calls: 740, mrr: 199 },
  { id: 'c4', full_name: 'Restaurante La Brasa', email: 'reservas@labrasa.es', status: 'canceled', plan: 'Starter', agents: 0, calls: 0, mrr: 0 },
]

export const demoCalls: DemoCall[] = [
  { call_id: 'call_001', agent: 'Recepcionista', type: 'inbound', from: '+34 600 111 222', to: '+34 911 000 000', duration: '2:14', date: '2026-06-23 10:32', status: 'ended', transcript: 'Agente: Hola, gracias por llamar. ¿En qué puedo ayudarle?\nCliente: Quería pedir cita para una limpieza.\nAgente: Perfecto, ¿le viene bien el jueves a las 17:00?\nCliente: Sí, genial.\nAgente: Cita confirmada, ¡gracias!', recording_url: '#' },
  { call_id: 'call_002', agent: 'Ventas', type: 'outbound', from: '+34 911 000 000', to: '+34 622 333 444', duration: '4:01', date: '2026-06-23 09:50', status: 'ended', transcript: 'Agente: Buenos días, le llamo de parte de...\nCliente: Ahora no puedo, gracias.', recording_url: '#' },
  { call_id: 'call_003', agent: 'Recepcionista', type: 'inbound', from: '+34 655 777 888', to: '+34 911 000 000', duration: '0:42', date: '2026-06-22 18:11', status: 'error', transcript: 'Llamada interrumpida.', recording_url: '#' },
]

// Serie para gráficos (llamadas por día de la última semana).
export const demoCallsByDay = [
  { day: 'Lun', calls: 42, cost: 18 },
  { day: 'Mar', calls: 55, cost: 23 },
  { day: 'Mié', calls: 38, cost: 16 },
  { day: 'Jue', calls: 71, cost: 30 },
  { day: 'Vie', calls: 64, cost: 27 },
  { day: 'Sáb', calls: 22, cost: 9 },
  { day: 'Dom', calls: 15, cost: 6 },
]

// --- Métricas temporales para los filtros de fecha del dashboard ---
// Generamos datos deterministas relativos a HOY para que los presets
// "Hoy / Esta semana / Este mes / Personalizado" siempre tengan datos.

export interface DailyMetric {
  date: string // ISO yyyy-mm-dd en zona local
  calls: number
  cost: number
}

export interface HourlyMetric {
  hour: string // "HH:00"
  calls: number
  cost: number
}

// PRNG determinista (mulberry32) para que los valores no cambien entre renders.
function seeded(n: number): number {
  let t = (n + 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function isoLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Métricas diarias deterministas para los últimos `days` días (hoy incluido).
function generateDailyMetrics(days: number): DailyMetric[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const out: DailyMetric[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dow = d.getDay() // 0 dom ... 6 sáb
    const weekend = dow === 0 || dow === 6
    const dayKey = Math.round(d.getTime() / 86_400_000)
    const base = weekend ? 16 : 48
    const calls = Math.round(base + seeded(dayKey) * (weekend ? 16 : 44))
    const cost = Math.round(calls * (0.38 + seeded(dayKey + 999) * 0.14))
    out.push({ date: isoLocal(d), calls, cost })
  }
  return out
}

// Desglose por hora del día de hoy (para el preset "Hoy").
function generateHourlyToday(): HourlyMetric[] {
  const out: HourlyMetric[] = []
  for (let h = 0; h < 24; h++) {
    // Curva realista: nada de madrugada, picos de mañana y tarde.
    const peak = h >= 9 && h <= 13 || h >= 16 && h <= 19
    const base = h < 7 ? 0 : peak ? 4 : 1
    const calls = Math.round(base + seeded(h * 37 + 5) * (peak ? 6 : 2))
    const cost = Math.round(calls * (0.4 + seeded(h * 13) * 0.1))
    out.push({ hour: `${String(h).padStart(2, '0')}:00`, calls, cost })
  }
  return out
}

// 120 días de histórico cubren con holgura el preset "Este mes" y rangos personalizados.
export const demoDailyMetrics: DailyMetric[] = generateDailyMetrics(120)
export const demoHourlyToday: HourlyMetric[] = generateHourlyToday()

export const demoPhoneNumbers = [
  { number: '+34 911 000 000', nickname: 'Línea principal', inbound: 'Recepcionista', outbound: '—' },
  { number: '+34 911 000 001', nickname: 'Ventas', inbound: '—', outbound: 'Ventas' },
]

// Vista global de agentes (admin): todos los agentes de todos los clientes.
export const demoAdminAgents = [
  { name: 'Recepcionista', client: 'Clínica Dental Sonríe', calls: 312, status: 'active' as const },
  { name: 'Ventas', client: 'Clínica Dental Sonríe', calls: 100, status: 'active' as const },
  { name: 'Atención al cliente', client: 'Inmobiliaria Costa', calls: 98, status: 'paused' as const },
  { name: 'Recepción taller', client: 'Taller MecaExpress', calls: 420, status: 'active' as const },
  { name: 'Citas ITV', client: 'Taller MecaExpress', calls: 220, status: 'active' as const },
  { name: 'Avisos', client: 'Taller MecaExpress', calls: 100, status: 'active' as const },
]
