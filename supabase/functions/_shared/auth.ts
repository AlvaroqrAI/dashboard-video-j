import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Cliente con service_role (ignora RLS). Úsalo SOLO en el backend.
 */
export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

/**
 * Resuelve el usuario autenticado a partir del header Authorization de la
 * petición. Devuelve null si el token no es válido.
 */
export async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data, error } = await supabase.auth.getUser()
  if (error) return null
  return data.user
}
