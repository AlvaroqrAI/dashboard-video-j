// Callback del flujo "Conectar con Google" (OAuth2 Authorization Code).
// Google redirige el navegador aquí con ?code=...&state=<jwt_admin>.
// verify_jwt=false porque la petición la hace el navegador sin apikey.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { encrypt } from '../_shared/crypto.ts'

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { Location: to } })
}

Deno.serve(async (req) => {
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'
  const settingsUrl = `${appUrl}/admin/settings`

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // JWT del admin que inició el flujo
    if (!code || !state) return redirect(`${settingsUrl}?gmail=error`)

    // Validar que quien inició el flujo es un administrador.
    const authed = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${state}` } } },
    )
    const { data: userData } = await authed.auth.getUser()
    if (!userData?.user) return redirect(`${settingsUrl}?gmail=error`)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: prof } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()
    if (prof?.role !== 'admin') return redirect(`${settingsUrl}?gmail=error`)

    // Intercambiar el code por tokens.
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/gmail-oauth-callback`
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get('GMAIL_CLIENT_ID')!,
        client_secret: Deno.env.get('GMAIL_CLIENT_SECRET')!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenRes.json().catch(() => null)
    if (!tokenRes.ok || !tokens?.refresh_token) {
      // Sin refresh_token (suele faltar si no se forzó prompt=consent).
      return redirect(`${settingsUrl}?gmail=error`)
    }

    // Obtener el email de la cuenta conectada (será el remitente) vía userinfo.
    // Se usa este endpoint (scope userinfo.email) porque el de Gmail getProfile
    // requiere scope de lectura de correo, que no pedimos.
    const profileRes = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    )
    const gprofile = await profileRes.json().catch(() => null)
    const sender = gprofile?.email ?? null

    // Guardar la conexión (refresh_token cifrado).
    const encrypted = await encrypt(tokens.refresh_token)
    await admin.from('gmail_integration').upsert({
      id: 'default',
      sender,
      refresh_token_encrypted: encrypted,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    return redirect(`${settingsUrl}?gmail=connected`)
  } catch (_e) {
    return redirect(`${settingsUrl}?gmail=error`)
  }
})
