// Envía un SMS al cliente (p.ej. "tu coche está listo"). Diseñado para netelip
// (netelip.com/envio-sms-empresas-desde-api-o-web) — el taller ya tiene cuenta
// allí. Sin NETELIP_API_KEY configurada, no falla: devuelve sent:false para que
// el dashboard lo muestre como aviso, no como error, y el resto del flujo sigue.
import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const caller = await getUser(req)
    if (!caller) return json({ error: 'No autorizado' }, 401)

    const { to, message } = await req.json().catch(() => ({}))
    if (!to || !message) return json({ error: 'to y message son requeridos' }, 400)

    const apiKey = Deno.env.get('NETELIP_API_KEY')
    if (!apiKey) {
      console.warn('[send-sms] NETELIP_API_KEY no configurada, SMS no enviado')
      return json({ sent: false, reason: 'sms_not_configured' })
    }

    // TODO: pendiente de confirmar el endpoint/formato exacto de la API de SMS
    // de netelip con la documentación técnica de su cuenta. Estructura orientativa:
    // const res = await fetch('https://api.netelip.com/v1/sms', {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ to, from: 'MecanIA', text: message }),
    // })
    // if (!res.ok) return json({ sent: false, reason: await res.text() }, 502)

    return json({ sent: false, reason: 'sms_not_wired_yet' })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
