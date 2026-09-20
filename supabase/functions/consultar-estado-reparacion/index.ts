import { corsHeaders, json } from '../_shared/cors.ts'
import { adminClient } from '../_shared/auth.ts'

const STATUS_MESSAGE: Record<string, string> = {
  recibido: 'Hemos recibido tu coche y está pendiente de diagnóstico.',
  diagnostico: 'Tu coche está en diagnóstico, todavía estamos viendo qué necesita.',
  en_reparacion: 'Tu coche está en reparación ahora mismo.',
  listo: 'Tu coche ya está listo, puedes pasar a recogerlo.',
  entregado: 'Ese coche ya fue entregado.',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const body = await req.json().catch(() => ({}))

  // Retell envía { call: { agent_id }, plate?, client_phone? } — el agente pasa
  // lo que tenga: matrícula si la dice el cliente, o el teléfono de la llamada.
  const agent_id: string | undefined = body?.call?.agent_id
  const client_phone: string | undefined = body?.call?.from_number ?? body?.client_phone
  const plate: string | undefined = body?.plate ? String(body.plate).toUpperCase().replace(/[\s-]/g, '') : undefined

  console.log('[consultar-estado-reparacion]', { agent_id, plate, client_phone })

  if (!agent_id || (!plate && !client_phone)) {
    return json({ found: false, message: 'Necesito la matrícula o el teléfono para buscar el coche.' }, 400)
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

  let vehicleQuery = admin.from('vehicles').select('id, plate, car_model, client_name').eq('user_id', agentRow.user_id)
  vehicleQuery = plate ? vehicleQuery.eq('plate', plate) : vehicleQuery.eq('client_phone', client_phone!)

  const { data: vehicle } = await vehicleQuery.order('updated_at', { ascending: false }).limit(1).maybeSingle()

  if (!vehicle) {
    return json({ found: false, message: 'No encuentro ningún coche con esos datos en el sistema.' })
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
      has_repair: false,
      vehicle: { plate: vehicle.plate, car_model: vehicle.car_model },
      message: `Encuentro el vehículo ${vehicle.car_model ?? ''} con matrícula ${vehicle.plate}, pero no tiene ninguna reparación abierta en este momento.`,
    })
  }

  return json({
    found: true,
    has_repair: true,
    vehicle: { plate: vehicle.plate, car_model: vehicle.car_model },
    status: repair.status,
    description: repair.description,
    message: `${STATUS_MESSAGE[repair.status] ?? ''} ${repair.description ? `(${repair.description})` : ''}`.trim(),
  })
})
