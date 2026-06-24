import { useEffect, useState } from 'react'
import { Card, PageHeader } from '@/components/ui/Card'
import { invokeFunction } from '@/lib/supabase'

interface Invoice {
  id: string
  date: string
  amount: number
  currency: string
  status: string | null
  url: string | null
}
interface BillingInfo {
  plan: string | null
  paymentMethod: { brand: string; last4: string } | null
  invoices: Invoice[]
}

export default function Billing() {
  const [info, setInfo] = useState<BillingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    invokeFunction<BillingInfo>('client-billing', { action: 'info' })
      .then((d) => setInfo(d))
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'No se pudo cargar la facturación.'),
      )
      .finally(() => setLoading(false))
  }, [])

  // Abre el Portal de Cliente de Stripe (gestiona suscripción, tarjeta y facturas).
  async function openPortal(flow?: 'payment_method_update') {
    setPortalLoading(true)
    setError(null)
    try {
      const { url } = await invokeFunction<{ url: string }>('client-billing', {
        action: 'portal',
        flow,
      })
      if (url) window.location.href = url
      else throw new Error('No se recibió la URL del portal.')
    } catch (e) {
      setPortalLoading(false)
      setError(e instanceof Error ? e.message : 'No se pudo abrir el portal.')
    }
  }

  const fmt = (amount: number, currency: string) =>
    (amount / 100).toLocaleString('es-ES', {
      style: 'currency',
      currency: currency.toUpperCase(),
    })

  return (
    <div>
      <PageHeader
        title="Facturación"
        subtitle="Gestiona tu suscripción y método de pago"
      />

      {error && (
        <p className="mb-6 border border-black bg-black px-3 py-2 text-xs font-medium uppercase tracking-wide text-white">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-black">
            Plan actual
          </h2>
          <p className="mt-3 text-2xl font-black uppercase tracking-tight text-black">
            {loading ? '…' : info?.plan || 'Sin plan asignado'}
          </p>
          <button
            type="button"
            onClick={() => openPortal()}
            disabled={portalLoading}
            className="mt-6 border border-black bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-black hover:bg-black hover:text-white disabled:opacity-40"
          >
            {portalLoading ? 'Abriendo…' : 'Gestionar suscripción (Stripe)'}
          </button>
        </Card>

        <Card>
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-black">
            Método de pago
          </h2>
          <p className="mt-3 text-sm text-neutral-700">
            {loading
              ? '…'
              : info?.paymentMethod
                ? `${info.paymentMethod.brand.toUpperCase()} •••• ${info.paymentMethod.last4}`
                : 'Sin método de pago'}
          </p>
          <button
            type="button"
            onClick={() => openPortal('payment_method_update')}
            disabled={portalLoading}
            className="mt-6 border border-black bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-black hover:bg-black hover:text-white disabled:opacity-40"
          >
            {portalLoading ? 'Abriendo…' : 'Actualizar método de pago'}
          </button>
        </Card>
      </div>

      <Card className="mt-6 p-0">
        <h2 className="border-b-2 border-black px-5 py-4 text-xs font-bold uppercase tracking-[0.15em] text-black">
          Historial de facturas
        </h2>
        {loading ? (
          <p className="px-5 py-6 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Cargando…
          </p>
        ) : !info || info.invoices.length === 0 ? (
          <p className="px-5 py-6 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Aún no tienes facturas.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Fecha
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Importe
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Estado
                </th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {info.invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-neutral-200 last:border-0 hover:bg-neutral-50"
                >
                  <td className="px-5 py-4 text-neutral-700">
                    {new Date(inv.date).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-5 py-4 text-neutral-700">
                    {fmt(inv.amount, inv.currency)}
                  </td>
                  <td className="px-5 py-4">
                    <span className="border border-black bg-black px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
                      {inv.status === 'paid' ? 'Pagada' : inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {inv.url ? (
                      <a
                        href={inv.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60"
                      >
                        Ver
                      </a>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
