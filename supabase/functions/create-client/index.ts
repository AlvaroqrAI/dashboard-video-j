// Solo el admin puede llamar a esta función.
// Crea un usuario en auth.users, su perfil (role='client') y su integración Retell.
// Body: { email, password, full_name, retellApiKey? }
// Si no se pasa retellApiKey, se usa la clave por defecto (RETELL_API_KEY).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser } from '../_shared/auth.ts'
import { encrypt } from '../_shared/crypto.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const caller = await getUser(req)
  if (!caller) return json({ error: 'No autorizado' }, 401)

  // Verificar que el caller es admin consultando su perfil con service_role.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return json({ error: 'Solo los administradores pueden crear clientes' }, 403)
  }

  const { email, password, full_name, retellApiKey } = await req
    .json()
    .catch(() => ({}))
  if (!email || !password) return json({ error: 'email y password son requeridos' }, 400)

  // Clave de Retell: la que indique el admin o, si no, la por defecto del sistema.
  const apiKey = (retellApiKey && String(retellApiKey).trim()) ||
    Deno.env.get('RETELL_API_KEY')

  // Si el admin pasó una clave, validarla contra Retell antes de crear nada.
  if (retellApiKey) {
    const check = await fetch('https://api.retellai.com/list-agents', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!check.ok) {
      return json({ error: 'La API Key de Retell indicada no es válida' }, 400)
    }
  }

  // Crear el usuario con la Admin API (service_role).
  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // No requiere confirmación de email.
    user_metadata: { full_name },
  })

  if (createErr) return json({ error: createErr.message }, 400)

  // El trigger on_auth_user_created ya creó el perfil; actualizamos full_name y rol.
  await admin
    .from('profiles')
    .update({ full_name: full_name ?? null, role: 'client' })
    .eq('id', newUser.user.id)

  // Guardar la integración de Retell (cifrada) para el nuevo cliente.
  if (apiKey) {
    try {
      const encrypted = await encrypt(apiKey)
      await admin.from('retell_integrations').upsert({
        user_id: newUser.user.id,
        api_key_encrypted: encrypted,
        connected_at: new Date().toISOString(),
      })
    } catch (_e) {
      // No bloquear la creación del cliente si falla el guardado de la clave.
    }
  }

  return json({ ok: true, user_id: newUser.user.id })
})
