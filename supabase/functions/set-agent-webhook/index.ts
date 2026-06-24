// Configura el "agent-level webhook URL" de Retell para un agente.
// Solo admin. Hace PATCH /update-agent/{agent_id} con webhook_url apuntando a
// nuestra función retell-webhook, usando la API key del cliente dueño del agente.
// Doc Retell: si se fija webhook_url en el agente, Retell envía los eventos de
// ese agente a esta URL (ignora el webhook a nivel de cuenta).
//
// Body: { agentId }   (id uuid de la fila en public.agents)
import { corsHeaders, json } from '../_shared/cors.ts'
import { adminClient, getUser } from '../_shared/auth.ts'
import { decrypt } from '../_shared/crypto.ts'

const RETELL_BASE = 'https://api.retellai.com'

// Deriva la URL pública de la función retell-webhook a partir de SUPABASE_URL.
function webhookUrl(): string {
  const ref = new URL(Deno.env.get('SUPABASE_URL')!).host.split('.')[0]
  return `https://${ref}.functions.supabase.co/retell-webhook`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const user = await getUser(req)
  if (!user) return json({ error: 'No autorizado' }, 401)

  const admin = adminClient()

  // Solo administradores.
  const { data: me } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (me?.role !== 'admin') return json({ error: 'No autorizado' }, 403)

  const { agentId } = await req.json().catch(() => ({}))
  if (!agentId) return json({ error: 'agentId requerido' }, 400)

  const { data: agent } = await admin
    .from('agents')
    .select('retell_agent_id, user_id')
    .eq('id', agentId)
    .maybeSingle()
  if (!agent?.retell_agent_id) {
    return json({ error: 'El agente no tiene Agent ID de Retell' }, 400)
  }
  if (!agent.user_id) {
    return json(
      { error: 'Asigna el agente a un cliente antes de configurar el webhook' },
      400,
    )
  }

  // Key de Retell del cliente dueño del agente.
  const { data: integration } = await admin
    .from('retell_integrations')
    .select('api_key_encrypted')
    .eq('user_id', agent.user_id)
    .maybeSingle()
  if (!integration) {
    return json(
      { error: 'El cliente no tiene API Key de Retell conectada' },
      400,
    )
  }
  const apiKey = await decrypt(integration.api_key_encrypted)

  const url = webhookUrl()
  const res = await fetch(`${RETELL_BASE}/update-agent/${agent.retell_agent_id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      webhook_url: url,
      webhook_events: ['call_started', 'call_ended', 'call_analyzed'],
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    return json(
      { error: data?.message ?? 'No se pudo configurar el webhook en Retell' },
      res.status || 502,
    )
  }

  // Guardamos la URL configurada como registro.
  await admin.from('agents').update({ webhook_url: url }).eq('id', agentId)

  return json({ ok: true, webhook_url: url })
})
