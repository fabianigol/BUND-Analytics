import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AcuityService, createAcuityServiceFromSupabase } from '@/lib/integrations/acuity'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Obtener el body del webhook
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // Acuity envía webhooks con estructura: { id: appointmentId, action: 'scheduled' | 'canceled' | 'rescheduled' }
    const { id: appointmentId, action } = body

    if (!appointmentId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: id, action' },
        { status: 400 }
      )
    }

    console.log(`[Acuity Webhook] Received event: ${action} for appointment ${appointmentId}`)

    // Obtener servicio de Acuity
    const acuityService = await createAcuityServiceFromSupabase(supabase)
    if (!acuityService) {
      console.error('[Acuity Webhook] Acuity service not available')
      return NextResponse.json(
        { error: 'Acuity service not configured' },
        { status: 500 }
      )
    }

    // Obtener detalles de la cita
    let appointment
    try {
      appointment = await acuityService.getAppointment(appointmentId)
    } catch (error) {
      console.error(`[Acuity Webhook] Error fetching appointment ${appointmentId}:`, error)
      // Si la cita fue cancelada, puede que ya no exista en Acuity
      if (action === 'canceled') {
        // Actualizar en BD como cancelada si existe
        await supabase
          .from('acuity_appointments')
          // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
          } as any)
          .eq('acuity_id', appointmentId)
        
        return NextResponse.json({ success: true, message: 'Appointment marked as canceled' })
      }
      throw error
    }

    // Obtener tipo de cita para identificar categoría
    const appointmentTypes = await acuityService.getAppointmentTypes()
    const appointmentType = appointmentTypes.find(t => t.id === appointment.appointmentTypeID)
    const category = appointmentType 
      ? acuityService.identifyCategory(appointmentType, appointmentType.schedulingLink)
      : 'fitting'

    // Determinar estado según la acción
    let status: 'scheduled' | 'canceled' | 'rescheduled' = 'scheduled'
    if (action === 'canceled') {
      status = 'canceled'
    } else if (action === 'rescheduled') {
      status = 'rescheduled'
    }

    // Actualizar o insertar cita en BD
    const appointmentData = {
      acuity_id: appointment.id,
      calendar_id: appointment.calendarID,
      calendar_name: appointment.calendar || 'Unknown',
      appointment_type_id: appointment.appointmentTypeID,
      appointment_type_name: appointment.type,
      appointment_category: category,
      datetime: appointment.datetime,
      end_time: appointment.endTime,
      customer_name: appointment.firstName && appointment.lastName 
        ? `${appointment.firstName} ${appointment.lastName}` 
        : appointment.firstName || appointment.lastName || null,
      customer_email: appointment.email || null,
      phone: appointment.phone || null,
      notes: appointment.notes || null,
      status,
      canceled_at: action === 'canceled' ? appointment.datetime : null,
      scheduling_link: appointmentType?.schedulingLink || null,
    }

    // Check if appointment exists
    const { data: existing } = await supabase
      .from('acuity_appointments')
      .select('id')
      .eq('acuity_id', appointmentId)
      .single()

    if (existing) {
      await supabase
        .from('acuity_appointments')
        // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
        .update(appointmentData as any)
        .eq('acuity_id', appointmentId)
      console.log(`[Acuity Webhook] Updated appointment ${appointmentId}`)
    } else {
      await supabase
        .from('acuity_appointments')
        // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
        .insert(appointmentData as any)
      console.log(`[Acuity Webhook] Inserted new appointment ${appointmentId}`)
    }

    // Si se canceló o reagendó, actualizar conteos mensuales
    if (action === 'canceled' || action === 'rescheduled') {
      const appointmentDate = new Date(appointment.datetime)
      const year = appointmentDate.getFullYear()
      const month = appointmentDate.getMonth() + 1
      const countId = `${year}-${String(month).padStart(2, '0')}-${appointment.calendar || 'Unknown'}-${category}`

      // Obtener conteo actual
      const { data: count } = await supabase
        .from('acuity_appointment_counts')
        .select('*')
        .eq('id', countId)
        .single()

      if (count) {
        // Actualizar conteos
        const updates: any = {}
        const countTyped = count as any
        if (action === 'canceled') {
          updates.canceled_count = (countTyped.canceled_count || 0) + 1
          // Si estaba como scheduled, restar 1
          if (status !== 'rescheduled') {
            updates.scheduled_count = Math.max(0, (countTyped.scheduled_count || 0) - 1)
          }
        } else if (action === 'rescheduled') {
          updates.rescheduled_count = (countTyped.rescheduled_count || 0) + 1
        }
        updates.total_count = (countTyped.total_count || 0) + (action === 'canceled' ? 0 : 1)

        await supabase
          .from('acuity_appointment_counts')
          // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
          .update(updates as any)
          .eq('id', countId)
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Appointment ${appointmentId} ${action} successfully` 
    })
  } catch (error) {
    console.error('Acuity webhook error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process webhook', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

