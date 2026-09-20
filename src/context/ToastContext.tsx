import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastItem { id: number; message: string; tone: 'success' | 'error' }

interface ToastContextValue {
  showToast: (message: string, tone?: 'success' | 'error') => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE_COLOR: Record<ToastItem['tone'], string> = { success: '#34D399', error: '#F87171' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    const id = nextId.current++
    setToasts(t => [...t, { id, message, tone }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 100 }}>
        {toasts.map(t => (
          <div key={t.id} className="toast-enter" style={{
            display: 'flex', alignItems: 'center', gap: 9, background: '#181922', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '11px 16px', fontSize: 12.5, fontWeight: 500, color: '#F1F0F5',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)', maxWidth: 320,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: TONE_COLOR[t.tone], flexShrink: 0 }} />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
