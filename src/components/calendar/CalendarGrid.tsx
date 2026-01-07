'use client'

import { 
  CalendarEvent, 
  getMonthGrid, 
  getMonthName, 
  getWeekdayNames,
  isWeekendDay,
  isDateInMonth,
  formatCalendarDate,
  eventStartsOnDate,
  getEventDaysInWeek,
} from '@/lib/utils/calendar'
import { EventBar } from './EventBar'
import { cn } from '@/lib/utils'
import { differenceInDays, addDays, isSameMonth } from 'date-fns'

interface CalendarGridProps {
  year: number
  month: number
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}

export function CalendarGrid({ year, month, events, onEventClick }: CalendarGridProps) {
  const monthGrid = getMonthGrid(year, month)
  const weekdayNames = getWeekdayNames()
  const monthName = getMonthName(month)
  
  // Agrupar días en semanas (7 días por semana)
  const weeks: Date[][] = []
  for (let i = 0; i < monthGrid.length; i += 7) {
    weeks.push(monthGrid.slice(i, i + 7))
  }

  // Función para calcular cuántos días consecutivos mostrar desde una celda específica
  const getConsecutiveDaysFromCell = (event: CalendarEvent, startDate: Date, week: Date[]): number => {
    const eventStart = new Date(event.start_date)
    const eventEnd = new Date(event.end_date)
    
    eventStart.setHours(0, 0, 0, 0)
    eventEnd.setHours(0, 0, 0, 0)
    startDate.setHours(0, 0, 0, 0)
    
    // Encontrar desde qué posición en la semana comenzamos
    const dayIndexInWeek = week.findIndex(d => {
      const tempD = new Date(d)
      tempD.setHours(0, 0, 0, 0)
      return tempD.getTime() === startDate.getTime()
    })
    
    if (dayIndexInWeek === -1) return 0
    
    let consecutiveDays = 0
    const currentMonthDate = new Date(year, month, 1)
    
    for (let i = dayIndexInWeek; i < week.length; i++) {
      const currentDay = new Date(week[i])
      currentDay.setHours(0, 0, 0, 0)
      
      // Verificar si este día está dentro del evento
      if (currentDay >= eventStart && currentDay <= eventEnd) {
        // Solo contar si está en el mes actual
        if (isSameMonth(currentDay, currentMonthDate)) {
          consecutiveDays++
        }
      } else {
        break
      }
    }
    
    return consecutiveDays
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      {/* Header del mes */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900 capitalize">
          {monthName}
        </h3>
      </div>

      {/* Header de días de la semana */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekdayNames.map((day, index) => (
          <div
            key={index}
            className="text-[10px] font-medium text-gray-500 text-center pb-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid de días */}
      <div className="space-y-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-1 relative">
            {week.map((date, dayIndex) => {
              const isCurrentMonth = isDateInMonth(date, year, month)
              const isWeekend = isWeekendDay(date)
              
              // Encontrar eventos que comienzan exactamente en este día
              const eventsStartingToday = events.filter(event => 
                eventStartsOnDate(event, date) && isDateInMonth(date, year, month)
              )

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    'min-h-[60px] p-1 border border-gray-100 rounded text-xs relative',
                    isWeekend && 'bg-gray-50',
                    !isWeekend && 'bg-white',
                    !isCurrentMonth && 'opacity-30'
                  )}
                >
                  {/* Número del día */}
                  <div className={cn(
                    'text-[10px] font-medium mb-1',
                    isCurrentMonth ? 'text-gray-700' : 'text-gray-400'
                  )}>
                    {formatCalendarDate(date)}
                  </div>

                  {/* Eventos que comienzan en este día */}
                  <div className="space-y-0.5">
                    {eventsStartingToday.map((event) => {
                      const consecutiveDays = getConsecutiveDaysFromCell(event, date, week)
                      
                      return (
                        <EventBar
                          key={event.id}
                          event={event}
                          daysToShow={consecutiveDays}
                          onClick={onEventClick}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

