// Guarda (cifrada) la API Key de Retell del cliente autenticado.
import { corsHeaders, json } from '../_shared/cors.ts'
import { adminClient, getUser } from '../_shared/auth.ts'
import { encrypt } from '../_shared/crypto.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const user = await getUser(req)
  if (!user) return json({ error: 'No autorizado' }, 401)

  const { apiKey } = await req.json().catch(() => ({}))
  if (!apiKey || typeof apiKey !== 'string') {
    return json({ error: 'apiKey requerida' }, 400)
  }

  // Validación opcional: comprobar que la clave funciona contra la API de Retell.
  const check = await fetch('https://api.retellai.com/list-agents', {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!check.ok) {
    return json({ error: 'La API Key de Retell no es válida' }, 400)
  }

  const encrypted = await encrypt(apiKey)
  const admin = adminClient()
  const { error } = await admin.from('retell_integrations').upsert({
    user_id: user.id,
    api_key_encrypted: encrypted,
    connected_at: new Date().toISOString(),
  })

  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
})
