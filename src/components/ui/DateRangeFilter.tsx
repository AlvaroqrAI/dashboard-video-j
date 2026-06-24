import type { RangePreset, RangeState } from '@/lib/metrics'
import { isoDaysAgo, isoToday } from '@/lib/metrics'

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
  { key: 'custom', label: 'Personalizado' },
]

// Filtro de fecha reutilizable para los gráficos. Estilo blanco/negro del proyecto.
export default function DateRangeFilter({
  value,
  onChange,
}: {
  value: RangeState
  onChange: (v: RangeState) => void
}) {
  function selectPreset(key: RangePreset) {
    if (key === 'custom') {
      onChange({
        preset: 'custom',
        from: value.from ?? isoDaysAgo(7),
        to: value.to ?? isoToday(),
      })
    } else {
      onChange({ preset: key })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex flex-wrap gap-px border border-black bg-black"
        role="group"
        aria-label="Filtro de fecha"
      >
        {PRESETS.map((p) => {
          const active = value.preset === p.key
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => selectPreset(p.key)}
              aria-pressed={active}
              className={`px-4 py-2.5 text-xs font-bold uppercase tracking-[0.15em] transition-colors ${
                active
                  ? 'bg-black text-white'
                  : 'bg-white text-neutral-500 hover:text-black'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {value.preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-neutral-500">
            Desde
            <input
              type="date"
              aria-label="Fecha desde"
              value={value.from ?? ''}
              max={value.to}
              onChange={(e) =>
                onChange({ ...value, preset: 'custom', from: e.target.value })
              }
              className="border border-black bg-white px-3 py-2 text-xs text-black focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-neutral-500">
            Hasta
            <input
              type="date"
              aria-label="Fecha hasta"
              value={value.to ?? ''}
              min={value.from}
              onChange={(e) =>
                onChange({ ...value, preset: 'custom', to: e.target.value })
              }
              className="border border-black bg-white px-3 py-2 text-xs text-black focus:outline-none"
            />
          </label>
        </div>
      )}
    </div>
  )
}
