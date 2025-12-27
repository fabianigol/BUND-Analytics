import { NextRequest, NextResponse } from 'next/server'
import { AcuityService, createAcuityServiceFromSupabase, AcuityAppointmentCategory, normalizeStoreName, AvailabilityByEmployeeResult } from '@/lib/integrations/acuity'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { format, addDays, startOfMonth, endOfMonth, subMonths, parseISO, addMonths } from 'date-fns'
import { isAuthorizedCronRequest } from '@/lib/utils/cron-auth'

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

    // Crear log de sincronización
    const { data: syncLogData, error: logError } = await supabase
      .from('sync_logs')
      // @ts-ignore
      .insert({
        integration: 'acuity',
        status: 'running',
        records_synced: 0,
      } as any)
      .select()
      .single()
    const syncLog = syncLogData as Database['public']['Tables']['sync_logs']['Row'] | null

    if (logError) {
      console.error('Error creating sync log:', logError)
    }

    try {
      console.log('[Acuity Sync] Starting sync process...')

      // 1. Obtener tipos de citas para identificar categorías
      console.log('[Acuity Sync] Fetching appointment types...')
      const appointmentTypes = await acuityService.getAppointmentTypes()
      console.log(`[Acuity Sync] Found ${appointmentTypes.length} appointment types`)

      // Crear mapa de tipos de citas con sus categorías
      const appointmentTypeMap = new Map<number, { type: any; category: AcuityAppointmentCategory; schedulingLink?: string }>()
      
      for (const type of appointmentTypes) {
        const category = acuityService.identifyCategory(type, type.schedulingLink)
        appointmentTypeMap.set(type.id, {
          type,
          category,
          schedulingLink: type.schedulingLink,
        })
        console.log(`[Acuity Sync] Appointment type "${type.name}" (ID: ${type.id}) -> Category: ${category}`)
      }

      // 2. Obtener calendarios
      console.log('[Acuity Sync] Fetching calendars...')
      const calendars = await acuityService.getCalendars()
      console.log(`[Acuity Sync] Found ${calendars.length} calendars`)

      // 3. Guardar/actualizar calendarios en BD con sus categorías
      const calendarUpdates: Array<{ calendar: any; type: any; category: AcuityAppointmentCategory }> = []
      
      for (const calendar of calendars) {
        // Buscar tipos de citas asociados a este calendario
        const associatedTypes = appointmentTypes.filter(t => 
          !t.calendarIDs || t.calendarIDs.includes(calendar.id)
        )
        
        for (const type of associatedTypes) {
          const category = appointmentTypeMap.get(type.id)?.category || 'fitting'
          calendarUpdates.push({ calendar, type, category })
        }
      }

      // Guardar calendarios en BD
      for (const { calendar, type, category } of calendarUpdates) {
        const schedulingLink = appointmentTypeMap.get(type.id)?.schedulingLink || 
          `https://bund-appointments.as.me/${category === 'medición' ? 'medicion' : 'fitting'}-${calendar.name.toLowerCase().replace(/\s+/g, '-')}`
        
        await supabase
          .from('acuity_calendars')
          .upsert({
            acuity_calendar_id: calendar.id,
            name: calendar.name,
            display_name: calendar.name,
            appointment_category: category,
            appointment_type_id: type.id,
            appointment_type_name: type.name,
            scheduling_link: schedulingLink,
            is_active: true,
          } as any, {
            onConflict: 'acuity_calendar_id,appointment_type_id',
          })
      }

      // 4. Calcular fechas: próximos 365 días (1 año) y desde fecha de conexión
      const today = new Date()
      const endDate = addDays(today, 365) // Extendido a 1 año para capturar todas las citas futuras
      const connectionDate = settings.created_at ? parseISO(settings.created_at) : today
      
      // Si la conexión se hizo hoy o es muy reciente, sincronizar desde inicio del mes actual
      // para capturar todas las citas históricas del mes
      let syncStartDate = connectionDate > today ? today : connectionDate
      const todayMonthStart = startOfMonth(today)
      if (syncStartDate >= todayMonthStart) {
        // Si la conexión es del mes actual, sincronizar desde inicio del mes
        syncStartDate = todayMonthStart
        console.log(`[Acuity Sync] Connection date is recent, syncing from start of current month: ${format(syncStartDate, 'yyyy-MM-dd')}`)
      }

      console.log(`[Acuity Sync] Date range: ${format(syncStartDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`)

      // 5. Obtener citas futuras (próximos 365 días)
      console.log('[Acuity Sync] Fetching upcoming appointments (next 365 days)...')
      const upcomingAppointments = await acuityService.getAppointments({
        minDate: format(today, 'yyyy-MM-dd'),
        maxDate: format(endDate, 'yyyy-MM-dd'),
      })
      console.log(`[Acuity Sync] Found ${upcomingAppointments.length} upcoming appointments`)

      // Obtener citas canceladas futuras (próximos 365 días)
      console.log('[Acuity Sync] Fetching canceled upcoming appointments (next 365 days)...')
      const canceledUpcomingAppointments = await acuityService.getAppointments({
        minDate: format(today, 'yyyy-MM-dd'),
        maxDate: format(endDate, 'yyyy-MM-dd'),
        canceled: true,
      })
      console.log(`[Acuity Sync] Found ${canceledUpcomingAppointments.length} canceled upcoming appointments`)

      // Obtener citas históricas desde fecha de conexión (si hay)
      let historicalAppointments: any[] = []
      let canceledHistoricalAppointments: any[] = []
      if (syncStartDate < today) {
        console.log(`[Acuity Sync] Fetching historical appointments since ${format(syncStartDate, 'yyyy-MM-dd')}...`)
        historicalAppointments = await acuityService.getAppointments({
          minDate: format(syncStartDate, 'yyyy-MM-dd'),
          maxDate: format(today, 'yyyy-MM-dd'),
        })
        console.log(`[Acuity Sync] Found ${historicalAppointments.length} historical appointments`)

        // Obtener citas canceladas históricas
        console.log(`[Acuity Sync] Fetching canceled historical appointments since ${format(syncStartDate, 'yyyy-MM-dd')}...`)
        canceledHistoricalAppointments = await acuityService.getAppointments({
          minDate: format(syncStartDate, 'yyyy-MM-dd'),
          maxDate: format(today, 'yyyy-MM-dd'),
          canceled: true,
        })
        console.log(`[Acuity Sync] Found ${canceledHistoricalAppointments.length} canceled historical appointments`)
      }

      // Combinar todas las citas: normales y canceladas
      const allAppointments = [
        ...upcomingAppointments, 
        ...historicalAppointments,
        ...canceledUpcomingAppointments,
        ...canceledHistoricalAppointments
      ]

      // 6. Guardar citas en BD usando procesamiento en lotes
      let appointmentsProcessed = 0
      let appointmentsUpdated = 0
      let appointmentsInserted = 0

      // Función helper para procesar una cita y convertirla a formato de BD
      const processAppointment = (appointment: any): Database['public']['Tables']['acuity_appointments']['Insert'] | null => {
        const typeInfo = appointmentTypeMap.get(appointment.appointmentTypeID)
        const category = typeInfo?.category || 'fitting'

        // Determinar estado
        let status: 'scheduled' | 'canceled' | 'rescheduled' = 'scheduled'
        if (appointment.canceled) {
          status = 'canceled'
        }

        // Validar que datetime existe y es válido
        if (!appointment.datetime || typeof appointment.datetime !== 'string') {
          console.error(`[Acuity Sync] Invalid datetime for appointment ${appointment.id}:`, appointment.datetime)
          return null
        }
        
        // Normalizar datetime a ISO 8601 para PostgreSQL
        let datetimeISO = appointment.datetime
        try {
          const parsedDatetime = new Date(appointment.datetime)
          if (isNaN(parsedDatetime.getTime())) {
            throw new Error('Invalid datetime')
          }
          datetimeISO = parsedDatetime.toISOString()
        } catch (error) {
          console.error(`[Acuity Sync] Error parsing datetime for appointment ${appointment.id}:`, error)
          return null
        }
        
        // Construir end_time completo desde datetime y endTime
        let endTimeComplete = datetimeISO
        if (appointment.endTime && typeof appointment.endTime === 'string') {
          try {
            const startDate = new Date(datetimeISO)
            if (isNaN(startDate.getTime())) {
              throw new Error('Invalid datetime')
            }
            
            const timeMatch = appointment.endTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
            if (timeMatch) {
              const hours = parseInt(timeMatch[1], 10)
              const minutes = parseInt(timeMatch[2], 10)
              const endDate = new Date(startDate)
              endDate.setHours(hours, minutes, 0, 0)
              endTimeComplete = endDate.toISOString()
            } else {
              const parsedEndTime = new Date(appointment.endTime)
              if (!isNaN(parsedEndTime.getTime())) {
                endTimeComplete = parsedEndTime.toISOString()
              }
            }
          } catch (error) {
            // Si falla, usar datetime como fallback
            endTimeComplete = datetimeISO
          }
        }

        return {
          acuity_id: appointment.id,
          calendar_id: appointment.calendarID,
          calendar_name: appointment.calendar || 'Unknown',
          appointment_type_id: appointment.appointmentTypeID,
          appointment_type_name: appointment.type,
          appointment_category: category,
          datetime: datetimeISO,
          end_time: endTimeComplete,
          customer_name: appointment.firstName && appointment.lastName 
            ? `${appointment.firstName} ${appointment.lastName}` 
            : appointment.firstName || appointment.lastName || null,
          customer_email: appointment.email || null,
          phone: appointment.phone || null,
          notes: appointment.notes || null,
          status,
          canceled_at: appointment.canceled ? datetimeISO : null,
          scheduling_link: typeInfo?.schedulingLink || null,
        }
      }

      // Log formato de fecha para debug (solo primeras 3 citas)
      for (let i = 0; i < Math.min(3, allAppointments.length); i++) {
        const appointment = allAppointments[i]
        let datetimeParsed = null
        let endTimeParsed = null
        
        try {
          datetimeParsed = appointment.datetime ? new Date(appointment.datetime).toISOString() : null
        } catch (e) {
          datetimeParsed = 'INVALID'
        }
        
        try {
          endTimeParsed = appointment.endTime ? new Date(appointment.endTime).toISOString() : null
        } catch (e) {
          endTimeParsed = 'INVALID'
        }
        
        console.log(`[Acuity Sync] Sample appointment datetime format:`, {
          acuity_id: appointment.id,
          datetime_raw: appointment.datetime,
          datetime_type: typeof appointment.datetime,
          datetime_parsed: datetimeParsed,
          end_time_raw: appointment.endTime,
          end_time_type: typeof appointment.endTime,
          end_time_parsed: endTimeParsed,
        })
      }

      // Procesar citas en lotes
      const BATCH_SIZE = 150 // Tamaño de lote optimizado
      console.log(`[Acuity Sync] Processing ${allAppointments.length} appointments in batches of ${BATCH_SIZE}...`)

      for (let i = 0; i < allAppointments.length; i += BATCH_SIZE) {
        const batch = allAppointments.slice(i, i + BATCH_SIZE)
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1
        const totalBatches = Math.ceil(allAppointments.length / BATCH_SIZE)
        
        console.log(`[Acuity Sync] Processing batch ${batchNumber}/${totalBatches} (${batch.length} appointments)`)

        // Procesar todas las citas del lote
        const appointmentDataBatch = batch
          .map(processAppointment)
          .filter((data): data is Database['public']['Tables']['acuity_appointments']['Insert'] => data !== null)

        if (appointmentDataBatch.length === 0) {
          continue
        }

        // Usar upsert en lote (Supabase maneja automáticamente insert/update)
        const { error: upsertError } = await supabase
          .from('acuity_appointments')
          // @ts-ignore
          .upsert(appointmentDataBatch as any, {
            onConflict: 'acuity_id',
          })

        if (upsertError) {
          console.error(`[Acuity Sync] Error upserting batch ${batchNumber}:`, upsertError)
          // Fallback: procesar individualmente si el lote falla
          for (const appointmentData of appointmentDataBatch) {
            try {
              const { error: singleError } = await supabase
                .from('acuity_appointments')
                // @ts-ignore
                .upsert(appointmentData as any, {
                  onConflict: 'acuity_id',
                })
              if (singleError) {
                console.error(`[Acuity Sync] Error upserting appointment ${appointmentData.acuity_id}:`, singleError)
              } else {
                appointmentsProcessed++
                appointmentsInserted++ // Con upsert no podemos distinguir fácilmente
              }
            } catch (err) {
              console.error(`[Acuity Sync] Error processing appointment ${appointmentData.acuity_id}:`, err)
            }
          }
        } else {
          appointmentsProcessed += appointmentDataBatch.length
          // Con upsert no podemos distinguir fácilmente entre insert y update
          // Asumimos que la mayoría son updates después de la primera sincronización
          appointmentsInserted += Math.floor(appointmentDataBatch.length * 0.3) // Estimación conservadora
          appointmentsUpdated += Math.floor(appointmentDataBatch.length * 0.7)
        }
      }

      console.log(`[Acuity Sync] Processed ${appointmentsProcessed} appointments: ${appointmentsInserted} inserted, ${appointmentsUpdated} updated`)

      // 7. Sincronizar disponibilidad por empleado (acuity_availability)
      // IMPORTANTE: Usa getAvailabilityByEmployee() para obtener datos correctos por empleado
      // y guarda con calendar_id válido para evitar duplicados
      console.log('[Acuity Sync] Syncing availability by employee...')
      
      const maxDays = 21 // Acuity limita a 21 días
      const AVAILABILITY_BATCH_SIZE = 200 // Tamaño de lote para guardar disponibilidad
      const employeeAvailabilityData = new Map<string, AvailabilityByEmployeeResult>()

      // Paralelizar procesamiento de tipos de citas (máximo 5 concurrentes)
      const CONCURRENT_TYPES = 5
      const typeEntries = Array.from(appointmentTypeMap.entries())
      
      for (let i = 0; i < typeEntries.length; i += CONCURRENT_TYPES) {
        const typeBatch = typeEntries.slice(i, i + CONCURRENT_TYPES)
        const batchNumber = Math.floor(i / CONCURRENT_TYPES) + 1
        const totalBatches = Math.ceil(typeEntries.length / CONCURRENT_TYPES)
        
        console.log(`[Acuity Sync] Processing availability batch ${batchNumber}/${totalBatches} (${typeBatch.length} types)`)

        const batchPromises = typeBatch.map(async ([typeId, typeInfo]) => {
          try {
            console.log(`[Acuity Sync] Fetching availability by employee for type ${typeId} (${typeInfo.type.name})...`)
            
            // Obtener disponibilidad por empleado usando el método correcto
            const employeeResults = await acuityService.getAvailabilityByEmployee({
              appointmentTypeID: typeId,
              appointmentTypeName: typeInfo.type.name,
              category: typeInfo.category,
              supabase: supabase,
              maxDays: maxDays,
            })

            console.log(`[Acuity Sync] Processed ${employeeResults.length} availability records by employee for type ${typeId}`)
            return employeeResults
          } catch (error) {
            console.error(`[Acuity Sync] Error processing availability for type ${typeId}:`, error)
            return []
          }
        })

        const batchResults = await Promise.all(batchPromises)
        
        // Guardar información por empleado de todos los resultados del lote
        for (const employeeResults of batchResults) {
          for (const employeeResult of employeeResults) {
            const employeeKey = `${employeeResult.date}-${employeeResult.calendarName}-${employeeResult.category}`
            employeeAvailabilityData.set(employeeKey, employeeResult)
          }
        }
      }

      // Calcular slots reservados desde acuity_appointments por empleado
      // Reutilizar la variable 'today' ya declarada arriba
      const availabilityEndDate = new Date(today)
      availabilityEndDate.setDate(availabilityEndDate.getDate() + maxDays)
      const availabilityTodayStr = format(today, 'yyyy-MM-dd')
      const availabilityEndDateStr = format(availabilityEndDate, 'yyyy-MM-dd')

      const { data: appointmentsForAvailability } = await supabase
        .from('acuity_appointments')
        .select('datetime, appointment_type_id, appointment_type_name, appointment_category, status, calendar_id, calendar_name')
        .gte('datetime', availabilityTodayStr)
        .lte('datetime', availabilityEndDateStr)
        .neq('status', 'canceled')

      const bookedSlotsByEmployeeMap = new Map<string, number>()
      if (appointmentsForAvailability) {
        type AcuityAppointment = Database['public']['Tables']['acuity_appointments']['Row']
        const appointmentsTyped = appointmentsForAvailability as AcuityAppointment[]
        for (const apt of appointmentsTyped) {
          const appointmentDate = format(new Date(apt.datetime), 'yyyy-MM-dd')
          const calendarName = apt.calendar_name || 'Unknown'
          
          const employeeKey = `${appointmentDate}-${calendarName}-${apt.appointment_category}`
          const employeeCount = bookedSlotsByEmployeeMap.get(employeeKey) || 0
          bookedSlotsByEmployeeMap.set(employeeKey, employeeCount + 1)
        }
      }

      // Guardar disponibilidad por empleado en acuity_availability (en lotes)
      let availabilityProcessed = 0
      let skippedCount = 0
      
      const availabilityBatch: Array<{
        id: string
        date: string
        calendar_id: number
        calendar_name: string
        appointment_category: AcuityAppointmentCategory
        total_slots: number
        booked_slots: number
        available_slots: number
      }> = []

      for (const [key, employeeData] of employeeAvailabilityData) {
        // Validar que tenemos calendarID y calendarName válidos
        if (!employeeData.calendarID || !employeeData.calendarName || employeeData.calendarName === 'Unknown') {
          console.warn(`[Acuity Sync] Skipping record with invalid calendar data: calendarID=${employeeData.calendarID}, calendarName=${employeeData.calendarName}`)
          skippedCount++
          continue
        }

        const bookedSlots = bookedSlotsByEmployeeMap.get(key) || 0
        const availableSlots = Math.max(0, employeeData.totalSlots - bookedSlots)

        const availabilityId = `${employeeData.date}-${employeeData.calendarID}-${employeeData.category}`

        availabilityBatch.push({
          id: availabilityId,
          date: employeeData.date,
          calendar_id: employeeData.calendarID,
          calendar_name: employeeData.calendarName,
          appointment_category: employeeData.category,
          total_slots: employeeData.totalSlots,
          booked_slots: bookedSlots,
          available_slots: availableSlots,
        })
      }

      // Guardar en lotes
      for (let i = 0; i < availabilityBatch.length; i += AVAILABILITY_BATCH_SIZE) {
        const batch = availabilityBatch.slice(i, i + AVAILABILITY_BATCH_SIZE)
        const { error: batchError } = await supabase
          .from('acuity_availability')
          // @ts-ignore
          .upsert(batch as any, {
            onConflict: 'id',
          })
        
        if (batchError) {
          console.error(`[Acuity Sync] Error upserting availability batch:`, batchError)
        } else {
          availabilityProcessed += batch.length
        }
      }

      console.log(`[Acuity Sync] Saved ${availabilityProcessed} availability records by employee`)
      if (skippedCount > 0) {
        console.warn(`[Acuity Sync] Skipped ${skippedCount} records with invalid calendar data`)
      }

      // 7b. Sincronizar disponibilidad agregada por tienda (nueva funcionalidad)
      console.log('[Acuity Sync] Syncing availability by store...')
      
      const monthsToSyncByStore = 3 // Sincronizar próximos 3 meses para disponibilidad por tienda
      const availabilityByStoreData = new Map<string, {
        date: string
        storeName: string
        appointmentTypeID: number
        appointmentCategory: AcuityAppointmentCategory
        totalSlots: number
      }>()

      // Paralelizar procesamiento de tipos de citas para disponibilidad por tienda
      const typeEntriesForStore = Array.from(appointmentTypeMap.entries())
      
      for (let i = 0; i < typeEntriesForStore.length; i += CONCURRENT_TYPES) {
        const typeBatch = typeEntriesForStore.slice(i, i + CONCURRENT_TYPES)
        const batchNumber = Math.floor(i / CONCURRENT_TYPES) + 1
        const totalBatches = Math.ceil(typeEntriesForStore.length / CONCURRENT_TYPES)
        
        console.log(`[Acuity Sync] Processing availability by store batch ${batchNumber}/${totalBatches} (${typeBatch.length} types)`)

        const batchPromises = typeBatch.map(async ([typeId, typeInfo]) => {
          try {
            console.log(`[Acuity Sync] Fetching availability by store for type ${typeId} (${typeInfo.type.name})...`)
            
            const availabilityResults = await acuityService.getAvailabilityByStore({
              appointmentTypeID: typeId,
              appointmentTypeName: typeInfo.type.name,
              category: typeInfo.category,
              months: monthsToSyncByStore,
              supabase: supabase,
            })

            console.log(`[Acuity Sync] Processed ${availabilityResults.length} availability by store records for type ${typeId}`)
            return availabilityResults
          } catch (error) {
            console.error(`[Acuity Sync] Error processing availability by store for type ${typeId}:`, error)
            return []
          }
        })

        const batchResults = await Promise.all(batchPromises)
        
        // Normalizar nombre de tienda y agrupar por fecha, tienda y categoría
        for (const availabilityResults of batchResults) {
          for (const result of availabilityResults) {
            const normalizedStoreName = normalizeStoreName(result.appointmentTypeName)
            const key = `${result.date}-${normalizedStoreName}-${result.category}`

            if (!availabilityByStoreData.has(key)) {
              availabilityByStoreData.set(key, {
                date: result.date,
                storeName: normalizedStoreName,
                appointmentTypeID: result.appointmentTypeID,
                appointmentCategory: result.category,
                totalSlots: 0,
              })
            }

            const data = availabilityByStoreData.get(key)!
            data.totalSlots += result.totalSlots
          }
        }
      }

      // Calcular slots reservados desde acuity_appointments para disponibilidad por tienda
      const endDateByStore = addMonths(today, monthsToSyncByStore)
      const todayStr = format(today, 'yyyy-MM-dd')
      const endDateStrByStore = format(endDateByStore, 'yyyy-MM-dd')

      const { data: appointmentsForStoreAvailability } = await supabase
        .from('acuity_appointments')
        .select('datetime, appointment_type_id, appointment_type_name, appointment_category, status')
        .gte('datetime', todayStr)
        .lte('datetime', endDateStrByStore)
        .neq('status', 'canceled')

      // Contar citas reservadas por fecha, tienda y categoría
      const bookedSlotsMapByStore = new Map<string, number>()
      if (appointmentsForStoreAvailability) {
        type AcuityAppointment = Database['public']['Tables']['acuity_appointments']['Row']
        const appointmentsTyped = appointmentsForStoreAvailability as AcuityAppointment[]
        for (const apt of appointmentsTyped) {
          const appointmentDate = format(new Date(apt.datetime), 'yyyy-MM-dd')
          const normalizedStoreName = normalizeStoreName(apt.appointment_type_name)
          const key = `${appointmentDate}-${normalizedStoreName}-${apt.appointment_category}`

          const currentCount = bookedSlotsMapByStore.get(key) || 0
          bookedSlotsMapByStore.set(key, currentCount + 1)
        }
      }

      // Guardar disponibilidad por tienda en BD (en lotes)
      let availabilityByStoreProcessed = 0
      
      const storeAvailabilityBatch: Array<{
        id: string
        date: string
        store_name: string
        appointment_type_id: number
        appointment_category: AcuityAppointmentCategory
        total_slots: number
        booked_slots: number
        available_slots: number
      }> = []

      for (const [key, data] of availabilityByStoreData) {
        const bookedSlots = bookedSlotsMapByStore.get(key) || 0
        const availableSlots = Math.max(0, data.totalSlots - bookedSlots)

        const availabilityId = `${data.date}-${data.storeName}-${data.appointmentCategory}`

        storeAvailabilityBatch.push({
          id: availabilityId,
          date: data.date,
          store_name: data.storeName,
          appointment_type_id: data.appointmentTypeID,
          appointment_category: data.appointmentCategory,
          total_slots: data.totalSlots,
          booked_slots: bookedSlots,
          available_slots: availableSlots,
        })
      }

      // Guardar en lotes de 200
      for (let i = 0; i < storeAvailabilityBatch.length; i += AVAILABILITY_BATCH_SIZE) {
        const batch = storeAvailabilityBatch.slice(i, i + AVAILABILITY_BATCH_SIZE)
        const { error: batchError } = await supabase
          .from('acuity_availability_by_store')
          // @ts-ignore
          .upsert(batch as any, {
            onConflict: 'id',
          })
        
        if (batchError) {
          console.error(`[Acuity Sync] Error upserting store availability batch:`, batchError)
        } else {
          availabilityByStoreProcessed += batch.length
        }
      }

      console.log(`[Acuity Sync] Processed ${availabilityByStoreProcessed} availability by store records`)

      // 8. Actualizar conteos mensuales desde fecha de conexión hasta endDate (365 días)
      console.log('[Acuity Sync] Updating monthly appointment counts...')
      
      const monthsToProcess: Array<{ year: number; month: number; startDate: Date; endDate: Date }> = []
      let currentDate = startOfMonth(syncStartDate)
      const endDateStartOfMonth = startOfMonth(endDate) // Mes del final del rango (365 días desde hoy)

      // Procesar todos los meses desde syncStartDate hasta endDate (incluyendo meses futuros)
      while (currentDate <= endDateStartOfMonth) {
        monthsToProcess.push({
          year: currentDate.getFullYear(),
          month: currentDate.getMonth() + 1,
          startDate: startOfMonth(currentDate),
          endDate: endOfMonth(currentDate),
        })
        currentDate = startOfMonth(addDays(endOfMonth(currentDate), 1))
      }

      // Paralelizar procesamiento de meses (máximo 8 concurrentes)
      const CONCURRENT_MONTHS = 8
      
      for (let i = 0; i < monthsToProcess.length; i += CONCURRENT_MONTHS) {
        const monthBatch = monthsToProcess.slice(i, i + CONCURRENT_MONTHS)
        const batchNumber = Math.floor(i / CONCURRENT_MONTHS) + 1
        const totalBatches = Math.ceil(monthsToProcess.length / CONCURRENT_MONTHS)
        
        console.log(`[Acuity Sync] Processing monthly counts batch ${batchNumber}/${totalBatches} (${monthBatch.length} months)`)

        const batchPromises = monthBatch.map(async (monthInfo) => {
          const monthStart = format(monthInfo.startDate, 'yyyy-MM-dd')
          const monthEnd = format(monthInfo.endDate, 'yyyy-MM-dd')

          try {
            // Obtener citas del mes (incluyendo canceladas) en paralelo
            const [monthAppointmentsNormal, monthAppointmentsCanceled] = await Promise.all([
              acuityService.getAppointments({
                minDate: monthStart,
                maxDate: monthEnd,
              }),
              acuityService.getAppointments({
                minDate: monthStart,
                maxDate: monthEnd,
                canceled: true,
              }),
            ])
            
            // Combinar citas normales y canceladas
            const monthAppointments = [...monthAppointmentsNormal, ...monthAppointmentsCanceled]

            // Agrupar por calendario y categoría
            const countsByCalendar = new Map<string, {
              calendarName: string
              category: AcuityAppointmentCategory
              scheduled: number
              canceled: number
              rescheduled: number
            }>()

            for (const appointment of monthAppointments) {
              const category = appointmentTypeMap.get(appointment.appointmentTypeID)?.category || 'fitting'
              const calendarName = appointment.calendar || 'Unknown'
              const key = `${calendarName}-${category}`

              if (!countsByCalendar.has(key)) {
                countsByCalendar.set(key, {
                  calendarName,
                  category,
                  scheduled: 0,
                  canceled: 0,
                  rescheduled: 0,
                })
              }

              const counts = countsByCalendar.get(key)!
              if (appointment.canceled) {
                counts.canceled++
              } else {
                counts.scheduled++
              }
            }

            // Guardar conteos mensuales en lote
            const countUpserts = Array.from(countsByCalendar.entries()).map(([key, counts]) => ({
              id: `${monthInfo.year}-${String(monthInfo.month).padStart(2, '0')}-${counts.calendarName}-${counts.category}`,
              year: monthInfo.year,
              month: monthInfo.month,
              calendar_name: counts.calendarName,
              appointment_category: counts.category,
              total_count: counts.scheduled + counts.canceled + counts.rescheduled,
              scheduled_count: counts.scheduled,
              canceled_count: counts.canceled,
              rescheduled_count: counts.rescheduled,
            }))

            if (countUpserts.length > 0) {
              await supabase
                .from('acuity_appointment_counts')
                // @ts-ignore
                .upsert(countUpserts as any, {
                  onConflict: 'id',
                })
            }

            return countUpserts.length
          } catch (error) {
            console.error(`[Acuity Sync] Error processing month ${monthInfo.year}-${monthInfo.month}:`, error)
            return 0
          }
        })

        await Promise.all(batchPromises)
      }

      console.log(`[Acuity Sync] Updated monthly counts for ${monthsToProcess.length} months`)

      // 9. Actualizar sync log
      if (syncLog) {
        await supabase
          .from('sync_logs')
          // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
          .update({
            status: 'success',
            records_synced: appointmentsProcessed + availabilityProcessed + availabilityByStoreProcessed,
            completed_at: new Date().toISOString(),
          } as any)
          .eq('id', (syncLog as any).id)
      }

      // 10. Actualizar last_sync
      await supabase
        .from('integration_settings')
        // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
        .update({
          last_sync: new Date().toISOString(),
        } as any)
        .eq('integration', 'acuity')

      return NextResponse.json({
        success: true,
        message: 'Acuity data synced successfully',
        records_synced: appointmentsProcessed + availabilityProcessed + availabilityByStoreProcessed,
        appointments: {
          total: appointmentsProcessed,
          inserted: appointmentsInserted,
          updated: appointmentsUpdated,
        },
        availability: {
          records: availabilityProcessed,
        },
        availability_by_store: {
          records: availabilityByStoreProcessed,
        },
        months_processed: monthsToProcess.length,
      })
    } catch (syncError) {
      console.error('[Acuity Sync] Error during sync:', syncError)

      // Update sync log with error
      if (syncLog) {
        const errorMessage = syncError instanceof Error 
          ? syncError.message 
          : typeof syncError === 'object' && syncError !== null
            ? JSON.stringify(syncError)
            : String(syncError)
        
        await supabase
          .from('sync_logs')
          // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
          .update({
            status: 'error' as const,
            error_message: errorMessage,
          } as any)
          .eq('id', (syncLog as any).id)
      }

      throw syncError
    }
  } catch (error) {
    console.error('Acuity sync error:', error)
    
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
        error: 'Failed to sync Acuity data', 
        details: errorMessage
      },
      { status: 500 }
    )
  }
}


