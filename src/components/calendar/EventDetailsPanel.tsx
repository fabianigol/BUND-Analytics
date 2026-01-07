'use client'

import { useState } from 'react'
import { CalendarEvent, getLayerColor, getLayerName, formatDateRange } from '@/lib/utils/calendar'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Edit, Trash2, ExternalLink, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface EventDetailsPanelProps {
  event: CalendarEvent | null
  open: boolean
  onClose: () => void
  onEdit: (event: CalendarEvent) => void
  onDelete: () => void
  currentUserId: string
}

interface AttachmentLink {
  url: string
  title: string
}

export function EventDetailsPanel({
  event,
  open,
  onClose,
  onEdit,
  onDelete,
  currentUserId,
}: EventDetailsPanelProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  if (!event) return null

  const layerColor = getLayerColor(event.layer)
  const layerName = getLayerName(event.layer)
  const dateRange = formatDateRange(event.start_date, event.end_date)
  const canEdit = event.user_id === currentUserId
  const attachments = (event.attachments as AttachmentLink[]) || []

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/calendar/events/${event.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Error al eliminar evento')
      }

      onDelete()
      onClose()
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('Error al eliminar el evento')
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: layerColor }}
              />
              <span className="flex-1">{event.title}</span>
            </SheetTitle>
            <SheetDescription>
              Detalles del evento
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Capa */}
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Capa</div>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: layerColor }}
                />
                <span className="text-sm">{layerName}</span>
              </div>
            </div>

            <Separator />

            {/* Fechas */}
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Fechas</div>
              <div className="text-sm">{dateRange}</div>
            </div>

            {/* Descripción */}
            {event.description && (
              <>
                <Separator />
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-2">Descripción</div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {event.description}
                  </div>
                </div>
              </>
            )}

            {/* Enlaces/Adjuntos */}
            {attachments.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-2">Enlaces</div>
                  <div className="space-y-2">
                    {attachments.map((link, index) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded transition-colors group"
                      >
                        <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate group-hover:text-primary">
                            {link.title}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{link.url}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Información adicional */}
            <div className="text-xs text-gray-500 space-y-1">
              <div>Creado: {new Date(event.created_at).toLocaleString('es-ES')}</div>
              {event.updated_at !== event.created_at && (
                <div>Actualizado: {new Date(event.updated_at).toLocaleString('es-ES')}</div>
              )}
            </div>

            {/* Acciones */}
            {canEdit && (
              <>
                <Separator />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => onEdit(event)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Eliminar
                  </Button>
                </div>
              </>
            )}

            {!canEdit && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                Este evento fue creado por otro usuario. Solo puedes verlo.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El evento "{event.title}" será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}


