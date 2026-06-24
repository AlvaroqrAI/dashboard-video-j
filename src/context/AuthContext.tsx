import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { DEMO_MODE, type DemoProfile, type Role } from '@/lib/demo'

interface AuthContextValue {
  user: User | { id: string; email: string } | null
  profile: DemoProfile | null
  // loading es true hasta que tanto la sesión como el perfil están resueltos.
  loading: boolean
  signIn: (email: string, password: string) => Promise<DemoProfile>
  signOut: () => Promise<void>
  demoLogin: (role: Role) => void
  markPaymentAdded: () => void
  // Vuelve a leer el perfil del backend (p.ej. tras volver de Stripe Checkout).
  refreshProfile: () => Promise<DemoProfile | null>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const demoProfiles: Record<Role, DemoProfile> = {
  admin: {
    id: 'demo-admin',
    email: 'admin@umindsai.com',
    full_name: 'Administrador',
    role: 'admin',
    payment_method_added: true,
  },
  client: {
    id: 'demo-client',
    email: 'cliente@demo.es',
    full_name: 'Clínica Dental Sonríe',
    role: 'client',
    payment_method_added: false,
  },
}

async function fetchProfile(userId: string): Promise<DemoProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, payment_method_added')
    .eq('id', userId)
    .single()
  return data as DemoProfile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<DemoProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (DEMO_MODE) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) {
        const p = await fetchProfile(data.session.user.id)
        setProfile(p)
      }
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      if (s) {
        const p = await fetchProfile(s.user.id)
        setProfile(p)
      } else {
        setProfile(null)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  // Devuelve el perfil para que el componente de login pueda redirigir por rol.
  const signIn = async (email: string, password: string): Promise<DemoProfile> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const p = await fetchProfile(data.user.id)
    if (!p) throw new Error('No se encontró el perfil del usuario.')
    setProfile(p)
    return p
  }

  const signOut = async () => {
    if (DEMO_MODE) {
      setProfile(null)
      return
    }
    await supabase.auth.signOut()
    setProfile(null)
  }

  const demoLogin = (role: Role) => setProfile({ ...demoProfiles[role] })
  const markPaymentAdded = () =>
    setProfile((p) => (p ? { ...p, payment_method_added: true } : p))

  const refreshProfile = async (): Promise<DemoProfile | null> => {
    if (DEMO_MODE || !session) return profile
    const p = await fetchProfile(session.user.id)
    setProfile(p)
    return p
  }

  const user = DEMO_MODE
    ? profile
      ? { id: profile.id, email: profile.email }
      : null
    : (session?.user ?? null)

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signOut,
        demoLogin,
        markPaymentAdded,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
