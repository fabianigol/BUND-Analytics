import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { Database } from '@/types/database'

type CalendarEvent = Database['public']['Tables']['calendar_events']['Row']

/**
 * PUT /api/calendar/events/[id]
 * Actualiza un evento de calendario (solo si el usuario es el creador)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id: eventId } = await params

    // Verificar que el evento existe y pertenece al usuario
    const { data: existingEvent, error: fetchError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .single<CalendarEvent>()

    if (fetchError || !existingEvent) {
      return NextResponse.json(
        { error: 'Evento no encontrado' },
        { status: 404 }
      )
    }

    if (existingEvent.user_id !== user.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para editar este evento' },
        { status: 403 }
      )
    }

    // Obtener datos del body
    const body = await request.json()
    const { title, description, start_date, end_date, layer, attachments } = body

    // Validar que end_date >= start_date si se proporcionan ambos
    if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
      return NextResponse.json(
        { error: 'La fecha de fin debe ser mayor o igual a la fecha de inicio' },
        { status: 400 }
      )
    }

    // Validar capa si se proporciona
    if (layer) {
      const validLayers = ['marketing', 'operations', 'pr', 'retail', 'product', 'personal', 'otros']
      if (!validLayers.includes(layer)) {
        return NextResponse.json(
          { error: 'Capa inválida' },
          { status: 400 }
        )
      }
    }

    // Preparar datos para actualizar
    const updateData: Record<string, any> = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (start_date !== undefined) updateData.start_date = start_date
    if (end_date !== undefined) updateData.end_date = end_date
    if (layer !== undefined) updateData.layer = layer
    if (attachments !== undefined) updateData.attachments = attachments

    // Actualizar evento
    const { data: event, error } = await (supabase
      .from('calendar_events') as any)
      .update(updateData)
      .eq('id', eventId)
      .select()
      .single()

    if (error) {
      console.error('Error updating event:', error)
      return NextResponse.json(
        { error: 'Error al actualizar evento' },
        { status: 500 }
      )
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Error inesperado' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/calendar/events/[id]
 * Elimina un evento de calendario (solo si el usuario es el creador)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id: eventId } = await params

    // Verificar que el evento existe y pertenece al usuario
    const { data: existingEvent, error: fetchError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .single<CalendarEvent>()

    if (fetchError || !existingEvent) {
      return NextResponse.json(
        { error: 'Evento no encontrado' },
        { status: 404 }
      )
    }

    if (existingEvent.user_id !== user.id) {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar este evento' },
        { status: 403 }
      )
    }

    // Eliminar evento
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId)

    if (error) {
      console.error('Error deleting event:', error)
      return NextResponse.json(
        { error: 'Error al eliminar evento' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Error inesperado' },
      { status: 500 }
    )
  }
}

