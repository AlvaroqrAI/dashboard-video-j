import { useState, type ReactNode } from 'react'

export function Tooltip({ label, children, side = 'top' }: { label: string; children: ReactNode; side?: 'top' | 'bottom' }) {
  const [show, setShow] = useState(false)

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className="tooltip-bubble"
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            [side === 'top' ? 'bottom' : 'top']: 'calc(100% + 7px)',
            background: '#1E1F2B',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#F1F0F5',
            fontSize: 11,
            fontWeight: 500,
            padding: '5px 9px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 60,
            animation: 'tooltip-in 120ms ease both',
          } as React.CSSProperties}
        >
          {label}
        </span>
      )}
    </span>
  )
}
