import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/Card'
import { invokeFunction } from '@/lib/supabase'

interface StripePrice {
  id: string
  unit_amount: number
  currency: string
  recurring_interval: string | null
  usage_type: 'metered' | 'licensed'
  nickname: string | null
}

interface StripeProduct {
  id: string
  name: string
  description: string | null
  prices: StripePrice[]
}

interface ListResponse {
  products: StripeProduct[]
}

const input: React.CSSProperties = {
  width: '100%', background: '#0D0E14', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#F1F0F5',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}

const label: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: '#8B8A99', textTransform: 'uppercase',
  letterSpacing: '0.1em', marginBottom: 6, display: 'block',
}

const btnPrimary: React.CSSProperties = {
  background: '#7C6FE0', color: '#fff', border: 'none', borderRadius: 9,
  padding: '9px 20px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit',
}

export default function Plans() {
  const [products, setProducts] = useState<StripeProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [perMinuteAmount, setPerMinuteAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  async function fetchProducts() {
    setLoading(true); setListError(null)
    try {
      const data = await invokeFunction<ListResponse>('stripe-products', { action: 'list' })
      setProducts(data.products ?? [])
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'No se pudieron cargar los productos.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void fetchProducts() }, [])

  function resetForm() { setName(''); setDescription(''); setMonthlyAmount(''); setPerMinuteAmount('') }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const monthly = Number(monthlyAmount) || 0
    const perMinute = Number(perMinuteAmount) || 0
    if (monthly <= 0 && perMinute <= 0) { setFormError('Indica al menos un precio: mensual o por minuto.'); return }
    setSubmitting(true); setFormError(null); setFormSuccess(null)
    try {
      await invokeFunction('stripe-products', { action: 'create', name, description, monthlyAmount: monthly, perMinuteAmount: perMinute, currency: 'eur' })
      setFormSuccess('Producto creado correctamente.')
      resetForm(); setShowForm(false)
      await fetchProducts()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear el producto.')
    } finally { setSubmitting(false) }
  }

  async function handleDelete(productId: string) {
    if (!window.confirm('¿Eliminar este producto? Se archivará en Stripe.')) return
    setFormError(null); setFormSuccess(null)
    try {
      await invokeFunction('stripe-products', { action: 'archive', productId })
      setFormSuccess('Producto eliminado.')
      await fetchProducts()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo eliminar el producto.')
    }
  }

  function formatPrice(price: StripePrice): string {
    const formatted = (price.unit_amount / 100).toLocaleString('es-ES', { style: 'currency', currency: price.currency.toUpperCase() })
    if (price.usage_type === 'metered') return `${formatted}/min`
    return price.recurring_interval === 'month' ? `${formatted}/mes` : formatted
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Planes y productos"
        subtitle="Gestiona los productos y precios de tu cuenta de Stripe"
        action={
          <button type="button" onClick={() => { setShowForm(v => !v); setFormError(null); setFormSuccess(null) }} style={btnPrimary}>
            {showForm ? 'Cancelar' : '+ Nuevo producto'}
          </button>
        }
      />

      {formSuccess && (
        <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 10, padding: '10px 16px', fontSize: 12, color: '#34D399' }}>{formSuccess}</div>
      )}

      {showForm && (
        <div style={{ background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#F1F0F5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>Nuevo producto</div>
          <form onSubmit={e => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <span style={label}>Nombre</span>
              <input style={input} required value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <span style={label}>Descripción</span>
              <textarea style={{ ...input, resize: 'vertical' }} rows={3} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <span style={label}>Precio mensual (€)</span>
                <input style={input} type="number" step="0.01" min="0" value={monthlyAmount} onChange={e => setMonthlyAmount(e.target.value)} placeholder="Opcional" />
              </div>
              <div>
                <span style={label}>Precio por minuto (€)</span>
                <input style={input} type="number" step="0.01" min="0" value={perMinuteAmount} onChange={e => setPerMinuteAmount(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            {formError && (
              <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#F87171' }}>{formError}</div>
            )}
            <div>
              <button type="submit" disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.5 : 1 }}>
                {submitting ? 'Creando…' : 'Crear producto'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32, fontSize: 12, color: '#4A4960' }}>Cargando…</div>
      ) : listError ? (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '14px 18px', fontSize: 13, color: '#F87171' }}>{listError}</div>
      ) : products.length === 0 ? (
        <div style={{ background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 32, fontSize: 12, color: '#4A4960' }}>Aún no hay productos en Stripe.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {products.map(product => (
            <div key={product.id} style={{ background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F0F5' }}>{product.name}</div>
                <button type="button" onClick={() => void handleDelete(product.id)} style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: '#F87171', cursor: 'pointer', fontFamily: 'inherit' }}>Eliminar</button>
              </div>
              {product.description && (
                <div style={{ fontSize: 12, color: '#8B8A99', marginBottom: 16 }}>{product.description}</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {product.prices.map(price => (
                  <div key={price.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 14px' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#34D399' }}>
                      {formatPrice(price)}
                      {price.nickname && <span style={{ fontSize: 11, fontWeight: 400, color: '#8B8A99', marginLeft: 8 }}>{price.nickname}</span>}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 10px', borderRadius: 6, background: price.usage_type === 'metered' ? 'rgba(124,111,224,0.12)' : 'rgba(52,211,153,0.1)', color: price.usage_type === 'metered' ? '#9B8FEF' : '#34D399', border: `1px solid ${price.usage_type === 'metered' ? 'rgba(155,143,239,0.3)' : 'rgba(52,211,153,0.3)'}` }}>
                      {price.usage_type === 'metered' ? 'Por minuto' : 'Mensual'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
