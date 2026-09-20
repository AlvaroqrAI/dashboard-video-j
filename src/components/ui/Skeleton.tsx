export function Skeleton({ width = '100%', height = 14, radius = 6, style }: { width?: number | string; height?: number | string; radius?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width, height, borderRadius: radius, ...style }} />
}

export function SkeletonStatRow({ cols = 4 }: { cols?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, overflow: 'hidden' }}>
      {Array.from({ length: cols }, (_, i) => (
        <div key={i} style={{ padding: '18px 22px', borderRight: i < cols - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          <Skeleton width={90} height={11} style={{ marginBottom: 12 }} />
          <Skeleton width={50} height={23} style={{ marginBottom: 8 }} />
          <Skeleton width={110} height={10} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard({ height = 180 }: { height?: number }) {
  return (
    <div style={{ background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20 }}>
      <Skeleton width={140} height={13} style={{ marginBottom: 16 }} />
      <Skeleton height={height} radius={10} />
    </div>
  )
}

export function SkeletonTableRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ background: '#181922', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '4px 16px' }}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: 'flex', gap: 24, padding: '14px 0', borderBottom: r < rows - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} width={c === 0 ? '22%' : '14%'} height={12} />
          ))}
        </div>
      ))}
    </div>
  )
}
