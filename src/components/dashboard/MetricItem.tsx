'use client'

interface MetricItemProps {
  label: string
  current: string | number
  target?: string | number
  isInfo?: boolean
  compareValues?: boolean // Para AOV: comparar current vs target
}

export function MetricItem({ label, current, target, isInfo = false, compareValues = false }: MetricItemProps) {
  // Determinar color basado en comparación (solo para AOV)
  let currentColor = ''
  if (compareValues && target) {
    const currentNum = typeof current === 'string' ? parseFloat(current.replace(/[^0-9.-]+/g, '')) : current
    const targetNum = typeof target === 'string' ? parseFloat(target.replace(/[^0-9.-]+/g, '')) : target
    
    if (currentNum > targetNum) {
      currentColor = 'text-green-600'
    } else if (currentNum < targetNum) {
      currentColor = 'text-red-600'
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {isInfo ? (
        <p className="text-sm font-bold">{current}</p>
      ) : (
        <p className="text-sm">
          <span className={`font-bold ${currentColor}`}>{current}</span>
          {target && (
            <>
              {' / '}
              <span className="text-muted-foreground">{target}</span>
            </>
          )}
        </p>
      )}
    </div>
  )
}
