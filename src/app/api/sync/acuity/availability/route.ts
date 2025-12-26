import { NextRequest, NextResponse } from 'next/server'
import { AcuityService, normalizeStoreName, AcuityAppointmentCategory, AvailabilityByEmployeeResult } from '@/lib/integrations/acuity'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { format, addMonths } from 'date-fns'
import { isAuthorizedCronRequest } from '@/lib/utils/cron-auth'

type AcuityAppointment = Database['public']['Tables']['acuity_appointments']['Row']

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Permitir acceso desde cron jobs autorizados sin autenticación de usuario
    const isCronRequest = isAuthorizedCronRequest(request)
    
    // Si no es un cron request, verificar autenticación de usuario
    if (!isCronRequest) {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized', details: 'User not authenticated' },
          { status: 401 }
        )
      }
    }

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

    // 2. Obtener disponibilidad por empleado para cada tipo de cita
    const employeeAvailabilityData = new Map<string, AvailabilityByEmployeeResult>()
    const storeAvailabilityData = new Map<string, {
      date: string
      storeName: string
      appointmentTypeID: number
      appointmentCategory: AcuityAppointmentCategory
      totalSlots: number
    }>()

    for (const [typeId, typeInfo] of appointmentTypeMap) {
      try {
        console.log(`[Acuity Availability Sync] Fetching availability by employee for type ${typeId} (${typeInfo.name})...`)
        
        // Obtener disponibilidad por empleado
        const employeeResults = await acuityService.getAvailabilityByEmployee({
          appointmentTypeID: typeId,
          appointmentTypeName: typeInfo.name,
          category: typeInfo.category,
          supabase: supabase,
          maxDays: maxDays,
        })

        // Guardar información por empleado
        for (const employeeResult of employeeResults) {
          const employeeKey = `${employeeResult.date}-${employeeResult.calendarName}-${employeeResult.category}`
          employeeAvailabilityData.set(employeeKey, employeeResult)

          // También agregar por tienda
          const normalizedStoreName = normalizeStoreName(employeeResult.appointmentTypeName)
          const storeKey = `${employeeResult.date}-${normalizedStoreName}-${employeeResult.category}`

          if (!storeAvailabilityData.has(storeKey)) {
            storeAvailabilityData.set(storeKey, {
              date: employeeResult.date,
              storeName: normalizedStoreName,
              appointmentTypeID: employeeResult.appointmentTypeID,
              appointmentCategory: employeeResult.category,
              totalSlots: 0,
            })
          }

          const storeData = storeAvailabilityData.get(storeKey)!
          storeData.totalSlots += employeeResult.totalSlots
        }

        console.log(`[Acuity Availability Sync] Processed ${employeeResults.length} availability records by employee for type ${typeId}`)
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

    // Obtener todas las citas en el rango de fechas con información de empleado
    const { data: appointments } = await supabase
      .from('acuity_appointments')
      .select('datetime, appointment_type_id, appointment_type_name, appointment_category, status, calendar_id, calendar_name')
      .gte('datetime', todayStr)
      .lte('datetime', endDateStr)
      .neq('status', 'canceled')

    // Contar citas reservadas por empleado (para acuity_availability)
    const bookedSlotsByEmployeeMap = new Map<string, number>()
    // Contar citas reservadas por tienda (para acuity_availability_by_store)
    const bookedSlotsByStoreMap = new Map<string, number>()
    
    if (appointments) {
      const appointmentsTyped = appointments as AcuityAppointment[]
      for (const apt of appointmentsTyped) {
        const appointmentDate = format(new Date(apt.datetime), 'yyyy-MM-dd')
        const calendarName = apt.calendar_name || 'Unknown'
        
        // Por empleado
        const employeeKey = `${appointmentDate}-${calendarName}-${apt.appointment_category}`
        const employeeCount = bookedSlotsByEmployeeMap.get(employeeKey) || 0
        bookedSlotsByEmployeeMap.set(employeeKey, employeeCount + 1)
        
        // Por tienda
        const normalizedStoreName = normalizeStoreName(apt.appointment_type_name)
        const storeKey = `${appointmentDate}-${normalizedStoreName}-${apt.appointment_category}`
        const storeCount = bookedSlotsByStoreMap.get(storeKey) || 0
        bookedSlotsByStoreMap.set(storeKey, storeCount + 1)
      }
    }

    // 4. Guardar en base de datos
    console.log('[Acuity Availability Sync] Saving to database...')
    
    // 4a. Guardar por empleado en acuity_availability
    let employeeSavedCount = 0
    let skippedCount = 0
    for (const [key, employeeData] of employeeAvailabilityData) {
      // Validar que tenemos calendarID y calendarName válidos
      if (!employeeData.calendarID || !employeeData.calendarName || employeeData.calendarName === 'Unknown') {
        console.warn(`[Acuity Availability Sync] Skipping record with invalid calendar data: calendarID=${employeeData.calendarID}, calendarName=${employeeData.calendarName}`)
        skippedCount++
        continue
      }

      const bookedSlots = bookedSlotsByEmployeeMap.get(key) || 0
      const availableSlots = Math.max(0, employeeData.totalSlots - bookedSlots)

      const availabilityId = `${employeeData.date}-${employeeData.calendarID}-${employeeData.category}`

      await supabase
        .from('acuity_availability')
        .upsert({
          id: availabilityId,
          date: employeeData.date,
          calendar_id: employeeData.calendarID,
          calendar_name: employeeData.calendarName,
          appointment_category: employeeData.category,
          total_slots: employeeData.totalSlots,
          booked_slots: bookedSlots,
          available_slots: availableSlots,
        } as any, {
          onConflict: 'id',
        })

      employeeSavedCount++
    }

    console.log(`[Acuity Availability Sync] Saved ${employeeSavedCount} availability records by employee`)
    if (skippedCount > 0) {
      console.warn(`[Acuity Availability Sync] Skipped ${skippedCount} records with invalid calendar data`)
    }

    // 4b. Guardar agregado por tienda en acuity_availability_by_store
    let storeSavedCount = 0
    for (const [key, storeData] of storeAvailabilityData) {
      const bookedSlots = bookedSlotsByStoreMap.get(key) || 0
      const availableSlots = Math.max(0, storeData.totalSlots - bookedSlots)

      const availabilityId = `${storeData.date}-${storeData.storeName}-${storeData.appointmentCategory}`

      await supabase
        .from('acuity_availability_by_store')
        .upsert({
          id: availabilityId,
          date: storeData.date,
          store_name: storeData.storeName,
          appointment_type_id: storeData.appointmentTypeID,
          appointment_category: storeData.appointmentCategory,
          total_slots: storeData.totalSlots,
          booked_slots: bookedSlots,
          available_slots: availableSlots,
        } as any, {
          onConflict: 'id',
        })

      storeSavedCount++
    }

    console.log(`[Acuity Availability Sync] Saved ${storeSavedCount} availability records by store`)

    return NextResponse.json({
      success: true,
      message: 'Availability synced successfully (by employee and by store)',
      records_by_employee: employeeSavedCount,
      records_by_store: storeSavedCount,
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

