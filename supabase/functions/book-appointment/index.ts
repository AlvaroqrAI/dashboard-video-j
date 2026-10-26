// Tool de Retell: agenda la cita en la agenda del taller (tabla appointments,
// la que lee el calendario del panel).
import { corsHeaders, json } from '../_shared/cors.ts'
import { adminClient } from '../_shared/auth.ts'
import { isAuthorizedTool } from '../_shared/retellSignature.ts'
import { describeSlot, loadAgenda, parseRequestedSlot, toolArgs } from '../_shared/agenda.ts'

// "+34 637 61 92 76" → "+34637619276". Si no hay 9 cifras, se guarda tal cual.
function normalizePhone(v: unknown): string | null {
  if (v == null || v === '') return null
  const digits = String(v).replace(/\D/g, '')
  if (digits.length === 9) return `+34${digits}`
  if (digits.length === 11 && digits.startsWith('34')) return `+${digits}`
  return String(v)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Cuerpo en crudo: hace falta byte a byte para verificar la firma de Retell.
  const raw = await req.text()
  let body: any = {}
  try { body = JSON.parse(raw) } catch { /* cuerpo inválido: falla abajo por falta de parámetros */ }

  const args = toolArgs(body)
  const agent_id: string | undefined = body?.call?.agent_id
  const call_id: string | undefined = body?.call?.call_id
  const { date, time } = parseRequestedSlot(args)
  const client_name = (args.client_name ?? args.name ?? null) as string | null
  const client_phone = normalizePhone(args.client_phone ?? args.phone ?? body?.call?.from_number)
  const car_model = (args.car_model ?? null) as string | null
  const reason = (args.reason ?? null) as string | null
  // Normalizada (sin espacios/guiones, mayúsculas) para que "1234 BCD" y "1234-bcd"
  // reconozcan el mismo vehículo.
  const plate = args.plate ? String(args.plate).toUpperCase().replace(/[\s-]/g, '') : null

  console.log('[book-appointment]', { agent_id, call_id, date, time })

  if (!agent_id || !date || !time) {
    return json({ success: false, reason: 'Faltan el día o la hora de la cita.' }, 400)
  }

  const admin = adminClient()

  const { data: agentRow } = await admin
    .from('agents')
    .select('user_id')
    .eq('retell_agent_id', agent_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!agentRow) return json({ success: false, reason: 'Agente no encontrado' }, 404)

  // Solo Retell (firma o cabecera secreta) puede invocar esta tool.
  if (!(await isAuthorizedTool(req, raw, agentRow.user_id))) {
    console.warn('[book-appointment] petición no autorizada', { agent_id })
    return json({ success: false, reason: 'No autorizado' }, 401)
  }

  const agenda = await loadAgenda(agentRow.user_id)
  if (!agenda.isFree(date, time)) {
    const alternativas = agenda.alternatives(date, time)
    return json({
      success: false,
      reason: `El ${describeSlot(date, time)} no está disponible.`,
      message: alternativas.length
        ? `Ese hueco ya no está libre. Huecos más cercanos: ${alternativas.map((a) => a.texto).join('; ')}.`
        : 'Ese hueco ya no está libre y no hay huecos en los próximos días.',
      alternativas,
    })
  }

  // La cita apunta a la llamada (FK a call_logs), pero el webhook de Retell solo
  // guarda la llamada al colgar. Creamos ya la fila mínima; el webhook la completa
  // después (upsert por call_id) sin pisar is_appointment.
  if (call_id) {
    await admin.from('call_logs').upsert({
      call_id,
      user_id: agentRow.user_id,
      agent_id,
      call_status: 'ongoing',
      start_timestamp: new Date().toISOString(),
      from_number: body?.call?.from_number ?? null,
      is_appointment: true,
    }, { onConflict: 'call_id', ignoreDuplicates: false })
  }

  const { data: appt, error } = await admin
    .from('appointments')
    .insert({
      user_id: agentRow.user_id,
      call_id: call_id ?? null,
      client_name,
      client_phone,
      car_model,
      plate,
      reason,
      service_name: reason,
      appointment_date: date,
      appointment_time: time,
      status: 'confirmed',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[book-appointment]', error.message)
    return json({ success: false, reason: 'No se pudo guardar la cita.' }, 500)
  }

  // Reconocimiento de vehículo: si hay matrícula, guarda/actualiza el registro
  // persistente para que la próxima vez que llame ya se le reconozca.
  if (plate) {
    await admin
      .from('vehicles')
      .upsert({
        user_id: agentRow.user_id,
        plate,
        car_model,
        client_name,
        client_phone,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,plate' })
  }

  return json({
    success: true,
    appointment_id: appt.id,
    message: `Cita confirmada para el ${describeSlot(date, time)}.`,
  })
})
