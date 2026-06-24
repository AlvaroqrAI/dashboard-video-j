// Envía un email de prueba a la cuenta del admin para verificar la conexión Gmail.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser } from '../_shared/auth.ts'
import { sendEmail } from '../_shared/gmail.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const user = await getUser(req)
    if (!user) return json({ error: 'No autorizado' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data: prof } = await admin
      .from('profiles')
      .select('role, email, full_name')
      .eq('id', user.id)
      .single()
    if (prof?.role !== 'admin') return json({ error: 'Solo administradores' }, 403)
    if (!prof.email) return json({ error: 'Tu perfil no tiene email' }, 400)

    const body = await req.json().catch(() => ({}))
    const recipient: string = body.to ?? prof.email

    await sendEmail({
      to: recipient,
      subject: 'Email de prueba — Voice Dashboard',
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
                Prueba de conexión
              </p>
              <p style="margin:0 0 20px 0;font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:-0.01em;color:#000000;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                Todo listo
              </p>
              <p style="margin:0 0 32px 0;font-size:13px;color:#404040;line-height:1.7;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">
                La conexión con Gmail funciona correctamente. Ya puedes enviar notificaciones por email a tus clientes desde el panel.
              </p>
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
    return json({ ok: true, to: recipient })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
