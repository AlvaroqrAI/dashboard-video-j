import { corsHeaders, json } from '../_shared/cors.ts'
import { adminClient } from '../_shared/auth.ts'
import { isSignedByOwner } from '../_shared/retellSignature.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Cuerpo en crudo: hace falta byte a byte para verificar la firma de Retell.
  const raw = await req.text()
  let body: any = {}
  try { body = JSON.parse(raw) } catch { /* cuerpo inválido: falla abajo por falta de parámetros */ }

  // Retell envía { call: { agent_id, ... }, date, time }
  const agent_id: string | undefined = body?.call?.agent_id
  const date: string | undefined = body?.date
  const time: string | undefined = body?.time

  console.log('[check-availability]', { agent_id, date, time })

  if (!agent_id || !date || !time) {
    return json({ available: false, reason: `Faltan parámetros: ${JSON.stringify({ agent_id, date, time })}` }, 400)
  }

  const admin = adminClient()

  const { data: agentRow } = await admin
    .from('agents')
    .select('user_id')
    .eq('retell_agent_id', agent_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!agentRow) return json({ available: false, reason: 'Agente no encontrado' }, 404)

  // Solo Retell, firmando con la API key del dueño del agente, puede invocar esta tool.
  if (!(await isSignedByOwner(req, raw, agentRow.user_id))) {
    console.warn('[check-availability] firma de Retell ausente o inválida', { agent_id })
    return json({ available: false, reason: 'No autorizado' }, 401)
  }

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
