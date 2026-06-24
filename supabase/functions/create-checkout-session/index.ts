// Crea una sesión de Stripe Checkout.
// - Por defecto (onboarding): modo 'setup' → recoge un método de pago SIN cobrar.
// - Si se pasa priceId: modo 'subscription' → suscribe al cliente a un plan.
import Stripe from 'npm:stripe@17'
import { corsHeaders, json } from '../_shared/cors.ts'
import { adminClient, getUser } from '../_shared/auth.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-01-27.acacia',
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const user = await getUser(req)
    if (!user) return json({ error: 'No autorizado' }, 401)

    const { priceId } = await req.json().catch(() => ({}))
    const admin = adminClient()

    // Reutiliza o crea el customer de Stripe asociado al usuario.
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await admin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

    const session = priceId
      ? // Suscripción a un plan concreto.
        await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${appUrl}/onboarding?checkout=success`,
          cancel_url: `${appUrl}/onboarding?checkout=cancel`,
        })
      : // Onboarding: solo registrar un método de pago (sin cobro).
        await stripe.checkout.sessions.create({
          customer: customerId,
          mode: 'setup',
          payment_method_types: ['card'],
          success_url: `${appUrl}/onboarding?checkout=success`,
          cancel_url: `${appUrl}/onboarding?checkout=cancel`,
        })

    return json({ url: session.url })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
