import { Card, PageHeader } from '@/components/ui/Card'
import { useAuth } from '@/context/AuthContext'

export default function Settings() {
  const { user, profile } = useAuth()

  return (
    <div>
      <PageHeader title="Ajustes" subtitle="Información de tu cuenta" />

      <Card className="max-w-xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-black">
          Cuenta
        </h2>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              Nombre
            </p>
            <p className="mt-1 text-sm font-bold text-black">
              {profile?.full_name || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              Email
            </p>
            <p className="mt-1 text-sm font-bold text-black">
              {user?.email || '—'}
            </p>
          </div>
        </div>
      </Card>

      <Card className="mt-6 max-w-xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-black">
          Integración de voz
        </h2>
        <p className="mt-3 text-xs uppercase tracking-[0.15em] leading-relaxed text-neutral-500">
          La integración con la plataforma de voz la gestiona tu proveedor. Si
          necesitas cambios en tus agentes, contacta con tu administrador.
        </p>
      </Card>
    </div>
  )
}
