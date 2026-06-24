// Facturación del cliente autenticado.
// Acciones:
//   { action: 'info' }   -> { plan, paymentMethod, invoices }
//   { action: 'portal', flow? } -> { url } (Stripe Customer Portal)
import Stripe from 'npm:stripe@17'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser } from '../_shared/auth.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-01-27.acacia',
})

function admin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

// Asegura (o crea) el customer de Stripe del usuario.
async function ensureCustomer(userId: string, email: string | undefined) {
  const db = admin()
  const { data: profile } = await db
    .from('profiles')
    .select('stripe_customer_id, assigned_plan_name')
    .eq('id', userId)
    .single()

  let customerId = profile?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      metadata: { supabase_user_id: userId },
    })
    customerId = customer.id
    await db.from('profiles').update({ stripe_customer_id: customerId }).eq('id', userId)
  }
  return { customerId, plan: profile?.assigned_plan_name ?? null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const user = await getUser(req)
    if (!user) return json({ error: 'No autorizado' }, 401)

    const { action, flow } = await req.json().catch(() => ({}))
    const { customerId, plan } = await ensureCustomer(user.id, user.email)

    if (action === 'info') {
      // Método de pago por defecto.
      const customer = (await stripe.customers.retrieve(customerId, {
        expand: ['invoice_settings.default_payment_method'],
      })) as Stripe.Customer
      const pm = customer.invoice_settings
        ?.default_payment_method as Stripe.PaymentMethod | null
      const paymentMethod = pm?.card
        ? { brand: pm.card.brand, last4: pm.card.last4 }
        : null

      // Facturas reales del cliente.
      const list = await stripe.invoices.list({ customer: customerId, limit: 12 })
      const invoices = list.data.map((i) => ({
        id: i.id,
        date: new Date(i.created * 1000).toISOString(),
        amount: i.total,
        currency: i.currency,
        status: i.status,
        url: i.hosted_invoice_url ?? i.invoice_pdf ?? null,
      }))

      return json({ plan, paymentMethod, invoices })
    }

    if (action === 'portal') {
      const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

      // Reutiliza o crea una configuración del portal.
      const cfgs = await stripe.billingPortal.configurations.list({ limit: 1 })
      const configuration =
        cfgs.data[0]?.id ??
        (
          await stripe.billingPortal.configurations.create({
            business_profile: { headline: 'Gestiona tu facturación' },
            features: {
              invoice_history: { enabled: true },
              payment_method_update: { enabled: true },
              customer_update: {
                enabled: true,
                allowed_updates: ['email', 'address'],
              },
            },
          })
        ).id

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/billing`,
        configuration,
        ...(flow === 'payment_method_update'
          ? { flow_data: { type: 'payment_method_update' } }
          : {}),
      })

      return json({ url: session.url })
    }

    return json({ error: 'Acción no válida' }, 400)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
