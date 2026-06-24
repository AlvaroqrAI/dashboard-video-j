import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Card, PageHeader } from '@/components/ui/Card'
import { supabase, invokeFunction } from '@/lib/supabase'

interface ClientProfile {
  id: string
  full_name: string | null
  email: string | null
  payment_method_added: boolean | null
  assigned_plan_name: string | null
  assigned_price_id: string | null
  created_at: string
}

interface AgentRow {
  id: string
  name: string
  retell_agent_id: string | null
  status: 'active' | 'paused'
  user_id: string | null
}

interface CallRow {
  call_id: string
  agent_name: string | null
  agent_id: string | null
  direction: string | null
  from_number: string | null
  to_number: string | null
  duration_ms: number | null
  start_timestamp: string | null
}

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

// Una opción del desplegable = UN producto (con su precio mensual y/o por minuto).
interface PlanOption {
  productId: string
  priceId: string | null
  label: string
}
interface StripePrice {
  id: string
  unit_amount: number
  currency: string
  recurring_interval: string | null
  usage_type: string
}
interface StripeProduct {
  id: string
  name: string
  prices: StripePrice[]
}

const inputCls =
  'w-full border border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-0'
const btnCls =
  'bg-black px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-neutral-800'
const headCls = 'mb-6 text-xs font-bold uppercase tracking-[0.15em] text-black'

