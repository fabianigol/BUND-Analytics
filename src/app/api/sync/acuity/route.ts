import { NextRequest, NextResponse } from 'next/server'
import { AcuityService, createAcuityServiceFromSupabase, AcuityAppointmentCategory, normalizeStoreName } from '@/lib/integrations/acuity'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { format, addDays, startOfMonth, endOfMonth, subMonths, parseISO, addMonths } from 'date-fns'

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

      // 6. Guardar citas en BD
      let appointmentsProcessed = 0
      let appointmentsUpdated = 0
      let appointmentsInserted = 0

      for (const appointment of allAppointments) {
        const typeInfo = appointmentTypeMap.get(appointment.appointmentTypeID)
        const category = typeInfo?.category || 'fitting'

        // Determinar estado
        let status: 'scheduled' | 'canceled' | 'rescheduled' = 'scheduled'
        if (appointment.canceled) {
          status = 'canceled'
        }

        // Log formato de fecha para debug (solo primeras 3 citas)
        if (appointmentsProcessed < 3) {
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

        // Validar que datetime existe y es válido
        if (!appointment.datetime || typeof appointment.datetime !== 'string') {
          console.error(`[Acuity Sync] Invalid datetime for appointment ${appointment.id}:`, appointment.datetime)
          continue // Saltar esta cita si no tiene datetime válido
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
          continue // Saltar esta cita si el datetime no es válido
        }
        
        // Construir end_time completo desde datetime y endTime
        // Acuity devuelve endTime como solo hora (HH:MM), necesitamos combinarlo con datetime
        let endTimeComplete = datetimeISO // Por defecto usar datetime si no hay endTime
        
        if (appointment.endTime && typeof appointment.endTime === 'string') {
          try {
            // Parsear datetime para obtener la fecha base (usar el ya normalizado)
            const startDate = new Date(datetimeISO)
            if (isNaN(startDate.getTime())) {
              throw new Error('Invalid datetime')
            }
            
            // Parsear endTime (formato HH:MM o HH:MM:SS)
            const timeMatch = appointment.endTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
            if (timeMatch) {
              const hours = parseInt(timeMatch[1], 10)
              const minutes = parseInt(timeMatch[2], 10)
              
              // Crear nueva fecha con la misma fecha base pero con la hora de endTime
              // Usar los métodos de fecha local para mantener el timezone original
              const endDate = new Date(startDate)
              endDate.setHours(hours, minutes, 0, 0)
              
              // Convertir a ISO string (esto convertirá a UTC, que es lo que PostgreSQL espera)
              endTimeComplete = endDate.toISOString()
            } else {
              // Si no coincide el formato HH:MM, intentar parsearlo como fecha completa ISO
              const parsedEndTime = new Date(appointment.endTime)
              if (!isNaN(parsedEndTime.getTime())) {
                endTimeComplete = parsedEndTime.toISOString()
              } else {
                console.warn(`[Acuity Sync] Could not parse endTime "${appointment.endTime}" for appointment ${appointment.id}, using datetime`)
                endTimeComplete = datetimeISO
              }
            }
          } catch (error) {
            console.error(`[Acuity Sync] Error constructing end_time for appointment ${appointment.id}:`, error)
            // Si falla, usar datetime como fallback
            endTimeComplete = datetimeISO
          }
        } else {
          console.warn(`[Acuity Sync] No endTime for appointment ${appointment.id}, using datetime as end_time`)
        }

        const appointmentData: Database['public']['Tables']['acuity_appointments']['Insert'] = {
          acuity_id: appointment.id,
          calendar_id: appointment.calendarID,
          calendar_name: appointment.calendar || 'Unknown',
          appointment_type_id: appointment.appointmentTypeID,
          appointment_type_name: appointment.type,
          appointment_category: category,
          datetime: datetimeISO, // ISO 8601 string normalizado
          end_time: endTimeComplete, // Fecha/hora completa construida desde datetime + endTime
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

        // Check if appointment already exists
        const { data: existing } = await supabase
          .from('acuity_appointments')
          .select('id')
          .eq('acuity_id', appointment.id)
          .single()

        if (existing) {
          const { error: updateError } = await supabase
            .from('acuity_appointments')
            // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
            .update(appointmentData as any)
            .eq('acuity_id', appointment.id)
          
          if (updateError) {
            console.error(`[Acuity Sync] Error updating appointment ${appointment.id}:`, updateError)
          } else {
            appointmentsUpdated++
          }
        } else {
          const { error: insertError } = await supabase
            .from('acuity_appointments')
            // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
            .insert(appointmentData as any)
          
          if (insertError) {
            console.error(`[Acuity Sync] Error inserting appointment ${appointment.id}:`, insertError)
            console.error(`[Acuity Sync] Appointment data:`, JSON.stringify(appointmentData, null, 2))
          } else {
            appointmentsInserted++
          }
        }
        appointmentsProcessed++
      }

      console.log(`[Acuity Sync] Processed ${appointmentsProcessed} appointments: ${appointmentsInserted} inserted, ${appointmentsUpdated} updated`)

      // 7. Obtener disponibilidad próximos 365 días
      console.log('[Acuity Sync] Fetching availability for next 365 days...')
      
      // Obtener disponibilidad por tipo de cita
      const availabilityData = new Map<string, { date: string; calendarName: string; category: AcuityAppointmentCategory; slots: number }>()

      for (const typeInfo of appointmentTypeMap.values()) {
        try {
          // IMPORTANTE: Acuity limita las consultas a 21 días (configuración de "máximo de días")
          const maxDays = 21
          const endDateForAvailability = addDays(today, maxDays)
          let currentDate = new Date(today)
          currentDate.setHours(0, 0, 0, 0)
          
          while (currentDate <= endDateForAvailability) {
            const dateStr = format(currentDate, 'yyyy-MM-dd')
            
            const availability = await acuityService.getAvailability({
              date: dateStr,
              appointmentTypeID: typeInfo.type.id,
              maxDays: maxDays,
            })

            // La respuesta es un array directo de AcuityTimeSlot
            const totalSlots = availability.reduce((sum, slot) => sum + slot.slotsAvailable, 0)
            
            console.log(`[Acuity Sync] Availability response for type ${typeInfo.type.id} from ${dateStr}:`, {
              slotsCount: availability.length,
              totalSlots: totalSlots,
            })

            // Procesar cada slot de disponibilidad
            for (const slot of availability) {
              // Extraer fecha del campo time (formato ISO: "2026-02-04T09:00:00-0500")
              const slotDate = new Date(slot.time)
              const slotDateStr = format(slotDate, 'yyyy-MM-dd')
              const calendarName = slot.calendar || 'Unknown'
              
              const key = `${slotDateStr}-${calendarName}-${typeInfo.category}`
              const existing = availabilityData.get(key)
              
              if (existing) {
                existing.slots += slot.slotsAvailable
              } else {
                availabilityData.set(key, {
                  date: slotDateStr,
                  calendarName: calendarName,
                  category: typeInfo.category,
                  slots: slot.slotsAvailable,
                })
              }
            }
            
            // Avanzar al siguiente día
            currentDate.setDate(currentDate.getDate() + 1)
          }
        } catch (error) {
          console.error(`[Acuity Sync] Error fetching availability for type ${typeInfo.type.id}:`, error)
        }
      }

      // Guardar disponibilidad en BD
      let availabilityProcessed = 0
      for (const [key, data] of availabilityData) {
        // Contar citas reservadas para esta fecha/calendario/categoría
        const bookedCount = allAppointments.filter(a => {
          // Validar que datetime existe y es válido antes de parsearlo
          if (!a.datetime || typeof a.datetime !== 'string') {
            return false
          }
          
          try {
            const appointmentDate = format(parseISO(a.datetime), 'yyyy-MM-dd')
            const appointmentCategory = appointmentTypeMap.get(a.appointmentTypeID)?.category
            return appointmentDate === data.date && 
                   (a.calendar || '').toLowerCase() === data.calendarName.toLowerCase() &&
                   appointmentCategory === data.category &&
                   !a.canceled
          } catch (error) {
            console.error(`[Acuity Sync] Error parsing datetime for appointment ${a.id}:`, a.datetime, error)
            return false
          }
        }).length

        const availabilityId = `${data.date}-${data.calendarName}-${data.category}`

        await supabase
          .from('acuity_availability')
          .upsert({
            id: availabilityId,
            date: data.date,
            calendar_name: data.calendarName,
            appointment_category: data.category,
            total_slots: data.slots + bookedCount,
            available_slots: Math.max(0, data.slots),
            booked_slots: bookedCount,
          } as any, {
            onConflict: 'id',
          })
        availabilityProcessed++
      }

      console.log(`[Acuity Sync] Processed ${availabilityProcessed} availability records`)

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

      for (const [typeId, typeInfo] of appointmentTypeMap) {
        try {
          console.log(`[Acuity Sync] Fetching availability by store for type ${typeId} (${typeInfo.type.name})...`)
          
          const availabilityResults = await acuityService.getAvailabilityByStore({
            appointmentTypeID: typeId,
            appointmentTypeName: typeInfo.type.name,
            category: typeInfo.category,
            months: monthsToSyncByStore,
            supabase: supabase,
          })

          // Normalizar nombre de tienda y agrupar por fecha, tienda y categoría
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

          console.log(`[Acuity Sync] Processed ${availabilityResults.length} availability by store records for type ${typeId}`)
        } catch (error) {
          console.error(`[Acuity Sync] Error processing availability by store for type ${typeId}:`, error)
          // Continuar con el siguiente tipo
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

      // Guardar disponibilidad por tienda en BD
      let availabilityByStoreProcessed = 0
      for (const [key, data] of availabilityByStoreData) {
        const bookedSlots = bookedSlotsMapByStore.get(key) || 0
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

        availabilityByStoreProcessed++
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

      for (const monthInfo of monthsToProcess) {
        const monthStart = format(monthInfo.startDate, 'yyyy-MM-dd')
        const monthEnd = format(monthInfo.endDate, 'yyyy-MM-dd')

        // Obtener citas del mes (incluyendo canceladas)
        const monthAppointmentsNormal = await acuityService.getAppointments({
          minDate: monthStart,
          maxDate: monthEnd,
        })
        
        // Obtener citas canceladas del mes
        const monthAppointmentsCanceled = await acuityService.getAppointments({
          minDate: monthStart,
          maxDate: monthEnd,
          canceled: true,
        })
        
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
          // Nota: Acuity puede no tener un campo explícito de "rescheduled", 
          // podría requerir lógica adicional para detectarlo
        }

        // Guardar conteos mensuales
        for (const [key, counts] of countsByCalendar) {
          const countId = `${monthInfo.year}-${String(monthInfo.month).padStart(2, '0')}-${counts.calendarName}-${counts.category}`

          await supabase
            .from('acuity_appointment_counts')
            .upsert({
              id: countId,
              year: monthInfo.year,
              month: monthInfo.month,
              calendar_name: counts.calendarName,
              appointment_category: counts.category,
              total_count: counts.scheduled + counts.canceled + counts.rescheduled,
              scheduled_count: counts.scheduled,
              canceled_count: counts.canceled,
              rescheduled_count: counts.rescheduled,
            } as any, {
              onConflict: 'id',
            })
        }
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


