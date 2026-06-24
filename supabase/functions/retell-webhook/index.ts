// Webhook de Retell: recibe los eventos de llamada y los guarda en call_logs.
// La página de Llamadas (cliente y admin) se sirve desde esta tabla.
//
// Configúralo en Retell apuntando a:
//   https://<PROJECT_REF>.functions.supabase.co/retell-webhook
//
// Seguridad (verify_jwt=false, lo invoca Retell):
//  - Mapeo agent_id → cliente dueño vía tabla agents (gate principal).
//  - Verificación de firma X-Retell-Signature según la doc oficial de Retell:
//    header con formato  v={timestampMs},d={hexDigest}
//    digest = HMAC-SHA256(raw_body + timestamp, api_key)  en hex.
//    Por defecto FAIL-OPEN: si la firma no valida (p. ej. la key guardada no es
//    la que tiene el "webhook badge" en Retell) se registra un aviso pero el
//    evento se procesa igualmente, para no perder llamadas. Pon la variable de
//    entorno RETELL_WEBHOOK_STRICT=true para rechazar (401) firmas inválidas.
import { corsHeaders, json } from '../_shared/cors.ts'
import { adminClient } from '../_shared/auth.ts'
import { decrypt } from '../_shared/crypto.ts'

const FIVE_MIN_MS = 5 * 60 * 1000

// HMAC-SHA256(payload, secret) en hex.
async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Comparación en tiempo constante de dos cadenas hex.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Verifica la firma de Retell: header "v={ts},d={digest}".
// Devuelve 'valid' | 'invalid' | 'skip' (no se pudo verificar por falta de datos).
async function verifyRetellSignature(
  rawBody: string,
  apiKey: string | null,
  header: string | null,
): Promise<'valid' | 'invalid' | 'skip'> {
  if (!apiKey || !header) return 'skip'
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=')
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()]
    }),
  ) as { v?: string; d?: string }
  const ts = parts.v
  const provided = parts.d
  if (!ts || !provided) return 'skip'

  // Anti-replay: el timestamp debe estar dentro de ±5 minutos.
  const now = Date.now()
  if (Math.abs(now - Number(ts)) > FIVE_MIN_MS) return 'invalid'

  const expected = await hmacHex(apiKey, rawBody + ts)
  return timingSafeEqual(expected, provided) ? 'valid' : 'invalid'
}

function toIso(ms?: number): string | null {
  return typeof ms === 'number' ? new Date(ms).toISOString() : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  // Cuerpo en crudo: necesario para verificar la firma byte a byte.
  const raw = await req.text()
  let payload: { event?: string; call?: Record<string, unknown> }
  try {
    payload = JSON.parse(raw)
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const call = payload.call ?? {}
  const event = payload.event
  const agentId = call.agent_id as string | undefined
  const callId = call.call_id as string | undefined
  if (!agentId || !callId) return json({ ok: true }) // nada que guardar

  const admin = adminClient()

  // Mapear el agente de Retell → cliente dueño (gate principal + RLS).
  // Puede haber VARIAS filas con el mismo retell_agent_id (el admin duplicó un
  // agente); tomamos la más antigua. Por eso NO usamos .maybeSingle(), que
  // devolvería error con >1 fila y descartaría la llamada.
  const { data: agents } = await admin
    .from('agents')
    .select('user_id, name')
    .eq('retell_agent_id', agentId)
    .order('created_at', { ascending: true })
    .limit(1)
  const agent = agents?.[0]

  // Agente desconocido: 200 para que Retell no reintente.
  if (!agent?.user_id) return json({ ok: true, ignored: 'unknown_agent' })

  // Verificación de firma (best-effort).
  const signature = req.headers.get('x-retell-signature')
  const { data: integration } = await admin
    .from('retell_integrations')
    .select('api_key_encrypted')
    .eq('user_id', agent.user_id)
    .maybeSingle()
  const apiKey = integration?.api_key_encrypted
    ? await decrypt(integration.api_key_encrypted)
    : null

  const verdict = await verifyRetellSignature(raw, apiKey, signature)
  const strict = Deno.env.get('RETELL_WEBHOOK_STRICT') === 'true'
  if (verdict === 'invalid') {
    console.warn(`[retell-webhook] firma inválida para call ${callId} (agente ${agentId})`)
    if (strict) return json({ error: 'Firma inválida' }, 401)
  } else if (verdict === 'skip') {
    console.warn(`[retell-webhook] firma no verificada (sin key/header) para call ${callId}`)
  }

  // Guardamos solo los eventos finales con datos útiles.
  // call_ended: todo menos el análisis. call_analyzed: todo + call_analysis.
  if (event !== 'call_ended' && event !== 'call_analyzed') {
    return json({ ok: true, ignored: event ?? 'sin_evento' })
  }

  const analysis = (call.call_analysis ?? {}) as Record<string, unknown>
  const cost = (call.call_cost ?? {}) as Record<string, unknown>
  const row = {
    call_id: callId,
    user_id: agent.user_id,
    agent_id: agentId,
    agent_name: (call.agent_name as string) ?? agent.name ?? null,
    direction: (call.direction as string) ?? null,
    call_type: (call.call_type as string) ?? null,
    call_status: (call.call_status as string) ?? null,
    from_number: (call.from_number as string) ?? null,
    to_number: (call.to_number as string) ?? null,
    duration_ms:
      (call.duration_ms as number) ??
      (typeof call.end_timestamp === 'number' &&
      typeof call.start_timestamp === 'number'
        ? (call.end_timestamp as number) - (call.start_timestamp as number)
        : null),
    start_timestamp: toIso(call.start_timestamp as number),
    end_timestamp: toIso(call.end_timestamp as number),
    recording_url: (call.recording_url as string) ?? null,
    transcript: (call.transcript as string) ?? null,
    call_summary: (analysis.call_summary as string) ?? null,
    user_sentiment: (analysis.user_sentiment as string) ?? null,
    call_successful: (analysis.call_successful as boolean) ?? null,
    disconnection_reason: (call.disconnection_reason as string) ?? null,
    cost_cents:
      typeof cost.combined_cost === 'number'
        ? Math.round(cost.combined_cost as number)
        : null,
    raw: call,
    updated_at: new Date().toISOString(),
  }

  const { error } = await admin
    .from('call_logs')
    .upsert(row, { onConflict: 'call_id' })

  if (error) {
    console.error('[retell-webhook] error guardando call_log:', error.message)
    return json({ error: error.message }, 500)
  }
  return json({ ok: true })
})
