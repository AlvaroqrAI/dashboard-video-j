// Envío de email vía Gmail API con OAuth2 (solo HTTPS, sin SMTP).
// client_id/secret vienen de secrets (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET).
// El refresh_token y el remitente se guardan en la tabla gmail_integration
// (los rellena el flujo "Conectar con Google" del panel de admin).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decrypt } from './crypto.ts'

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`
}

function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

// Intercambia un refresh_token por un access_token.
export async function getAccessToken(refreshToken: string): Promise<string> {
  const clientId = Deno.env.get('GMAIL_CLIENT_ID')
  const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    throw new Error('Faltan GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET')
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`OAuth Google: ${JSON.stringify(data)}`)
  return data.access_token as string
}

// Lee la conexión de Gmail desde la BD (refresh_token descifrado + remitente).
// El remitente (sender) puede faltar en conexiones antiguas que solo pidieron el
// scope gmail.send; en ese caso se intenta recuperar en el envío.
async function getGmailConfig(): Promise<{ refreshToken: string; sender: string | null }> {
  const { data } = await admin()
    .from('gmail_integration')
    .select('sender, refresh_token_encrypted')
    .eq('id', 'default')
    .single()
  if (!data?.refresh_token_encrypted) {
    throw new Error('Gmail no conectado. Conéctalo en Ajustes del admin.')
  }
  return {
    refreshToken: await decrypt(data.refresh_token_encrypted),
    sender: data.sender ?? null,
  }
}

// Recupera el email de la cuenta conectada (requiere el scope userinfo.email).
async function fetchSenderEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    return (data?.email as string) ?? null
  } catch {
    return null
  }
}

// Construye la cabecera From con nombre visible. Si el nombre lleva caracteres
// no ASCII se codifica (RFC 2047); si no, se deja legible.
function formatFrom(name: string, email: string): string {
  const isAscii = /^[\x20-\x7E]*$/.test(name)
  const display = isAscii ? name : encodeSubject(name)
  return `${display} <${email}>`
}

export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
  fromName?: string
}): Promise<void> {
  const { refreshToken, sender: storedSender } = await getGmailConfig()
  const token = await getAccessToken(refreshToken)

  // Si no tenemos guardado el remitente, lo recuperamos y persistimos
  // (autocuración de conexiones antiguas que no capturaron el email).
  let sender = storedSender
  if (!sender) {
    sender = await fetchSenderEmail(token)
    if (sender) {
      await admin().from('gmail_integration').update({ sender }).eq('id', 'default')
    }
  }

  const displayName = opts.fromName ?? 'Voice Dashboard'
  const mime = [
    // Con remitente conocido: "Voice Dashboard <email>". Sin él, omitimos From y
    // Gmail usa la cuenta autenticada (sin nombre visible) para no bloquear el envío.
    ...(sender ? [`From: ${formatFrom(displayName, sender)}`] : []),
    `To: ${opts.to}`,
    `Subject: ${encodeSubject(opts.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    opts.html,
  ].join('\r\n')

  const raw = b64url(new TextEncoder().encode(mime))

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(`Gmail send: ${JSON.stringify(err)}`)
  }
}