export default function ClientDetail() {
  const { id } = useParams()
  const [client, setClient] = useState<ClientProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const [planOptions, setPlanOptions] = useState<PlanOption[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')

  // Agentes: los del cliente y los disponibles (sin asignar).
  const [clientAgents, setClientAgents] = useState<AgentRow[]>([])
  const [availableAgents, setAvailableAgents] = useState<AgentRow[]>([])
  const [selectedAgent, setSelectedAgent] = useState('')

  // Llamadas de este cliente (desde call_logs; RLS admin lo permite).
  const [calls, setCalls] = useState<CallRow[]>([])

  const [alertType, setAlertType] = useState('payment')
  const [alertTitle, setAlertTitle] = useState('')
  const [alertText, setAlertText] = useState('')
  // Canal de la alerta: 'app' = solo in-app; 'email' = in-app + correo del cliente.
  const [alertChannel, setAlertChannel] = useState<'app' | 'email'>('email')

  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function fetchData() {
    if (!id) return
    const [profileRes, agentsRes, callsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'id, full_name, email, payment_method_added, assigned_plan_name, assigned_price_id, created_at',
        )
        .eq('id', id)
        .single(),
      supabase
        .from('agents')
        .select('id, name, retell_agent_id, status, user_id')
        .order('created_at', { ascending: false }),
      supabase
        .from('call_logs')
        .select(
          'call_id, agent_name, agent_id, direction, from_number, to_number, duration_ms, start_timestamp',
        )
        .eq('user_id', id)
        .order('start_timestamp', { ascending: false })
        .limit(50),
    ])
    setClient(profileRes.data as ClientProfile | null)
    const all = (agentsRes.data ?? []) as AgentRow[]
    setClientAgents(all.filter((a) => a.user_id === id))
    setAvailableAgents(all.filter((a) => a.user_id === null))
    setCalls((callsRes.data ?? []) as CallRow[])
    setLoading(false)
  }

  async function fetchPlans() {
    try {
      const { products } = await invokeFunction<{ products: StripeProduct[] }>(
        'stripe-products',
        { action: 'list' },
      )
      // UNA opción por producto; la etiqueta resume sus precios (mensual y/o minuto).
      const opts: PlanOption[] = []
      for (const p of products) {
        if (!p.prices.length) continue
        const parts = p.prices.map((pr) => {
          const amount = (pr.unit_amount / 100).toLocaleString('es-ES', {
            style: 'currency',
            currency: (pr.currency || 'eur').toUpperCase(),
          })
          if (pr.usage_type === 'metered') return `${amount}/min`
          return pr.recurring_interval ? `${amount}/mes` : amount
        })
        // Guardamos la cuota mensual como precio principal (o el primero que haya).
        const monthly = p.prices.find(
          (pr) => pr.usage_type !== 'metered' && pr.recurring_interval,
        )
        const priceId = (monthly ?? p.prices[0]).id
        opts.push({
          productId: p.id,
          priceId,
          label: `${p.name} · ${parts.join(' + ')}`,
        })
      }
      setPlanOptions(opts)
    } catch {
      setPlanOptions([])
    }
  }

  useEffect(() => {
    void fetchData()
    void fetchPlans()
  }, [id])

  async function assignPlan() {
    const opt = planOptions.find((p) => p.productId === selectedProduct)
    if (!opt || !id) {
      setMsg({ text: 'Selecciona un plan.', ok: false })
      return
    }
    const { error } = await supabase
      .from('profiles')
      .update({
        assigned_price_id: opt.priceId,
        assigned_product_id: opt.productId,
        assigned_plan_name: opt.label,
      })
      .eq('id', id)
    if (error) setMsg({ text: error.message, ok: false })
    else {
      setMsg({ text: 'Plan asignado.', ok: true })
      await fetchData()
    }
  }

  async function assignAgent() {
    if (!selectedAgent || !id) {
      setMsg({ text: 'Selecciona un agente.', ok: false })
      return
    }
    const { error } = await supabase
      .from('agents')
      .update({ user_id: id })
      .eq('id', selectedAgent)
    if (error) setMsg({ text: error.message, ok: false })
    else {
      setMsg({ text: 'Agente asignado.', ok: true })
      setSelectedAgent('')
      await fetchData()
    }
  }

  async function unassignAgent(agentId: string) {
    const { error } = await supabase
      .from('agents')
      .update({ user_id: null })
      .eq('id', agentId)
    if (error) setMsg({ text: error.message, ok: false })
    else {
      setMsg({ text: 'Agente quitado.', ok: true })
      await fetchData()
    }
  }

  async function sendAlert() {
    if (!alertTitle || !id) {
      setMsg({ text: 'La alerta necesita un título.', ok: false })
      return
    }
    const wantsEmail = alertChannel === 'email'
    if (wantsEmail && !client?.email) {
      setMsg({ text: 'El cliente no tiene email; solo se enviará in-app.', ok: false })
    }
    try {
      // Crea la alerta y, si se eligió email, la envía al correo del cliente.
      const res = await invokeFunction<{ emailed: boolean; emailError?: string | null }>(
        'send-alert',
        {
          userId: id,
          type: alertType,
          title: alertTitle,
          message: alertText,
          email: wantsEmail,
        },
      )
      setMsg({
        text: !wantsEmail
          ? 'Alerta enviada (solo in-app).'
          : res.emailed
            ? 'Alerta enviada (in-app + email).'
            : `Alerta guardada in-app, pero el email falló${res.emailError ? `: ${res.emailError}` : '.'}`,
        ok: !wantsEmail || res.emailed,
      })
      setAlertTitle('')
      setAlertText('')
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'No se pudo enviar.', ok: false })
    }
  }

  if (loading) {
    return (
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
        Cargando…
      </p>
    )
  }

  if (!client) {
    return (
      <div>
        <p className="mb-3 text-sm text-neutral-500">Cliente no encontrado.</p>
        <Link
          to="/admin/clients"
          className="text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60"
        >
          ← Volver
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link
        to="/admin/clients"
        className="mb-4 inline-block text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60"
      >
        ← Clientes
      </Link>
      <PageHeader
        title={client.full_name || 'Cliente'}
        subtitle={client.email || ''}
      />

      {msg && (
        <p
          className={`mb-6 text-xs font-bold uppercase tracking-wide ${
            msg.ok ? 'text-black' : 'border border-black bg-black px-3 py-2 text-white'
          }`}
        >
          {msg.text}
        </p>
      )}

      {/* Plan asignado */}
      <Card className="mb-6">
        <h2 className={headCls}>Plan asignado</h2>
        <p className="mb-4 text-2xl font-black uppercase tracking-tight text-black">
          {client.assigned_plan_name || 'Sin plan'}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className={inputCls}
          >
            <option value="">— Selecciona un producto —</option>
            {planOptions.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void assignPlan()} className={btnCls}>
            Asignar plan
          </button>
        </div>
      </Card>

      {/* Agentes del cliente */}
      <Card className="mb-6">
        <h2 className={headCls}>Agentes del cliente</h2>

        {/* Asignar un agente existente (del catálogo de agentes sin asignar) */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className={inputCls}
          >
            <option value="">
              {availableAgents.length
                ? '— Selecciona un agente disponible —'
                : '— No hay agentes disponibles (créalos en Agentes) —'}
            </option>
            {availableAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.retell_agent_id ? `(${a.retell_agent_id})` : ''}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void assignAgent()} className={btnCls}>
            Asignar agente
          </button>
        </div>

        {/* Tabla de agentes ya asignados a este cliente */}
        {clientAgents.length === 0 ? (
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Este cliente no tiene agentes asignados.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Agente
                </th>
                <th className="py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Agent ID
                </th>
                <th className="py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Estado
                </th>
                <th className="py-3"></th>
              </tr>
            </thead>
            <tbody>
              {clientAgents.map((a) => (
                <tr key={a.id} className="border-b border-neutral-200 last:border-0">
                  <td className="py-4 font-bold text-black">{a.name}</td>
                  <td className="py-4 font-mono text-xs text-neutral-500">
                    {a.retell_agent_id || '—'}
                  </td>
                  <td className="py-4">
                    <span
                      className={`border border-black px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${
                        a.status === 'active'
                          ? 'bg-black text-white'
                          : 'bg-white text-black'
                      }`}
                    >
                      {a.status === 'active' ? 'Activo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <button
                      type="button"
                      onClick={() => void unassignAgent(a.id)}
                      className="text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Llamadas del cliente */}
      <Card className="mb-6">
        <h2 className={headCls}>Llamadas del cliente</h2>
        {calls.length === 0 ? (
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Este cliente aún no tiene llamadas registradas.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Agente
                </th>
                <th className="py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  De → A
                </th>
                <th className="py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Duración
                </th>
                <th className="py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr
                  key={c.call_id}
                  className="border-b border-neutral-200 last:border-0"
                >
                  <td className="py-4 font-bold text-black">
                    {c.agent_name || c.agent_id || '—'}
                    <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                      {c.direction === 'inbound' ? 'Entrante' : 'Saliente'}
                    </span>
                  </td>
                  <td className="py-4 font-mono text-xs text-neutral-600">
                    {c.from_number || '—'} → {c.to_number || '—'}
                  </td>
                  <td className="py-4 text-neutral-600">
                    {fmtDuration(c.duration_ms)}
                  </td>
                  <td className="py-4 text-neutral-500">
                    {fmtDate(c.start_timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Link
          to="/admin/calls"
          className="mt-4 inline-block text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60"
        >
          Ver todas las llamadas →
        </Link>
      </Card>

      {/* Enviar alerta */}
      <Card className="mb-6">
        <h2 className={headCls}>Enviar alerta al cliente</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <select
            value={alertType}
            onChange={(e) => setAlertType(e.target.value)}
            className={inputCls}
          >
            <option value="payment">Impago / Facturación</option>
            <option value="warning">Aviso</option>
            <option value="info">Información</option>
            <option value="critical">Crítica</option>
          </select>
          <select
            value={alertChannel}
            onChange={(e) => setAlertChannel(e.target.value as 'app' | 'email')}
            className={inputCls}
          >
            <option value="app">Solo en la app</option>
            <option value="email">
              En la app + correo{client.email ? ` (${client.email})` : ''}
            </option>
          </select>
          <input
            value={alertTitle}
            onChange={(e) => setAlertTitle(e.target.value)}
            placeholder="Título de la alerta"
            className={`sm:col-span-2 ${inputCls}`}
          />
          <textarea
            value={alertText}
            onChange={(e) => setAlertText(e.target.value)}
            placeholder="Mensaje para el cliente…"
            rows={3}
            className={`sm:col-span-2 ${inputCls}`}
          />
        </div>
        <button
          type="button"
          onClick={() => void sendAlert()}
          className={`mt-4 ${btnCls}`}
        >
          Enviar alerta
        </button>
      </Card>

      {/* Resumen */}
      <Card>
        <h2 className={headCls}>Resumen de la cuenta</h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              Plan
            </p>
            <p className="mt-2 text-sm font-bold text-black">
              {client.assigned_plan_name || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              Método de pago
            </p>
            <p className="mt-2 text-sm font-bold text-black">
              {client.payment_method_added ? 'Añadido' : 'Pendiente'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              Agentes
            </p>
            <p className="mt-2 text-sm font-bold text-black">
              {clientAgents.length}
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
