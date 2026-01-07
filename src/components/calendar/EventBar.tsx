'use client'

import { CalendarEvent, getLayerColor } from '@/lib/utils/calendar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface EventBarProps {
  event: CalendarEvent
  daysToShow: number
  onClick: (event: CalendarEvent) => void
}

export function EventBar({ event, daysToShow, onClick }: EventBarProps) {
  const layerColor = getLayerColor(event.layer)
  
  // Calcular el ancho para que ocupe todos los días + los gaps entre ellos
  // Formula: (100% del día * cantidad de días) + (gap de 0.25rem * (días - 1))
  const gapInRem = 0.25
  const gapInPercent = (gapInRem * 16 / window.innerWidth) * 100 * 7 // aproximación
  const widthCalc = `calc(${daysToShow * 100}% + ${(daysToShow - 1) * gapInRem}rem)`
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={() => onClick(event)}
            className="h-5 rounded-sm cursor-pointer hover:opacity-90 hover:shadow-md transition-all flex items-center px-2 text-xs text-white font-medium overflow-hidden mb-0.5 relative z-10"
            style={{
              backgroundColor: layerColor,
              width: widthCalc,
              minWidth: `${daysToShow * 100}%`,
            }}
          >
            <span className="truncate font-semibold">{event.title}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium">{event.title}</p>
          {event.description && (
            <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

