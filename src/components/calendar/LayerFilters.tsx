'use client'

import { CalendarLayer, getAllLayers, getLayerColor, getLayerName } from '@/lib/utils/calendar'

interface LayerFiltersProps {
  visibleLayers: CalendarLayer[]
  onToggleLayer: (layer: CalendarLayer) => void
}

export function LayerFilters({ visibleLayers, onToggleLayer }: LayerFiltersProps) {
  const allLayers = getAllLayers()

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold text-gray-700">Capas:</span>
      <div className="flex flex-nowrap gap-1.5">
        {allLayers.map((layer) => {
          const isVisible = visibleLayers.includes(layer)
          const color = getLayerColor(layer)
          const name = getLayerName(layer)

          return (
            <button
              key={layer}
              onClick={() => onToggleLayer(layer)}
              className={`
                flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium text-xs
                transition-all duration-200 border-2
                ${isVisible 
                  ? 'shadow-sm scale-105' 
                  : 'opacity-40 hover:opacity-60 scale-95'
                }
              `}
              style={{
                backgroundColor: isVisible ? color : 'transparent',
                borderColor: color,
                color: isVisible ? '#fff' : color,
              }}
            >
              <div
                className={`w-2 h-2 rounded-full ${isVisible ? 'bg-white' : ''}`}
                style={{
                  backgroundColor: isVisible ? '#fff' : color,
                }}
              />
              <span className="font-semibold">{name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

