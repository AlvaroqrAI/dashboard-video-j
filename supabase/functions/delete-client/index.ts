// Solo el admin puede llamar a esta función.
// Elimina un cliente: borra el usuario de auth.users (cascada a profile, agentes,
// alertas e integración Retell por las FK on delete cascade).
// Body: { userId }
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const caller = await getUser(req)
    if (!caller) return json({ error: 'No autorizado' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Verificar que el caller es admin.
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()
    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Solo los administradores pueden eliminar clientes' }, 403)
    }

    const { userId } = await req.json().catch(() => ({}))
    if (!userId) return json({ error: 'userId requerido' }, 400)
    if (userId === caller.id) {
      return json({ error: 'No puedes eliminar tu propia cuenta' }, 400)
    }

    // Solo permitir borrar perfiles de clientes (no otros admins).
    const { data: target } = await admin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    if (!target) return json({ error: 'Cliente no encontrado' }, 404)
    if (target.role === 'admin') {
      return json({ error: 'No se puede eliminar a un administrador' }, 403)
    }

    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) return json({ error: error.message }, 500)

    return json({ ok: true })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
