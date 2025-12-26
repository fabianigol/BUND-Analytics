import { NextRequest, NextResponse } from 'next/server'
import { AcuityService, normalizeStoreName, AcuityAppointmentCategory } from '@/lib/integrations/acuity'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { format, addMonths } from 'date-fns'

type AcuityAppointment = Database['public']['Tables']['acuity_appointments']['Row']

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Obtener credenciales desde Supabase
    const { data: settingsData, error: settingsError } = await supabase
      .from('integration_settings')
      .select('settings, connected, created_at')
      .eq('integration', 'acuity')
      .single()
    const settings = settingsData as Database['public']['Tables']['integration_settings']['Row'] | null

    if (settingsError || !settings || !(settings as any).connected) {
      return NextResponse.json(
        { error: 'Acuity no está conectado. Por favor, configura las credenciales primero.' },
        { status: 400 }
      )
    }

    const { user_id, api_key } = (settings.settings as any) || {}

    if (!user_id || !api_key) {
      return NextResponse.json(
        { error: 'Credenciales de Acuity incompletas. Por favor, reconecta la integración.' },
        { status: 400 }
      )
    }

    // Crear servicio
    const acuityService = new AcuityService({
      userId: user_id,
      apiKey: api_key,
    })

    // Obtener parámetros opcionales del request
    const body = await request.json().catch(() => ({}))
    // IMPORTANTE: Acuity limita las consultas a 21 días (configuración de "máximo de días")
    // El parámetro months se ignora y se usa el límite de 21 días
    const maxDays = body.maxDays || 21
    const monthsToSync = body.months || 1 // Deprecated: se limita automáticamente a 21 días

    console.log(`[Acuity Availability Sync] Starting sync (limited to ${maxDays} days by Acuity scheduling limits)...`)

    // 1. Obtener todos los tipos de citas activos
    console.log('[Acuity Availability Sync] Fetching appointment types...')
    const appointmentTypes = await acuityService.getAppointmentTypes()
    console.log(`[Acuity Availability Sync] Found ${appointmentTypes.length} appointment types`)

    // Crear mapa de tipos de citas con sus categorías
    const appointmentTypeMap = new Map<number, { 
      type: any
      category: AcuityAppointmentCategory
      name: string
    }>()
    
    for (const type of appointmentTypes) {
      const category = acuityService.identifyCategory(type, type.schedulingLink)
      appointmentTypeMap.set(type.id, {
        type,
        category,
        name: type.name,
      })
      console.log(`[Acuity Availability Sync] Appointment type "${type.name}" (ID: ${type.id}) -> Category: ${category}`)
    }

    // 2. Obtener disponibilidad para cada tipo de cita
    const availabilityData = new Map<string, {
      date: string
      storeName: string
      appointmentTypeID: number
      appointmentCategory: AcuityAppointmentCategory
      totalSlots: number
    }>()

    for (const [typeId, typeInfo] of appointmentTypeMap) {
      try {
        console.log(`[Acuity Availability Sync] Fetching availability for type ${typeId} (${typeInfo.name})...`)
        
        const availabilityResults = await acuityService.getAvailabilityByStore({
          appointmentTypeID: typeId,
          appointmentTypeName: typeInfo.name,
          category: typeInfo.category,
          months: monthsToSync, // Deprecated pero se mantiene por compatibilidad
          supabase: supabase,
          maxDays: maxDays,
        })

        // Normalizar nombre de tienda y agrupar por fecha, tienda y categoría
        // Cada resultado ya viene con la fecha, tipo y categoría, solo necesitamos normalizar el nombre
        for (const result of availabilityResults) {
          const normalizedStoreName = normalizeStoreName(result.appointmentTypeName)
          const key = `${result.date}-${normalizedStoreName}-${result.category}`

          if (!availabilityData.has(key)) {
            availabilityData.set(key, {
              date: result.date,
              storeName: normalizedStoreName,
              appointmentTypeID: result.appointmentTypeID,
              appointmentCategory: result.category,
              totalSlots: 0,
            })
          }

          const data = availabilityData.get(key)!
          data.totalSlots += result.totalSlots
        }

        console.log(`[Acuity Availability Sync] Processed ${availabilityResults.length} availability records for type ${typeId}`)
      } catch (error) {
        console.error(`[Acuity Availability Sync] Error processing type ${typeId}:`, error)
        // Continuar con el siguiente tipo
      }
    }

    // 3. Calcular slots reservados desde acuity_appointments
    console.log('[Acuity Availability Sync] Calculating booked slots from appointments...')
    
    const today = new Date()
    // Limitar a 21 días en lugar de meses
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + maxDays)
    const todayStr = format(today, 'yyyy-MM-dd')
    const endDateStr = format(endDate, 'yyyy-MM-dd')

    // Obtener todas las citas en el rango de fechas
    const { data: appointments } = await supabase
      .from('acuity_appointments')
      .select('datetime, appointment_type_id, appointment_type_name, appointment_category, status')
      .gte('datetime', todayStr)
      .lte('datetime', endDateStr)
      .neq('status', 'canceled')

    // Contar citas reservadas por fecha, tienda y categoría
    const bookedSlotsMap = new Map<string, number>()
    if (appointments) {
      const appointmentsTyped = appointments as AcuityAppointment[]
      for (const apt of appointmentsTyped) {
        const appointmentDate = format(new Date(apt.datetime), 'yyyy-MM-dd')
        const normalizedStoreName = normalizeStoreName(apt.appointment_type_name)
        const key = `${appointmentDate}-${normalizedStoreName}-${apt.appointment_category}`

        const currentCount = bookedSlotsMap.get(key) || 0
        bookedSlotsMap.set(key, currentCount + 1)
      }
    }

    // 4. Guardar en base de datos
    console.log('[Acuity Availability Sync] Saving to database...')
    let savedCount = 0

    for (const [key, data] of availabilityData) {
      const bookedSlots = bookedSlotsMap.get(key) || 0
      const availableSlots = Math.max(0, data.totalSlots - bookedSlots)

      const availabilityId = `${data.date}-${data.storeName}-${data.appointmentCategory}`

      await supabase
        .from('acuity_availability_by_store')
        .upsert({
          id: availabilityId,
          date: data.date,
          store_name: data.storeName,
          appointment_type_id: data.appointmentTypeID,
          appointment_category: data.appointmentCategory,
          total_slots: data.totalSlots,
          booked_slots: bookedSlots,
          available_slots: availableSlots,
        } as any, {
          onConflict: 'id',
        })

      savedCount++
    }

    console.log(`[Acuity Availability Sync] Saved ${savedCount} availability records`)

    return NextResponse.json({
      success: true,
      message: 'Availability by store synced successfully',
      records_synced: savedCount,
      days_synced: maxDays,
      note: 'Limited by Acuity "max days" scheduling limit (21 days)',
    })
  } catch (error) {
    console.error('Acuity availability sync error:', error)
    
    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = JSON.stringify(error)
    } else {
      errorMessage = String(error)
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to sync availability by store', 
        details: errorMessage
      },
      { status: 500 }
    )
  }
}

