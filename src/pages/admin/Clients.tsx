import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, PageHeader } from '@/components/ui/Card'
import { supabase, invokeFunction } from '@/lib/supabase'

// Estructura de cada fila de cliente devuelta por Supabase.
interface ClientRow {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
  payment_method_added: boolean | null
  created_at: string
}

export default function Clients() {
  // Estado de la lista de clientes y su carga.
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)

  // Estado del formulario "Nuevo cliente".
  const [showForm, setShowForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [retellApiKey, setRetellApiKey] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Mensaje inline de éxito/error del formulario.
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(
    null,
  )

  // Consulta reutilizable: obtiene los perfiles con role = 'client'.
  async function fetchClients() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, email, full_name, role, payment_method_added, created_at',
      )
      .eq('role', 'client')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[clients] Error al cargar clientes:', error.message)
      setClients([])
    } else {
      setClients((data ?? []) as ClientRow[])
    }
    setLoading(false)
  }

  // Carga inicial al montar el componente.
  useEffect(() => {
    void fetchClients()
  }, [])

  // Crea un cliente llamando a la Edge Function 'create-client'.
  async function handleCreate() {
    setSubmitting(true)
    setFeedback(null)
    try {
      await invokeFunction('create-client', {
        email,
        password,
        full_name: fullName,
        retellApiKey: retellApiKey || undefined,
      })
      // Éxito: limpiar el formulario, cerrarlo y refrescar la lista.
      setFullName('')
      setEmail('')
      setPassword('')
      setRetellApiKey('')
      setShowForm(false)
      setFeedback({ text: 'Cliente creado correctamente.', ok: true })
      await fetchClients()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setFeedback({ text: `No se pudo crear el cliente: ${message}`, ok: false })
    } finally {
      setSubmitting(false)
    }
  }

  // Elimina un cliente llamando a la Edge Function 'delete-client'.
  async function handleDelete(userId: string) {
    if (!window.confirm('¿Eliminar este cliente? Esta acción no se puede deshacer.')) {
      return
    }
    setFeedback(null)
    try {
      await invokeFunction('delete-client', { userId })
      setFeedback({ text: 'Cliente eliminado correctamente.', ok: true })
      await fetchClients()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setFeedback({
        text: `No se pudo eliminar el cliente: ${message}`,
        ok: false,
      })
    }
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Gestiona las cuentas de tus clientes"
        action={
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="bg-black px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-neutral-800"
          >
            + Nuevo cliente
          </button>
        }
      />

      {/* Mensaje de éxito tras crear (visible aunque el formulario esté cerrado). */}
      {feedback && feedback.ok && (
        <p className="mb-4 text-xs font-bold uppercase tracking-wide text-black">
          {feedback.text}
        </p>
      )}

      {showForm && (
        <Card className="mb-4">
          <h2 className="mb-6 text-xs font-bold uppercase tracking-[0.15em] text-black">
            Agregar nuevo cliente
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nombre / empresa"
              className="border border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-0"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="border border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-0"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="border border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-0"
            />
            <div>
              <input
                type="password"
                value={retellApiKey}
                onChange={(e) => setRetellApiKey(e.target.value)}
                placeholder="API Key de Retell (opcional)"
                className="w-full border border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-0"
              />
              <p className="mt-1.5 text-xs uppercase tracking-[0.2em] text-neutral-500">
                Si lo dejas vacío, se usará la API Key por defecto.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={submitting}
              className="bg-black px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? 'Creando…' : 'Crear cliente'}
            </button>
          </div>

          {/* Mensaje de error inline dentro del formulario. */}
          {feedback && !feedback.ok && (
            <p className="mt-3 border border-black bg-black px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">
              {feedback.text}
            </p>
          )}
        </Card>
      )}

      <Card className="p-0">
        {loading ? (
          // Estado de carga.
          <p className="px-5 py-6 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Cargando…
          </p>
        ) : clients.length === 0 ? (
          // Estado vacío.
          <p className="px-5 py-6 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Aún no hay clientes.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Cliente
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Estado de pago
                </th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Alta
                </th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-neutral-200 hover:bg-neutral-50"
                >
                  <td className="px-5 py-4">
                    <div className="font-bold text-black">
                      {c.full_name}
                    </div>
                    <div className="text-xs text-neutral-500">{c.email}</div>
                  </td>
                  <td className="px-5 py-4">
                    {c.payment_method_added ? (
                      <span className="border border-black bg-black px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
                        Método añadido
                      </span>
                    ) : (
                      <span className="border border-black bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-black">
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-neutral-600">
                    {new Date(c.created_at).toLocaleDateString('es-ES')}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      to={`/admin/clients/${c.id}`}
                      className="text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60"
                    >
                      Gestionar
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDelete(c.id)}
                      className="ml-4 text-xs font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 hover:opacity-60"
                    >
                      Eliminar
                    </button>
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
