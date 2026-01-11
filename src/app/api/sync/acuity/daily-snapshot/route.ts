import { NextRequest, NextResponse } from 'next/server'
import { AcuityService, normalizeStoreName, AcuityAppointmentCategory } from '@/lib/integrations/acuity'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { format, startOfDay } from 'date-fns'
import { isAuthorizedCronRequest } from '@/lib/utils/cron-auth'

type AcuityAppointment = Database['public']['Tables']['acuity_appointments']['Row']

/**
 * Endpoint para capturar el snapshot del día ACTUAL
 * 
 * Este endpoint se ejecuta al INICIO del día (6-7 AM) para capturar
 * el total de slots configurados para el día completo.
 * 
 * Guarda en: acuity_availability_history con period_type='daily'
 * 
 * Diferencia con /availability:
 * - /availability: Sincroniza slots disponibles en tiempo real (solo futuros)
 * - /daily-snapshot: Captura el total del día ANTES de que empiecen las citas
 */
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
    const targetDate = body.date ? new Date(body.date) : new Date()
    const todayStr = format(startOfDay(targetDate), 'yyyy-MM-dd')
    const snapshotTime = new Date()

    console.log(`[Daily Snapshot] Creating snapshot for ${todayStr} at ${snapshotTime.toISOString()}...`)

    // 1. Obtener todos los tipos de citas activos
    console.log('[Daily Snapshot] Fetching appointment types...')
    const appointmentTypes = await acuityService.getAppointmentTypes()
    console.log(`[Daily Snapshot] Found ${appointmentTypes.length} appointment types`)

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
    }

    // 2. Obtener disponibilidad por empleado para HOY
    const storeAvailabilityData = new Map<string, {
      date: string
      storeName: string
      appointmentTypeID: number
      appointmentCategory: AcuityAppointmentCategory
      totalSlotsDay: number
    }>()

    for (const [typeId, typeInfo] of appointmentTypeMap) {
      try {
        console.log(`[Daily Snapshot] Fetching availability for type ${typeId} (${typeInfo.name})...`)
        
        // Obtener disponibilidad para HOY solamente (maxDays: 1)
        const employeeResults = await acuityService.getAvailabilityByEmployee({
          appointmentTypeID: typeId,
          appointmentTypeName: typeInfo.name,
          category: typeInfo.category,
          supabase: supabase,
          maxDays: 1, // IMPORTANTE: Solo HOY
        })

        // Filtrar solo resultados del día objetivo
        const todayResults = employeeResults.filter(r => r.date === todayStr)

        // Agregar por tienda
        for (const employeeResult of todayResults) {
          const normalizedStoreName = normalizeStoreName(employeeResult.appointmentTypeName)
          const storeKey = `${employeeResult.date}-${normalizedStoreName}-${employeeResult.category}`

          if (!storeAvailabilityData.has(storeKey)) {
            storeAvailabilityData.set(storeKey, {
              date: employeeResult.date,
              storeName: normalizedStoreName,
              appointmentTypeID: employeeResult.appointmentTypeID,
              appointmentCategory: employeeResult.category,
              totalSlotsDay: 0,
            })
          }

          const storeData = storeAvailabilityData.get(storeKey)!
          storeData.totalSlotsDay += employeeResult.totalSlots
        }

        console.log(`[Daily Snapshot] Processed ${todayResults.length} availability records for type ${typeId}`)
      } catch (error) {
        console.error(`[Daily Snapshot] Error processing type ${typeId}:`, error)
        // Continuar con el siguiente tipo
      }
    }

    // 3. Calcular slots reservados desde acuity_appointments
    console.log('[Daily Snapshot] Calculating booked slots from appointments...')
    
    // Obtener todas las citas de HOY
    const { data: appointments } = await supabase
      .from('acuity_appointments')
      .select('datetime, appointment_type_id, appointment_type_name, appointment_category, status')
      .gte('datetime', todayStr)
      .lt('datetime', format(new Date(targetDate.getTime() + 86400000), 'yyyy-MM-dd')) // Menos de mañana
      .neq('status', 'canceled')

    // Contar citas reservadas por tienda
    const bookedSlotsByStoreMap = new Map<string, number>()
    
    if (appointments) {
      const appointmentsTyped = appointments as AcuityAppointment[]
      for (const apt of appointmentsTyped) {
        const appointmentDate = format(new Date(apt.datetime), 'yyyy-MM-dd')
        
        // Por tienda
        const normalizedStoreName = normalizeStoreName(apt.appointment_type_name)
        const storeKey = `${appointmentDate}-${normalizedStoreName}-${apt.appointment_category}`
        const storeCount = bookedSlotsByStoreMap.get(storeKey) || 0
        bookedSlotsByStoreMap.set(storeKey, storeCount + 1)
      }
      
      console.log(`[Daily Snapshot] Found ${appointmentsTyped.length} booked appointments for ${todayStr}`)
    }

    // 4. Guardar en base de datos (acuity_availability_history con period_type='daily')
    console.log('[Daily Snapshot] Saving to database...')
    
    let savedCount = 0
    for (const [key, storeData] of storeAvailabilityData) {
      const bookedSlots = bookedSlotsByStoreMap.get(key) || 0
      const availableSlots = Math.max(0, storeData.totalSlotsDay - bookedSlots)
      const occupationPercentage = storeData.totalSlotsDay > 0
        ? Math.round((bookedSlots / storeData.totalSlotsDay) * 100 * 100) / 100
        : 0

      const snapshotId = `${storeData.date}-${storeData.storeName}-${storeData.appointmentCategory}-daily`

      const { error } = await supabase
        .from('acuity_availability_history')
        .upsert({
          id: snapshotId,
          snapshot_date: storeData.date,
          store_name: storeData.storeName,
          appointment_category: storeData.appointmentCategory,
          period_type: 'daily',
          period_start: storeData.date,
          period_end: storeData.date,
          total_slots: storeData.totalSlotsDay,
          booked_slots: bookedSlots,
          available_slots: availableSlots,
          occupation_percentage: occupationPercentage,
        } as any, {
          onConflict: 'id',
        })

      if (error) {
        console.error(`[Daily Snapshot] Error saving ${snapshotId}:`, error)
      } else {
        savedCount++
      }
    }

    console.log(`[Daily Snapshot] Saved ${savedCount} daily snapshot records for ${todayStr}`)

    return NextResponse.json({
      success: true,
      message: `Daily snapshot captured for ${todayStr}`,
      date: todayStr,
      snapshot_time: snapshotTime.toISOString(),
      records_saved: savedCount,
      note: 'This snapshot captures the FULL day capacity at the start of the day',
    })
  } catch (error) {
    console.error('Daily snapshot error:', error)
    
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
        error: 'Failed to create daily snapshot', 
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
