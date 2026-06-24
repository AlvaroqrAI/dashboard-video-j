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
    <div className="mb-10 flex items-end justify-between border-b-2 border-black pb-6">
      <div>
        <h1 className="text-5xl font-black uppercase leading-[0.95] tracking-tighter text-black sm:text-6xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
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
    <div className={`border border-neutral-300 bg-white p-6 ${className}`}>
      {children}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <Card className="flex items-center justify-center py-20 text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
      {message}
    </Card>
  )
}
