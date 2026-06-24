import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, PageHeader } from '@/components/ui/Card'
import { supabase, invokeFunction } from '@/lib/supabase'

interface GmailStatus {
  sender: string | null
  connected_at: string | null
}

export default function AdminSettings() {
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<GmailStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [testing, setTesting] = useState(false)
  const [testEmail, setTestEmail] = useState('')

  async function fetchStatus() {
    const { data } = await supabase
      .from('gmail_integration')
      .select('sender, connected_at')
      .eq('id', 'default')
      .maybeSingle()
    setStatus((data as GmailStatus) ?? null)
    setLoading(false)
  }

  useEffect(() => {
    void fetchStatus()
  }, [])

  // Mensaje de vuelta del flujo OAuth.
  useEffect(() => {
    const g = params.get('gmail')
    if (g === 'connected') {
      setMsg({ text: 'Google conectado correctamente.', ok: true })
      void fetchStatus()
      params.delete('gmail')
      setParams(params, { replace: true })
    } else if (g === 'error') {
      setMsg({ text: 'No se pudo conectar con Google. Inténtalo de nuevo.', ok: false })
      params.delete('gmail')
      setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Inicia el flujo "Conectar con Google".
  async function connectGoogle() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      setMsg({ text: 'Sesión no válida. Vuelve a iniciar sesión.', ok: false })
      return
    }
    const clientId = import.meta.env.VITE_GMAIL_CLIENT_ID as string
    const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth-callback`
    const url =
      'https://accounts.google.com/o/oauth2/v2/auth?' +
      new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/userinfo.email',
          'openid',
        ].join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state: token,
      }).toString()
    window.location.href = url
  }

  // Envía el email de prueba. Si se indica un correo, va a ese destino;
  // si no, al correo del propio admin.
  async function sendTest() {
    setTesting(true)
    setMsg(null)
    try {
      const to = testEmail.trim()
      const res = await invokeFunction<{ to: string }>(
        'gmail-test',
        to ? { to } : {},
      )
      setMsg({ text: `Email de prueba enviado a ${res.to}.`, ok: true })
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'No se pudo enviar.', ok: false })
    } finally {
      setTesting(false)
    }
  }

  const connected = !!status?.sender

  return (
    <div>
      <PageHeader title="Ajustes" subtitle="Integraciones del sistema" />

      {msg && (
        <p
          className={`mb-6 text-xs font-bold uppercase tracking-wide ${
            msg.ok ? 'text-black' : 'border border-black bg-black px-3 py-2 text-white'
          }`}
        >
          {msg.text}
        </p>
      )}

      <Card className="max-w-xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-black">
          Notificaciones por email (Google)
        </h2>
        <p className="mt-3 text-xs uppercase tracking-[0.15em] leading-relaxed text-neutral-500">
          Conecta una cuenta de Google (Gmail o Workspace) para enviar avisos por
          email a tus clientes. Las notificaciones se enviarán desde esa cuenta.
        </p>

        {loading ? (
          <p className="mt-6 text-xs uppercase tracking-[0.2em] text-neutral-500">
            Cargando…
          </p>
        ) : connected ? (
          <div className="mt-6">
            <div className="mb-4 inline-block border border-black bg-black px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-white">
              Conectado: {status?.sender || 'cuenta de Google'}
            </div>

            {/* Email de prueba: por defecto al admin; opcionalmente a otro correo. */}
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500">
              Enviar prueba a (opcional)
            </label>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="tu@correo.com — vacío = tu propio email"
                className="w-full border border-black bg-white px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-0 sm:max-w-sm"
              />
              <button
                type="button"
                onClick={() => void sendTest()}
                disabled={testing}
                className="bg-black px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-neutral-800 disabled:opacity-40"
              >
                {testing ? 'Enviando…' : 'Enviar email de prueba'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => void connectGoogle()}
              className="border border-black bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-black hover:bg-black hover:text-white"
            >
              Reconectar otra cuenta
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void connectGoogle()}
            className="mt-6 bg-black px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-white hover:bg-neutral-800"
          >
            Conectar con Google
          </button>
        )}
      </Card>
    </div>
  )
}
