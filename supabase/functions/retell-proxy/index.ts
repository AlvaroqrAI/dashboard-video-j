// Proxy autenticado a la API de Retell AI (solo lectura de llamadas).
// El cliente nunca ve la API key. Además, el acceso se RESTRINGE en el servidor
// a los agentes asignados al propio cliente, para que aunque varios clientes
// compartan la clave por defecto, nadie vea las llamadas de otro.
//
// Body: { path, method?, body? }
//   path: 'v2/list-calls' | 'v2/get-call/{call_id}'
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

  const { path } = await req.json().catch(() => ({}))
  const isList = path === 'v2/list-calls'
  const isGet = typeof path === 'string' && path.startsWith('v2/get-call/')
  if (!isList && !isGet) return json({ error: 'Endpoint no permitido' }, 400)

  const admin = adminClient()

  // Clave de Retell del cliente (cifrada en BD).
  const { data: integration } = await admin
    .from('retell_integrations')
    .select('api_key_encrypted')
    .eq('user_id', user.id)
    .single()
  if (!integration) {
    return json({ error: 'No hay API Key de Retell conectada' }, 400)
  }
  const apiKey = await decrypt(integration.api_key_encrypted)

  // Agentes asignados al cliente → IDs de Retell permitidos.
  const { data: agents } = await admin
    .from('agents')
    .select('retell_agent_id')
    .eq('user_id', user.id)
  const ownAgentIds = (agents ?? [])
    .map((a) => a.retell_agent_id)
    .filter((x): x is string => !!x)

  // Sin agentes → sin llamadas (no se consulta a Retell).
  if (ownAgentIds.length === 0) {
    return isList ? json([]) : json({ error: 'No autorizado' }, 403)
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  if (isList) {
    // El filtro de agentes lo IMPONE el servidor (se ignora lo que mande el cliente).
    const res = await fetch(`${RETELL_BASE}/v2/list-calls`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter_criteria: { agent_id: ownAgentIds },
        limit: 100,
        sort_order: 'descending',
      }),
    })
    const data = await res.json().catch(() => null)
    // Doble filtro defensivo por si la API ignorara filter_criteria.
    const list = Array.isArray(data)
      ? data.filter((c) => ownAgentIds.includes(c.agent_id))
      : []
    return json(list, res.ok ? 200 : res.status)
  }

  // get-call: obtener y verificar que la llamada pertenece a un agente del cliente.
  const res = await fetch(`${RETELL_BASE}/${path}`, { method: 'GET', headers })
  const call = await res.json().catch(() => null)
  if (!res.ok) return json(call, res.status)
  if (!call || !ownAgentIds.includes(call.agent_id)) {
    return json({ error: 'No autorizado' }, 403)
  }
  return json(call)
})
