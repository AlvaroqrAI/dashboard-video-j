// Tool de Retell: ¿hay hueco en la agenda del taller?
// Recibe la fecha y hora que pide el cliente (date + time, o start_time ISO) y
// responde si está libre y, siempre, hasta 3 alternativas cercanas para que el
// agente pueda ofrecerlas sin volver a preguntar.
import { corsHeaders, json } from '../_shared/cors.ts'
import { adminClient } from '../_shared/auth.ts'
import { isAuthorizedTool } from '../_shared/retellSignature.ts'
import { describeSlot, loadAgenda, parseRequestedSlot, toolArgs } from '../_shared/agenda.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Cuerpo en crudo: hace falta byte a byte para verificar la firma de Retell.
  const raw = await req.text()
  let body: any = {}
  try { body = JSON.parse(raw) } catch { /* cuerpo inválido: falla abajo por falta de parámetros */ }

  const agent_id: string | undefined = body?.call?.agent_id
  const { date, time } = parseRequestedSlot(toolArgs(body))

  console.log('[check-availability]', { agent_id, date, time })

  if (!agent_id || !date) {
    return json({ available: false, reason: 'Falta el día que quiere el cliente.' }, 400)
  }

  const { data: agentRow } = await adminClient()
    .from('agents')
    .select('user_id')
    .eq('retell_agent_id', agent_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!agentRow) return json({ available: false, reason: 'Agente no encontrado' }, 404)

  // Solo Retell (firma o cabecera secreta) puede invocar esta tool.
  if (!(await isAuthorizedTool(req, raw, agentRow.user_id))) {
    console.warn('[check-availability] petición no autorizada', { agent_id })
    return json({ available: false, reason: 'No autorizado' }, 401)
  }

  const agenda = await loadAgenda(agentRow.user_id)
  const alternativas = agenda.alternatives(date, time)

  if (time && agenda.isFree(date, time)) {
    return json({
      available: true,
      date, time,
      message: `Hay hueco el ${describeSlot(date, time)}.`,
      alternativas,
    })
  }

  const motivo = !time
    ? 'Estos son los primeros huecos libres.'
    : agenda.isOpenSlot(date, time)
      ? `El ${describeSlot(date, time)} ya está completo.`
      : `El ${describeSlot(date, time)} el taller está cerrado o es demasiado pronto.`

  return json({
    available: false,
    date, time: time ?? null,
    message: alternativas.length
      ? `${motivo} Huecos más cercanos: ${alternativas.map((a) => a.texto).join('; ')}.`
      : `${motivo} No hay huecos libres en los próximos días.`,
    alternativas,
  })
})
