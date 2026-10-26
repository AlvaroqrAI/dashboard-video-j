// Verificación de la firma X-Retell-Signature, compartida por el webhook de
// llamadas y por las tools que invoca el agente (check-availability,
// book-appointment, consultar-estado-reparacion).
//
// Formato del header según la doc oficial de Retell:  v={timestampMs},d={hexDigest}
// digest = HMAC-SHA256(raw_body + timestamp, api_key)  en hex.
// La api_key es la de la cuenta de Retell del cliente dueño del agente,
// guardada cifrada en retell_integrations.
import { adminClient } from './auth.ts'
import { decrypt } from './crypto.ts'

const FIVE_MIN_MS = 5 * 60 * 1000

export type SignatureVerdict = 'valid' | 'invalid' | 'skip'

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
export async function verifyRetellSignature(
  rawBody: string,
  apiKey: string | null,
  header: string | null,
): Promise<SignatureVerdict> {
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
  if (Math.abs(Date.now() - Number(ts)) > FIVE_MIN_MS) return 'invalid'

  const expected = await hmacHex(apiKey, rawBody + ts)
  return timingSafeEqual(expected, provided) ? 'valid' : 'invalid'
}

// API key de Retell (descifrada) del cliente dueño del usuario indicado.
export async function retellKeyForUser(userId: string): Promise<string | null> {
  const { data } = await adminClient()
    .from('retell_integrations')
    .select('api_key_encrypted')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.api_key_encrypted ? await decrypt(data.api_key_encrypted) : null
}

// Para las tools del agente (verify_jwt=false): solo se aceptan peticiones con
// firma de Retell válida para la cuenta del dueño del agente. Sin esto,
// cualquiera que conociera un agent_id podía crear citas o leer el estado de
// reparación (nombre, coche) de los clientes del taller.
//
// La key es la del cliente (retell_integrations) si la tiene guardada; si no,
// la de la cuenta de Retell de MecanIA (secreto RETELL_API_KEY), que es donde
// viven hoy los agentes de todos los talleres.
export async function isSignedByOwner(
  req: Request,
  rawBody: string,
  userId: string,
): Promise<boolean> {
  const apiKey = (await retellKeyForUser(userId)) ?? Deno.env.get('RETELL_API_KEY') ?? null
  const verdict = await verifyRetellSignature(rawBody, apiKey, req.headers.get('x-retell-signature'))
  return verdict === 'valid'
}

// Autorización de las tools: firma de Retell válida, o la cabecera
// X-Mecania-Token con el secreto MECANIA_TOOLS_TOKEN (configurada en la tool de
// Retell). La cabecera es la vía que no depende de que Retell firme las
// peticiones de las custom functions.
export async function isAuthorizedTool(
  req: Request,
  rawBody: string,
  userId: string,
): Promise<boolean> {
  const expected = Deno.env.get('MECANIA_TOOLS_TOKEN')
  const given = req.headers.get('x-mecania-token')
  if (expected && given && given.length === expected.length) {
    let diff = 0
    for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i)
    if (diff === 0) return true
  }
  return await isSignedByOwner(req, rawBody, userId)
}
