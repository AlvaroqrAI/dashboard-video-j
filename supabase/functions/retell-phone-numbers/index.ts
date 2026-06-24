// Números de teléfono del cliente: listar y asignar agente entrante/saliente.
// No se compran ni importan números aquí; solo se gestiona la asignación de
// agentes (y solo de agentes que pertenecen al propio cliente).
//
// Body:
//   { action: 'list' }
//   { action: 'assign', phoneNumber, inboundAgentId, outboundAgentId, nickname? }
import { corsHeaders, json } from '../_shared/cors.ts'
import { adminClient, getUser } from '../_shared/auth.ts'
import { decrypt } from '../_shared/crypto.ts'

const RETELL_BASE = 'https://api.retellai.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const user = await getUser(req)
  if (!user) return json({ error: 'No autorizado' }, 401)

  const body = await req.json().catch(() => ({}))
  const action = body.action
  if (action !== 'list' && action !== 'assign') {
    return json({ error: 'Acción no permitida' }, 400)
  }

  const admin = adminClient()

  // API key del cliente.
  const { data: integration } = await admin
    .from('retell_integrations')
    .select('api_key_encrypted')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!integration) {
    return json({ error: 'No hay API Key de Retell conectada' }, 400)
  }
  const apiKey = await decrypt(integration.api_key_encrypted)
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  // Agentes del cliente: solo se permite asignar estos a los números.
  const { data: agentsRows } = await admin
    .from('agents')
    .select('retell_agent_id, name')
    .eq('user_id', user.id)
  const ownAgentIds = new Set(
    (agentsRows ?? []).map((a) => a.retell_agent_id).filter(Boolean) as string[],
  )

  if (action === 'list') {
    const res = await fetch(`${RETELL_BASE}/list-phone-numbers`, { headers })
    const data = await res.json().catch(() => null)
    if (!res.ok || !Array.isArray(data)) {
      return json({ error: 'No se pudieron leer los números' }, res.status || 502)
    }
    // Devolvemos los números tal cual; el front muestra los agentes propios.
    return json({ numbers: data, agents: agentsRows ?? [] })
  }

  // action === 'assign'
  const { phoneNumber, inboundAgentId, outboundAgentId, nickname } = body
  if (!phoneNumber) return json({ error: 'phoneNumber requerido' }, 400)

  // Solo se aceptan agentes del propio cliente (o vacío = sin asignar).
  for (const id of [inboundAgentId, outboundAgentId]) {
    if (id && !ownAgentIds.has(id)) {
      return json({ error: 'Agente no permitido' }, 403)
    }
  }

  const patch: Record<string, unknown> = {
    inbound_agent_id: inboundAgentId || null,
    outbound_agent_id: outboundAgentId || null,
  }
  if (typeof nickname === 'string') patch.nickname = nickname

  const res = await fetch(
    `${RETELL_BASE}/update-phone-number/${encodeURIComponent(phoneNumber)}`,
    { method: 'PATCH', headers, body: JSON.stringify(patch) },
  )
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    return json(
      { error: data?.message ?? 'No se pudo actualizar el número' },
      res.status || 502,
    )
  }
  return json({ ok: true, number: data })
})
