// Webhook de Stripe: marca el método de pago como añadido y sincroniza suscripciones.
// Configurar en Stripe apuntando a esta función y guardar STRIPE_WEBHOOK_SECRET.
import Stripe from 'npm:stripe@17'
import { adminClient } from '../_shared/auth.ts'
import { sendEmail } from '../_shared/gmail.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-01-27.acacia',
})
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Sin firma', { status: 400 })

  const payload = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
    )
  } catch (err) {
    return new Response(`Firma inválida: ${(err as Error).message}`, {
      status: 400,
    })
  }

  const admin = adminClient()

  switch (event.type) {
    // El cliente completó el Checkout (modo setup o subscription).
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const customerId = session.customer as string

      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()
      if (!profile) break

      // En modo setup, fijar la tarjeta recogida como método por defecto.
      if (session.mode === 'setup' && session.setup_intent) {
        const si = await stripe.setupIntents.retrieve(
          session.setup_intent as string,
        )
        if (si.payment_method) {
          await stripe.customers.update(customerId, {
            invoice_settings: {
              default_payment_method: si.payment_method as string,
            },
          })
        }
      }

      // El cliente ya tiene método de pago: desbloquear el sistema.
      await admin
        .from('profiles')
        .update({ payment_method_added: true })
        .eq('id', profile.id)
      break
    }

    // Pago fallido → alerta automática (in-app + email best-effort).
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      const { data: profile } = await admin
        .from('profiles')
        .select('id, email, full_name')
        .eq('stripe_customer_id', customerId)
        .single()
      if (profile) {
        await admin.from('alerts').insert({
          user_id: profile.id,
          type: 'payment',
          title: 'Pago fallido',
          message:
            'No hemos podido cobrar tu última factura. Actualiza tu método de pago en Facturación.',
        })
        if (profile.email) {
          try {
            await sendEmail({
              to: profile.email,
              subject: 'Pago fallido en tu cuenta',
              html: `<p>Hola ${profile.full_name ?? ''},</p>
                <p>No hemos podido cobrar tu última factura. Por favor, actualiza tu método de pago en el apartado de Facturación de tu panel.</p>`,
            })
          } catch (_e) {
            // Email best-effort.
          }
        }
      }
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string

      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (profile) {
        await admin.from('subscriptions').upsert({
          id: sub.id,
          user_id: profile.id,
          status: sub.status,
          price_id: sub.items.data[0]?.price.id ?? null,
          current_period_end: new Date(
            sub.current_period_end * 1000,
          ).toISOString(),
        })
      }
      break
    }
  }

  return new Response('ok', { status: 200 })
})
