'use client'

import { useState } from 'react'
import { Header } from '@/components/dashboard/Header'
import { FullYearCalendar } from '@/components/calendar/FullYearCalendar'
import { CreateEventModal } from '@/components/calendar/CreateEventModal'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CalendarEvent } from '@/lib/utils/calendar'

export default function CalendarioPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleOpenCreateModal = () => {
    setEditingEvent(null)
    setIsCreateModalOpen(true)
  }

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event)
    setIsCreateModalOpen(true)
  }

  const handleModalClose = () => {
    setIsCreateModalOpen(false)
    setEditingEvent(null)
  }

  const handleEventSuccess = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="min-h-screen p-8">
      <Header 
        title="Calendario Anual" 
        subtitle="Gestiona eventos y planificación del equipo"
      />

      <div className="mt-8">
        <FullYearCalendar
          onCreateEvent={handleOpenCreateModal}
          onEditEvent={handleEditEvent}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Botón flotante para crear evento */}
      <Button
        onClick={handleOpenCreateModal}
        size="lg"
        className="fixed bottom-8 right-8 rounded-full shadow-lg h-14 w-14 p-0"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Modal de crear/editar evento */}
      <CreateEventModal
        open={isCreateModalOpen}
        onClose={handleModalClose}
        onSuccess={handleEventSuccess}
        editEvent={editingEvent}
      />
    </div>
  )
}


