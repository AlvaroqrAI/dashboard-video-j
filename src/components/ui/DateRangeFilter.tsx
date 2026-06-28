import type { RangePreset, RangeState } from '@/lib/metrics'
import { isoDaysAgo, isoToday } from '@/lib/metrics'

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
  { key: 'custom', label: 'Personalizado' },
]

export default function DateRangeFilter({
  value,
  onChange,
}: {
  value: RangeState
  onChange: (v: RangeState) => void
}) {
  function selectPreset(key: RangePreset) {
    if (key === 'custom') {
      onChange({ preset: 'custom', from: value.from ?? isoDaysAgo(7), to: value.to ?? isoToday() })
    } else {
      onChange({ preset: key })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 4 }} role="group" aria-label="Filtro de fecha">
        {PRESETS.map((p) => {
          const active = value.preset === p.key
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => selectPreset(p.key)}
              aria-pressed={active}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                background: active ? '#7C6FE0' : 'transparent',
                borderColor: active ? '#7C6FE0' : 'rgba(255,255,255,0.1)',
                color: active ? '#fff' : '#8B8A99',
              }}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {value.preset === 'custom' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          {[
            { label: 'Desde', field: 'from' as const, max: value.to },
            { label: 'Hasta', field: 'to' as const, min: value.from },
          ].map(({ label, field, ...rest }) => (
            <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#8B8A99', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {label}
              <input
                type="date"
                value={value[field] ?? ''}
                {...rest}
                onChange={(e) => onChange({ ...value, preset: 'custom', [field]: e.target.value })}
                style={{ background: '#1E1F2B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#F1F0F5', fontFamily: 'inherit', outline: 'none', colorScheme: 'dark' }}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
