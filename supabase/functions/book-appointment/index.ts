import { corsHeaders, json } from '../_shared/cors.ts'
import { adminClient } from '../_shared/auth.ts'

// Tool de Retell: agenda una cita
// Body: { agent_id, call_id?, client_name, client_phone, car_model, plate, reason, date, time }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const body = await req.json()
  const { agent_id, call_id, client_name, client_phone, car_model, plate, reason, date, time } = body

  if (!agent_id || !date || !time) {
    return json({ success: false, reason: 'Faltan parámetros: agent_id, date, time' }, 400)
  }

  const admin = adminClient()

  // Obtener user_id del agente
  const { data: agentRow } = await admin
    .from('agents')
    .select('user_id')
    .eq('retell_agent_id', agent_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!agentRow) return json({ success: false, reason: 'Agente no encontrado' }, 404)

  // Verificar disponibilidad una vez más (evita race conditions)
  const { data: profile } = await admin
    .from('profiles')
    .select('max_concurrent_appointments')
    .eq('id', agentRow.user_id)
    .single()

  const maxSlots = profile?.max_concurrent_appointments ?? 2

  const { count } = await admin
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', agentRow.user_id)
    .eq('appointment_date', date)
    .eq('appointment_time', time)
    .neq('status', 'cancelled')

  if ((count ?? 0) >= maxSlots) {
    return json({ success: false, reason: 'No hay disponibilidad en ese horario.' })
  }

  // Insertar cita
  const { data: appt, error } = await admin
    .from('appointments')
    .insert({
      user_id: agentRow.user_id,
      call_id: call_id ?? null,
      client_name: client_name ?? null,
      client_phone: client_phone ?? null,
      car_model: car_model ?? null,
      plate: plate ?? null,
      reason: reason ?? null,
      appointment_date: date,
      appointment_time: time,
      status: 'confirmed',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[book-appointment]', error.message)
    return json({ success: false, reason: error.message }, 500)
  }

  // Marcar la llamada como cita agendada
  if (call_id) {
    await admin
      .from('call_logs')
      .update({ is_appointment: true })
      .eq('call_id', call_id)
  }

  return json({
    success: true,
    appointment_id: appt.id,
    message: `Cita confirmada para el ${date} a las ${time}. ¡Hasta pronto!`,
  })
})
