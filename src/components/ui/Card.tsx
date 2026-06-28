import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 20 }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <span style={{ width: 14, height: 2, background: '#7C6FE0', borderRadius: 1, display: 'inline-block' }} />
          MecanIA
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#F1F0F5', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ marginTop: 6, fontSize: 12, color: '#8B8A99' }}>{subtitle}</p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={className}
      style={{ background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20 }}
    >
      {children}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem' } as React.CSSProperties}>
      <p style={{ fontSize: 12, color: '#4A4960', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{message}</p>
    </Card>
  )
}
