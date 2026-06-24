import { useEffect, useState } from 'react'
import { Card, PageHeader } from '@/components/ui/Card'
import { invokeFunction } from '@/lib/supabase'

// Precio de un producto de Stripe (importe en céntimos)
interface StripePrice {
  id: string
  unit_amount: number
  currency: string
  recurring_interval: string | null
  usage_type: 'metered' | 'licensed'
  nickname: string | null
}

// Producto de Stripe con sus precios asociados
interface StripeProduct {
  id: string
  name: string
  description: string | null
  prices: StripePrice[]
}

// Respuesta de la acción 'list' de la Edge Function
interface ListResponse {
  products: StripeProduct[]
}

export default function Plans() {
  // Estado del listado de productos
  const [products, setProducts] = useState<StripeProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  // Estado del formulario de creación.
  // Un producto puede tener cuota mensual, precio por minuto, o ambos.
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [perMinuteAmount, setPerMinuteAmount] = useState('')

  // Estado del envío del formulario
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  // Carga (o recarga) los productos desde Stripe
  async function fetchProducts() {
    setLoading(true)
    setListError(null)
    try {
      const data = await invokeFunction<ListResponse>('stripe-products', {
        action: 'list',
      })
      setProducts(data.products ?? [])
    } catch (err) {
      setListError(
        err instanceof Error ? err.message : 'No se pudieron cargar los productos.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  // Reinicia los campos del formulario
  function resetForm() {
    setName('')
    setDescription('')
    setMonthlyAmount('')
    setPerMinuteAmount('')
  }

  // Crea un nuevo producto en Stripe con cuota mensual y/o precio por minuto.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const monthly = Number(monthlyAmount) || 0
    const perMinute = Number(perMinuteAmount) || 0
    if (monthly <= 0 && perMinute <= 0) {
      setFormError('Indica al menos un precio: mensual o por minuto.')
      return
    }
    setSubmitting(true)
    setFormError(null)
    setFormSuccess(null)
    try {
      await invokeFunction('stripe-products', {
        action: 'create',
        name,
        description,
        monthlyAmount: monthly,
        perMinuteAmount: perMinute,
        currency: 'eur',
      })
      setFormSuccess('Producto creado correctamente.')
      resetForm()
      setShowForm(false)
      await fetchProducts()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No se pudo crear el producto.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Archiva un producto en Stripe tras confirmación del usuario.
  async function handleDelete(productId: string) {
    if (!window.confirm('¿Eliminar este producto? Se archivará en Stripe.')) {
      return
    }
    setFormError(null)
    setFormSuccess(null)
    try {
      await invokeFunction('stripe-products', {
        action: 'archive',
        productId,
      })
      setFormSuccess('Producto eliminado.')
      await fetchProducts()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No se pudo eliminar el producto.',
      )
    }
  }

  // Formatea el importe de un precio en la moneda correspondiente
  function formatPrice(price: StripePrice): string {
    const formatted = (price.unit_amount / 100).toLocaleString('es-ES', {
      style: 'currency',
      currency: price.currency.toUpperCase(),
    })
    // Metered = precio por minuto; licensed recurrente = cuota mensual.
    if (price.usage_type === 'metered') return `${formatted}/min`
    return price.recurring_interval === 'month' ? `${formatted}/mes` : formatted
  }

  return (
    <div>
      <PageHeader
        title="Planes y productos"
        subtitle="Gestiona los productos y precios de tu cuenta de Stripe"
      />

      {/* Cabecera con botón para mostrar/ocultar el formulario */}
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v)
            setFormError(null)
            setFormSuccess(null)
          }}
          className="bg-black px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-neutral-800"
        >
          {showForm ? 'Cancelar' : '+ Nuevo producto'}
        </button>
      </div>

      {/* Formulario de creación */}
      {showForm && (
        <Card className="mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-black">
                Nombre
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-0"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-black">
                Descripción
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-0"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-black">
                  Precio mensual (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={monthlyAmount}
                  onChange={(e) => setMonthlyAmount(e.target.value)}
                  placeholder="Opcional"
                  className="w-full border border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-0"
                />
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Cuota fija al mes
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-black">
                  Precio por minuto (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={perMinuteAmount}
                  onChange={(e) => setPerMinuteAmount(e.target.value)}
                  placeholder="Opcional"
                  className="w-full border border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-0"
                />
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Cobro por uso de minutos
                </p>
              </div>
            </div>

            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              Rellena uno de los dos o ambos. La lógica de Stripe se crea
              automáticamente.
            </p>

            {/* Mensajes de éxito/error del formulario */}
            {formError && (
              <p className="border border-black bg-black px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">
                {formError}
              </p>
            )}
            {formSuccess && (
              <p className="text-xs font-bold uppercase tracking-wide text-black">
                {formSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="bg-black px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? 'Creando…' : 'Crear producto'}
            </button>
          </form>
        </Card>
      )}

      {/* Listado de productos */}
      {loading ? (
        <Card>
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Cargando…
          </p>
        </Card>
      ) : listError ? (
        <Card>
          <p className="border border-black bg-black px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">
            {listError}
          </p>
        </Card>
      ) : products.length === 0 ? (
        <Card>
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            Aún no hay productos en Stripe.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {products.map((product) => (
            <Card key={product.id}>
              <div className="flex items-start justify-between">
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-black">
                  {product.name}
                </h2>
                <button
                  type="button"
                  onClick={() => handleDelete(product.id)}
                  className="text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60"
                >
                  Eliminar
                </button>
              </div>
              {product.description && (
                <p className="mt-2 text-sm text-neutral-500">
                  {product.description}
                </p>
              )}

              <div className="mt-6 space-y-px bg-black">
                {product.prices.map((price) => (
                  <div
                    key={price.id}
                    className="flex items-center justify-between bg-white border border-black px-4 py-3"
                  >
                    <span className="text-sm font-bold text-black">
                      {formatPrice(price)}
                      {price.nickname && (
                        <span className="ml-2 text-xs font-normal text-neutral-500">
                          {price.nickname}
                        </span>
                      )}
                    </span>
                    {price.usage_type === 'metered' ? (
                      <span className="border border-black bg-black px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
                        Por minuto
                      </span>
                    ) : (
                      <span className="border border-black bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-black">
                        Mensual
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
