import { corsHeaders, json } from '../_shared/cors.ts'
import { adminClient } from '../_shared/auth.ts'
import { isSignedByOwner } from '../_shared/retellSignature.ts'

// Mensajes de usted: los lee el agente de voz al cliente.
const STATUS_MESSAGE: Record<string, string> = {
  recibido: 'Hemos recibido su coche y está pendiente de diagnóstico.',
  diagnostico: 'Su coche está en diagnóstico, todavía estamos viendo qué necesita.',
  en_reparacion: 'Su coche está en reparación ahora mismo.',
  listo: 'Su coche ya está listo, puede pasar a recogerlo.',
  entregado: 'Ese coche ya se entregó.',
}

// Últimas 9 cifras: así +34 637 61 92 76 y 637619276 se consideran el mismo número.
function last9(phone: unknown): string | null {
  const d = String(phone ?? '').replace(/\D/g, '')
  return d.length >= 9 ? d.slice(-9) : null
}

// Palabras de un nombre en minúsculas y sin tildes.
function nameTokens(name: unknown): string[] {
  return String(name ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().split(/[^a-zñ]+/).filter((t) => t.length >= 2)
}

// El nombre dado coincide si contiene al menos dos palabras del nombre
// registrado (nombre y apellido), o la única si solo hay una.
function nameMatches(given: unknown, stored: unknown): boolean {
  const g = new Set(nameTokens(given))
  const s = nameTokens(stored)
  if (!g.size || !s.length) return false
  const hits = s.filter((t) => g.has(t)).length
  return hits >= Math.min(2, s.length)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Cuerpo en crudo: hace falta byte a byte para verificar la firma de Retell.
  const raw = await req.text()
  let body: any = {}
  try { body = JSON.parse(raw) } catch { /* cuerpo inválido: falla abajo por falta de parámetros */ }

  // Retell envía { call: { agent_id, from_number }, plate, client_name? }.
  // La matrícula identifica el coche; el teléfono de la llamada o el nombre del
  // titular verifican que quien pregunta es el dueño, antes de dar el estado.
  const agent_id: string | undefined = body?.call?.agent_id
  const caller_phone: string | undefined = body?.call?.from_number
  const args = body?.args ?? body
  const client_name: string | undefined = args?.client_name
  const plate: string | undefined = args?.plate ? String(args.plate).toUpperCase().replace(/[\s-]/g, '') : undefined

  console.log('[consultar-estado-reparacion]', { agent_id, plate, has_caller: !!caller_phone, has_name: !!client_name })

  if (!agent_id || !plate) {
    return json({ found: false, message: 'Necesito la matrícula del coche para buscarlo.' }, 400)
  }

  const admin = adminClient()

  const { data: agentRow } = await admin
    .from('agents')
    .select('user_id')
    .eq('retell_agent_id', agent_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!agentRow) return json({ found: false, message: 'Agente no encontrado' }, 404)

  // Solo Retell, firmando con la API key del dueño del agente, puede invocar esta tool.
  if (!(await isSignedByOwner(req, raw, agentRow.user_id))) {
    console.warn('[consultar-estado-reparacion] firma de Retell ausente o inválida', { agent_id })
    return json({ found: false, message: 'No autorizado' }, 401)
  }

  // En el panel la matrícula puede estar guardada con espacio ("2622 LMN"):
  // se compara sin espacios ni guiones.
  const { data: vehicles } = await admin
    .from('vehicles')
    .select('id, plate, car_model, client_name, client_phone')
    .eq('user_id', agentRow.user_id)
    .ilike('plate', `%${plate.slice(-3)}%`)
  const vehicle = (vehicles ?? []).find((v) => v.plate.toUpperCase().replace(/[\s-]/g, '') === plate) ?? null

  if (!vehicle) {
    return json({ found: false, message: 'No encuentro ningún coche con esa matrícula en el sistema.' })
  }

  // Verificación del titular: coincide el teléfono desde el que llama o el nombre.
  // Sin verificar no se devuelve nada del coche (ni modelo ni estado).
  const callerKey = last9(caller_phone)
  const phoneOk = !!callerKey && callerKey === last9(vehicle.client_phone)
  const nameOk = nameMatches(client_name, vehicle.client_name)
  if (!phoneOk && !nameOk) {
    console.warn('[consultar-estado-reparacion] titular no verificado', { agent_id, plate })
    return json({
      found: true,
      verified: false,
      message: 'Por seguridad no puedo dar el estado del coche si no coincide con los datos del titular. Que el taller le llame.',
    })
  }

  const { data: repair } = await admin
    .from('repairs')
    .select('status, description, updated_at')
    .eq('vehicle_id', vehicle.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!repair) {
    return json({
      found: true,
      verified: true,
      has_repair: false,
      vehicle: { plate: vehicle.plate, car_model: vehicle.car_model },
      message: `Encuentro el vehículo ${vehicle.car_model ?? ''} con matrícula ${vehicle.plate}, pero no tiene ninguna reparación abierta en este momento.`,
    })
  }

  return json({
    found: true,
    verified: true,
    has_repair: true,
    vehicle: { plate: vehicle.plate, car_model: vehicle.car_model },
    status: repair.status,
    description: repair.description,
    message: `${STATUS_MESSAGE[repair.status] ?? ''} ${repair.description ? `(${repair.description})` : ''}`.trim(),
  })
})
