import { corsHeaders, json } from '../_shared/cors.ts'
import { adminClient } from '../_shared/auth.ts'

// Tool de Retell: comprueba si hay hueco para una cita
// Body: { agent_id, date: "YYYY-MM-DD", time: "HH:MM" }
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { agent_id, date, time } = await req.json()
  if (!agent_id || !date || !time) {
    return json({ available: false, reason: 'Faltan parámetros: agent_id, date, time' }, 400)
  }

  const admin = adminClient()

  // Obtener user_id y capacidad máxima del taller via el agente
  const { data: agentRow } = await admin
    .from('agents')
    .select('user_id')
    .eq('retell_agent_id', agent_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!agentRow) return json({ available: false, reason: 'Agente no encontrado' }, 404)

  const { data: profile } = await admin
    .from('profiles')
    .select('max_concurrent_appointments')
    .eq('id', agentRow.user_id)
    .single()

  const maxSlots = profile?.max_concurrent_appointments ?? 2

  // Contar citas existentes en ese slot
  const { count } = await admin
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', agentRow.user_id)
    .eq('appointment_date', date)
    .eq('appointment_time', time)
    .neq('status', 'cancelled')

  const booked = count ?? 0
  const available = booked < maxSlots

  return json({
    available,
    booked,
    max_slots: maxSlots,
    slots_left: Math.max(0, maxSlots - booked),
    message: available
      ? `Hay disponibilidad el ${date} a las ${time}.`
      : `No hay disponibilidad el ${date} a las ${time}. Quedan 0 huecos.`,
  })
})
