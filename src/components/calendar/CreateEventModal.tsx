'use client'

import { useState, useEffect } from 'react'
import { CalendarEvent, CalendarLayer, getAllLayers, getLayerName, dateToString } from '@/lib/utils/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon, Loader2, Link as LinkIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreateEventModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editEvent?: CalendarEvent | null
}

interface AttachmentLink {
  url: string
  title: string
}

export function CreateEventModal({ open, onClose, onSuccess, editEvent }: CreateEventModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [layer, setLayer] = useState<CalendarLayer>('marketing')
  const [attachments, setAttachments] = useState<AttachmentLink[]>([])
  const [newLinkUrl, setNewLinkUrl] = useState('')
  const [newLinkTitle, setNewLinkTitle] = useState('')
  const [error, setError] = useState('')

  const isEditMode = !!editEvent

  // Cargar datos del evento al editar
  useEffect(() => {
    if (editEvent) {
      setTitle(editEvent.title)
      setDescription(editEvent.description || '')
      setStartDate(new Date(editEvent.start_date))
      setEndDate(new Date(editEvent.end_date))
      setLayer(editEvent.layer)
      setAttachments((editEvent.attachments as AttachmentLink[]) || [])
    } else {
      // Resetear formulario al crear nuevo
      setTitle('')
      setDescription('')
      setStartDate(undefined)
      setEndDate(undefined)
      setLayer('marketing')
      setAttachments([])
    }
    setError('')
  }, [editEvent, open])

  const handleAddLink = () => {
    if (!newLinkUrl) return
    
    setAttachments([...attachments, {
      url: newLinkUrl,
      title: newLinkTitle || newLinkUrl
    }])
    setNewLinkUrl('')
    setNewLinkTitle('')
  }

  const handleRemoveLink = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validaciones
    if (!title.trim()) {
      setError('El título es requerido')
      return
    }

    if (!startDate || !endDate) {
      setError('Las fechas de inicio y fin son requeridas')
      return
    }

    if (endDate < startDate) {
      setError('La fecha de fin debe ser mayor o igual a la fecha de inicio')
      return
    }

    setIsSubmitting(true)

    try {
      const eventData = {
        title: title.trim(),
        description: description.trim() || null,
        start_date: dateToString(startDate),
        end_date: dateToString(endDate),
        layer,
        attachments,
      }

      const url = isEditMode 
        ? `/api/calendar/events/${editEvent.id}`
        : '/api/calendar/events'
      
      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al guardar evento')
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error saving event:', err)
      setError(err instanceof Error ? err.message : 'Error al guardar evento')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Editar Evento' : 'Crear Nuevo Evento'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Modifica los detalles del evento en el calendario.' 
              : 'Agrega un nuevo evento al calendario compartido.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Título <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Lanzamiento de campaña Q1"
              required
            />
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles adicionales del evento..."
              rows={3}
            />
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fecha de inicio */}
            <div className="space-y-2">
              <Label>
                Fecha de Inicio <span className="text-red-500">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP', { locale: es }) : 'Seleccionar fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0" 
                  align="start" 
                  side="bottom"
                  sideOffset={8}
                >
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    locale={es}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Fecha de fin */}
            <div className="space-y-2">
              <Label>
                Fecha de Fin <span className="text-red-500">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PPP', { locale: es }) : 'Seleccionar fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-auto p-0" 
                  align="start" 
                  side="bottom"
                  sideOffset={8}
                >
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    locale={es}
                    disabled={(date) => startDate ? date < startDate : false}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Capa */}
          <div className="space-y-2">
            <Label htmlFor="layer">
              Capa <span className="text-red-500">*</span>
            </Label>
            <Select value={layer} onValueChange={(value) => setLayer(value as CalendarLayer)}>
              <SelectTrigger id="layer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getAllLayers().map((layerOption) => (
                  <SelectItem key={layerOption} value={layerOption}>
                    {getLayerName(layerOption)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Enlaces/Adjuntos */}
          <div className="space-y-2">
            <Label>Enlaces</Label>
            
            {/* Lista de enlaces existentes */}
            {attachments.length > 0 && (
              <div className="space-y-2 mb-3">
                {attachments.map((link, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <LinkIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{link.title}</div>
                      <div className="text-xs text-gray-500 truncate">{link.url}</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveLink(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Agregar nuevo enlace */}
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="URL del enlace"
                  type="url"
                />
                <Input
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  placeholder="Título (opcional)"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddLink}
                disabled={!newLinkUrl}
                className="self-start"
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Footer */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? 'Guardar Cambios' : 'Crear Evento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

