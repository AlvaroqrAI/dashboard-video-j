// El admin crea una alerta para un cliente y (opcionalmente) se la envía por email.
// Body: { userId, type, title, message, email? }
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser } from '../_shared/auth.ts'
import { sendEmail } from '../_shared/gmail.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const caller = await getUser(req)
    if (!caller) return json({ error: 'No autorizado' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()
    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Solo administradores' }, 403)
    }

    const { userId, type = 'info', title, message, email = true } = await req
      .json()
      .catch(() => ({}))
    if (!userId || !title) {
      return json({ error: 'userId y title son requeridos' }, 400)
    }

    // 1) Guardar la alerta (siempre).
    const { error: insErr } = await admin.from('alerts').insert({
      user_id: userId,
      type,
      title,
      message,
      created_by: caller.id,
    })
    if (insErr) return json({ error: insErr.message }, 500)

    // 2) Enviar email (best-effort: no bloquea si Gmail no está configurado).
    let emailed = false
    let emailError: string | null = null
    if (email) {
      try {
        const { data: prof } = await admin
          .from('profiles')
          .select('email, full_name')
          .eq('id', userId)
          .single()
        if (prof?.email) {
          const typeLabel: Record<string, string> = {
            info: 'Información',
            warning: 'Aviso',
            payment: 'Pago',
            critical: 'Crítico',
          }
          const label = typeLabel[type] ?? 'Notificación'
          const isCritical = type === 'critical'
          await sendEmail({
            to: prof.email,
            subject: `${label}: ${title}`,
            html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background:#ffffff;border:2px solid #000000;">
          <tr>
            <td style="background:#000000;padding:28px 32px;">
              <div style="color:#ffffff;font-size:28px;font-weight:900;text-transform:uppercase;letter-spacing:-0.02em;line-height:0.9;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                VOICE<br>DASHBOARD
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 16px 32px;">
              <p style="margin:0 0 6px 0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:#737373;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                ${label}
              </p>
              <p style="margin:0 0 20px 0;font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:-0.01em;color:#000000;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                ${title}
              </p>
              ${message ? `<p style="margin:0 0 32px 0;font-size:13px;color:#404040;line-height:1.7;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">${(message).replace(/\n/g, '<br>')}</p>` : ''}
              ${isCritical ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#000000;padding:12px 16px;">
                    <p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#ffffff;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                      Requiere tu atención inmediata
                    </p>
                  </td>
                </tr>
              </table>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <hr style="border:none;border-top:2px solid #000000;margin:0 0 24px 0;">
              <p style="margin:0;font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.15em;color:#a3a3a3;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                Aviso automático &middot; Voice Dashboard
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
          })
          emailed = true
        }
      } catch (e) {
        emailError = (e as Error).message
      }
    }

    return json({ ok: true, emailed, emailError })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
