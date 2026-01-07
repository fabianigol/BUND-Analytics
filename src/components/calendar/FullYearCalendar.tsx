'use client'

import { useState, useEffect } from 'react'
import { CalendarEvent, CalendarLayer, filterEventsByLayers } from '@/lib/utils/calendar'
import { CalendarGrid } from './CalendarGrid'
import { LayerFilters } from './LayerFilters'
import { EventDetailsPanel } from './EventDetailsPanel'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface FullYearCalendarProps {
  onCreateEvent: () => void
  onEditEvent: (event: CalendarEvent) => void
  refreshTrigger: number
}

export function FullYearCalendar({ onCreateEvent, onEditEvent, refreshTrigger }: FullYearCalendarProps) {
  const currentYear = new Date().getFullYear()
  
  const [year, setYear] = useState(currentYear)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [visibleLayers, setVisibleLayers] = useState<CalendarLayer[]>([
    'marketing',
    'operations',
    'pr',
    'retail',
    'product',
    'otros',
    'tour',
    'personal',
  ])
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  // Obtener el usuario actual
  useEffect(() => {
    async function getCurrentUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
      }
    }
    getCurrentUser()
  }, [])

  // Cargar eventos del año
  useEffect(() => {
    async function loadEvents() {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/calendar/events?year=${year}`)
        if (response.ok) {
          const data = await response.json()
          setEvents(data)
        } else {
          console.error('Error loading events:', await response.text())
        }
      } catch (error) {
        console.error('Error loading events:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadEvents()
  }, [year, refreshTrigger])

  const handleToggleLayer = (layer: CalendarLayer) => {
    setVisibleLayers((prev) =>
      prev.includes(layer)
        ? prev.filter((l) => l !== layer)
        : [...prev, layer]
    )
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setIsDetailsPanelOpen(true)
  }

  const handleEditEvent = (event: CalendarEvent) => {
    setIsDetailsPanelOpen(false)
    onEditEvent(event)
  }

  const handleDeleteEvent = () => {
    // Recargar eventos después de eliminar
    setIsDetailsPanelOpen(false)
    window.location.reload()
  }

  const filteredEvents = filterEventsByLayers(events, visibleLayers)

  // Generar array de 12 meses (0-11)
  const months = Array.from({ length: 12 }, (_, i) => i)

  return (
    <div className="space-y-6">
      {/* Header con filtros y navegación de año */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
        {/* Filtros de capas */}
        <div>
          <LayerFilters
            visibleLayers={visibleLayers}
            onToggleLayer={handleToggleLayer}
          />
        </div>

        {/* Navegación de año */}
        <div className="flex items-center justify-between lg:justify-end gap-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando eventos...
            </div>
          )}
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setYear(year - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl font-bold min-w-[100px] text-center">{year}</h2>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setYear(year + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Grid de 12 meses */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {months.map((month) => (
          <CalendarGrid
            key={month}
            year={year}
            month={month}
            events={filteredEvents}
            onEventClick={handleEventClick}
          />
        ))}
      </div>

      {/* Panel de detalles del evento */}
      <EventDetailsPanel
        event={selectedEvent}
        open={isDetailsPanelOpen}
        onClose={() => setIsDetailsPanelOpen(false)}
        onEdit={handleEditEvent}
        onDelete={handleDeleteEvent}
        currentUserId={currentUserId}
      />
    </div>
  )
}

