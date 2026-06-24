// Lectura/edición del prompt de un agente desde el portal del cliente.
// El cliente nunca ve la API key de Retell; el acceso se restringe en el servidor
// a los agentes asignados a su propia cuenta.
//
// Body:
//   { action: 'get', agentId }                  → datos del agente + prompt
//   { action: 'update-prompt', agentId, prompt } → guarda el general_prompt
//
// 'agentId' es el id (uuid) de la fila en public.agents (no el de Retell).
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

  const { action, agentId, prompt } = await req.json().catch(() => ({}))
  if (action !== 'get' && action !== 'update-prompt') {
    return json({ error: 'Acción no permitida' }, 400)
  }
  if (!agentId) return json({ error: 'agentId requerido' }, 400)

  const admin = adminClient()

  // Verificar que el agente pertenece al cliente autenticado.
  const { data: agent } = await admin
    .from('agents')
    .select('retell_agent_id, name')
    .eq('id', agentId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!agent?.retell_agent_id) {
    return json({ error: 'Agente no encontrado' }, 404)
  }

  // API key de Retell del cliente (cifrada en BD).
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

  // Datos del agente en Retell (para saber qué motor de respuesta usa).
  const agentRes = await fetch(
    `${RETELL_BASE}/get-agent/${agent.retell_agent_id}`,
    { headers },
  )
  const agentData = await agentRes.json().catch(() => null)
  if (!agentRes.ok || !agentData) {
    return json({ error: 'No se pudo leer el agente en Retell' }, agentRes.status || 502)
  }

  const engine = agentData.response_engine ?? {}
  const isLlm = engine.type === 'retell-llm' && engine.llm_id
  const llmId = engine.llm_id as string | undefined

  if (action === 'get') {
    // Sin LLM editable (p. ej. conversation flow): devolvemos no editable.
    if (!isLlm) {
      return json({
        editable: false,
        agent_name: agentData.agent_name ?? agent.name,
        voice_id: agentData.voice_id ?? null,
        language: agentData.language ?? null,
        engine_type: engine.type ?? 'desconocido',
        prompt: '',
      })
    }
    const llmRes = await fetch(`${RETELL_BASE}/get-retell-llm/${llmId}`, { headers })
    const llm = await llmRes.json().catch(() => null)
    if (!llmRes.ok || !llm) {
      return json({ error: 'No se pudo leer el prompt del agente' }, llmRes.status || 502)
    }
    return json({
      editable: true,
      agent_name: agentData.agent_name ?? agent.name,
      voice_id: agentData.voice_id ?? null,
      language: agentData.language ?? null,
      engine_type: 'retell-llm',
      prompt: llm.general_prompt ?? '',
    })
  }

  // action === 'update-prompt'
  if (!isLlm) {
    return json(
      { error: 'Este agente no usa un prompt editable (conversation flow).' },
      400,
    )
  }
  if (typeof prompt !== 'string') {
    return json({ error: 'prompt requerido' }, 400)
  }

  const upd = await fetch(`${RETELL_BASE}/update-retell-llm/${llmId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ general_prompt: prompt }),
  })
  const updData = await upd.json().catch(() => null)
  if (!upd.ok) {
    return json(
      { error: updData?.message ?? 'No se pudo guardar el prompt' },
      upd.status || 502,
    )
  }
  return json({ ok: true })
})
