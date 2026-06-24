// Solo el admin puede llamar a esta función.
// Gestiona productos y precios en Stripe.
// Body: { action: 'list' | 'create', ... }
import Stripe from 'npm:stripe@17'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { getUser } from '../_shared/auth.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-01-27.acacia',
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const caller = await getUser(req)
    if (!caller) return json({ error: 'No autorizado' }, 401)

    // Verificar que el caller es admin consultando su perfil con service_role.
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

    const body = await req.json().catch(() => ({}))
    const { action } = body

    // Listar productos activos con sus precios.
    if (action === 'list') {
      const products = await stripe.products.list({ active: true, limit: 100 })

      const result = []
      for (const p of products.data) {
        const prices = await stripe.prices.list({ product: p.id, active: true })
        result.push({
          id: p.id,
          name: p.name,
          description: p.description,
          prices: prices.data.map((price) => ({
            id: price.id,
            unit_amount: price.unit_amount,
            currency: price.currency,
            recurring_interval: price.recurring?.interval ?? null,
            usage_type: price.recurring?.usage_type ?? 'licensed',
            nickname: price.nickname ?? null,
          })),
        })
      }

      return json({ products: result })
    }

    // Crear un producto con un precio mensual y/o un precio por minuto.
    // Body: { name, description?, monthlyAmount?, perMinuteAmount?, currency? }
    // Al menos uno de los dos importes debe ser > 0.
    if (action === 'create') {
      const { name, description, monthlyAmount, perMinuteAmount, currency = 'eur' } =
        body

      if (!name) return json({ error: 'El nombre es obligatorio' }, 400)

      const monthly = Number(monthlyAmount) || 0
      const perMinute = Number(perMinuteAmount) || 0
      if (monthly <= 0 && perMinute <= 0) {
        return json(
          { error: 'Indica al menos un precio: mensual o por minuto' },
          400,
        )
      }

      // Crear el producto base.
      const product = await stripe.products.create({
        name,
        description: description || undefined,
      })

      const priceIds: string[] = []
      let defaultPriceId: string | null = null

      // 1) Cuota mensual fija (opcional).
      if (monthly > 0) {
        const price = await stripe.prices.create({
          product: product.id,
          currency,
          unit_amount: Math.round(monthly * 100),
          recurring: { interval: 'month' },
        })
        priceIds.push(price.id)
        defaultPriceId = price.id
      }

      // 2) Precio por minuto (medido, opcional).
      if (perMinute > 0) {
        // Nombre de evento único para el medidor de minutos.
        const slug = name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '')
        const eventName = `${slug || 'plan'}_min_${crypto.randomUUID().slice(0, 8)}`

        const meter = await stripe.billing.meters.create({
          display_name: `${name} · minutos`,
          event_name: eventName,
          default_aggregation: { formula: 'sum' },
        })

        const price = await stripe.prices.create({
          product: product.id,
          currency,
          unit_amount: Math.round(perMinute * 100),
          recurring: { interval: 'month', usage_type: 'metered', meter: meter.id },
        })
        priceIds.push(price.id)
        if (!defaultPriceId) defaultPriceId = price.id
      }

      // Marcar como predeterminado el precio mensual (o el de minutos si no hay).
      if (defaultPriceId) {
        await stripe.products.update(product.id, { default_price: defaultPriceId })
      }

      return json({ ok: true, product_id: product.id, price_ids: priceIds })
    }

    // Archivar (eliminar) un producto: Stripe no permite borrar productos con
    // precios, así que se desactivan los precios y el producto.
    if (action === 'archive') {
      const { productId } = body
      if (!productId) return json({ error: 'productId requerido' }, 400)

      // Desactivar el producto lo retira del listado (que filtra por active:true).
      // No archivamos los precios para evitar el conflicto con el precio por defecto.
      await stripe.products.update(productId, { active: false })

      return json({ ok: true })
    }

    // Acción no reconocida.
    return json({ error: 'Acción no válida' }, 400)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
