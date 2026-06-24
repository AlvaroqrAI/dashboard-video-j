import { loadStripe, type Stripe } from '@stripe/stripe-js'

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string

let stripePromise: Promise<Stripe | null> | null = null

/** Carga Stripe.js de forma perezosa (una sola vez). */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey ?? '')
  }
  return stripePromise
}
