import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addDays, format, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns'
import { Database } from '@/types/database'

type AcuityAppointment = Database['public']['Tables']['acuity_appointments']['Row']
type AcuityAvailability = Database['public']['Tables']['acuity_availability']['Row']
type AcuityCount = Database['public']['Tables']['acuity_appointment_counts']['Row']

/**
 * Normaliza el nombre de una tienda eliminando variaciones y sufijos.
 * Ejemplos:
 * - "The Bundclub Madrid + Añadir 1 persona más" → "The Bundclub Madrid"
 * - "- The Bundclub Valencia -" → "The Bundclub Valencia"
 * - "The Bundclub Madrid + Solo quiero informarme" → "The Bundclub Madrid"
 */
function normalizeStoreName(storeName: string): string {
  if (!storeName || storeName === 'Unknown') return storeName
  
  let normalized = storeName.trim()
  
  // Eliminar guiones al inicio y final
  normalized = normalized.replace(/^-\s*/, '').replace(/\s*-$/, '')
  
  // Eliminar todo después de "+" (incluye variaciones como "+ Añadir X persona(s) más", "+ Solo quiero informarme", etc.)
  const plusIndex = normalized.indexOf('+')
  if (plusIndex !== -1) {
    normalized = normalized.substring(0, plusIndex).trim()
  }
  
  return normalized.trim() || storeName // Fallback al nombre original si queda vacío
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User not authenticated' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'upcoming'
    const days = parseInt(searchParams.get('days') || '21', 10)
    const category = searchParams.get('category') as 'medición' | 'fitting' | null // null = all
    const calendar = searchParams.get('calendar') // nombre de tienda
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : null
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : null
    const customStartDate = searchParams.get('startDate') // YYYY-MM-DD
    const customEndDate = searchParams.get('endDate') // YYYY-MM-DD

    // Crear fecha de inicio del día - usar fecha local pero normalizada
    // Si hay fechas personalizadas, usarlas; sino usar las fechas por defecto
    const today = new Date()
    let queryStartDate = today
    let queryEndDate: Date | null = null
    
    if (customStartDate) {
      queryStartDate = parseISO(customStartDate)
    }
    
    if (customEndDate) {
      queryEndDate = parseISO(customEndDate)
    }
    
    const todayStart = new Date(queryStartDate.getFullYear(), queryStartDate.getMonth(), queryStartDate.getDate(), 0, 0, 0, 0)
    const startDateStr = todayStart.toISOString()
    
    // Para el rango extendido de citas futuras (1 año desde hoy o hasta customEndDate)
    let futureEndDate: Date
    if (queryEndDate) {
      futureEndDate = new Date(queryEndDate.getFullYear(), queryEndDate.getMonth(), queryEndDate.getDate(), 23, 59, 59, 999)
    } else {
      futureEndDate = addDays(todayStart, 365)
      futureEndDate.setHours(23, 59, 59, 999)
    }
    const futureEndDateStr = futureEndDate.toISOString()
    
    // Para el rango normal (21 días) - no se usa actualmente pero lo dejamos por compatibilidad
    const endDate = queryEndDate ? futureEndDate : addDays(todayStart, days)
    endDate.setHours(23, 59, 59, 999)
    const endDateStr = endDate.toISOString()
    
    // Fechas solo para campos DATE (sin hora)
    const startDateStrOnly = format(todayStart, 'yyyy-MM-dd')
    const endDateStrOnly = queryEndDate ? format(queryEndDate, 'yyyy-MM-dd') : format(addDays(todayStart, days), 'yyyy-MM-dd')
    const futureEndDateStrOnly = queryEndDate ? format(queryEndDate, 'yyyy-MM-dd') : format(addDays(todayStart, 365), 'yyyy-MM-dd')

    console.log(`[Acuity Stats] Query params:`, {
      type,
      days,
      startDateStr,
      endDateStr,
      futureEndDateStr,
      startDateStrOnly,
      endDateStrOnly,
      futureEndDateStrOnly,
      category,
      calendar,
      todayISO: today.toISOString(),
      todayStartISO: todayStart.toISOString(),
    })

    switch (type) {
      case 'upcoming': {
        // Citas reservadas próximos N días
        // IMPORTANTE: Si hay fechas personalizadas (customStartDate/customEndDate), usarlas
        // Si hay year/month, filtrar por ese mes específico
        // Si no, usar las fechas por defecto (desde hoy hasta 1 año)
        
        let dateStart = startDateStr
        let dateEnd = futureEndDateStr
        
        // Si se proporciona año y mes, filtrar por ese mes específico
        if (year && month) {
          const monthStart = new Date(year, month - 1, 1)
          const monthEnd = new Date(year, month, 0, 23, 59, 59, 999)
          dateStart = monthStart.toISOString()
          dateEnd = monthEnd.toISOString()
        }
        
        let query = supabase
          .from('acuity_appointments')
          .select('*')
          .gte('datetime', dateStart)
          .lte('datetime', dateEnd)
          .neq('status', 'canceled') // Incluir scheduled y rescheduled, excluir solo canceladas

        if (category) {
          query = query.eq('appointment_category', category)
        }
        if (calendar) {
          query = query.eq('calendar_name', calendar)
        }

        const { data: appointments, error } = await query

        if (error) {
          console.error('[Acuity Stats] Error fetching upcoming appointments:', error)
          throw error
        }

        const appointmentsTyped = (appointments || []) as AcuityAppointment[]

        console.log(`[Acuity Stats] Found ${appointmentsTyped.length} upcoming appointments`)
        if (appointmentsTyped.length > 0) {
          console.log(`[Acuity Stats] Sample appointment:`, {
            id: appointmentsTyped[0].acuity_id,
            datetime: appointmentsTyped[0].datetime,
            status: appointmentsTyped[0].status,
            category: appointmentsTyped[0].appointment_category,
            calendar: appointmentsTyped[0].calendar_name,
          })
        } else {
          // Si no hay citas, verificar si hay citas en la BD sin el filtro de fecha
          console.log(`[Acuity Stats] No appointments found with filters. Debugging...`)
          
          // Consulta sin filtros para ver qué hay en la BD
          const { count: totalCount, data: allAppts } = await supabase
            .from('acuity_appointments')
            .select('acuity_id, datetime, status, appointment_category, calendar_name', { count: 'exact' })
            .order('datetime', { ascending: true })
            .limit(10)
          
          console.log(`[Acuity Stats] Total appointments in DB (no filters): ${totalCount}`)
          console.log(`[Acuity Stats] Query that returned 0 results:`, {
            table: 'acuity_appointments',
            filters: {
              datetime_gte: startDateStr,
              datetime_lte: futureEndDateStr,
              status_neq: 'canceled',
              category,
              calendar,
            }
          })
          
          if (allAppts && allAppts.length > 0) {
            const allApptsTyped = allAppts as Partial<AcuityAppointment>[]
            console.log(`[Acuity Stats] Sample appointments from DB (first 10):`, allApptsTyped.map(apt => ({
              id: apt.acuity_id,
              datetime: apt.datetime,
              datetimeISO: apt.datetime ? new Date(apt.datetime).toISOString() : null,
              status: apt.status,
              category: apt.appointment_category,
              calendar: apt.calendar_name,
            })))
            
            // Verificar rango de fechas
            const earliestDate = allApptsTyped[0]?.datetime
            const latestDate = allApptsTyped[allApptsTyped.length - 1]?.datetime
            console.log(`[Acuity Stats] Date range in DB vs query:`, {
              earliestInDB: earliestDate,
              latestInDB: latestDate,
              queryStart: startDateStr,
              queryEnd: futureEndDateStr,
              queryStartDate: new Date(startDateStr).toISOString(),
              queryEndDate: new Date(futureEndDateStr).toISOString(),
              comparison: {
                earliestIsAfterQueryStart: earliestDate ? new Date(earliestDate) >= new Date(startDateStr) : null,
                earliestIsBeforeQueryEnd: earliestDate ? new Date(earliestDate) <= new Date(futureEndDateStr) : null,
              }
            })
          } else {
            console.log(`[Acuity Stats] No appointments found in DB at all`)
          }
        }

        // Agrupar por tienda y categoría
        const byCalendar = new Map<string, {
          calendarName: string
          medición: number
          fitting: number
          total: number
        }>()

        // Agrupar por tienda (appointment_type_name) con empleados anidados
        const byStore = new Map<string, {
          storeName: string
          medición: number
          fitting: number
          total: number
          employees: Map<string, {
            employeeName: string
            medición: number
            fitting: number
            total: number
          }>
        }>()

        const byCategory = {
          medición: 0,
          fitting: 0,
          total: 0,
        }

        for (const apt of appointmentsTyped) {
          const cat = apt.appointment_category as 'medición' | 'fitting'
          byCategory[cat]++
          byCategory.total++

          // Agrupación por empleado (calendar_name) - mantener para compatibilidad
          const calName = apt.calendar_name || 'Unknown'
          if (!byCalendar.has(calName)) {
            byCalendar.set(calName, {
              calendarName: calName,
              medición: 0,
              fitting: 0,
              total: 0,
            })
          }

          const calData = byCalendar.get(calName)!
          calData[cat]++
          calData.total++

          // Agrupación por tienda (appointment_type_name) con empleados
          // Normalizar el nombre de la tienda para agrupar variaciones
          const originalStoreName = apt.appointment_type_name || 'Unknown'
          const normalizedStoreName = normalizeStoreName(originalStoreName)
          
          if (!byStore.has(normalizedStoreName)) {
            byStore.set(normalizedStoreName, {
              storeName: normalizedStoreName,
              medición: 0,
              fitting: 0,
              total: 0,
              employees: new Map(),
            })
          }

          const storeData = byStore.get(normalizedStoreName)!
          storeData[cat]++
          storeData.total++

          // Agregar empleado dentro de la tienda
          if (!storeData.employees.has(calName)) {
            storeData.employees.set(calName, {
              employeeName: calName,
              medición: 0,
              fitting: 0,
              total: 0,
            })
          }

          const employeeData = storeData.employees.get(calName)!
          employeeData[cat]++
          employeeData.total++
        }

        // Convertir Map de empleados a Array, ordenar empleados por total descendente, y ordenar tiendas por total descendente
        const byStoreArray = Array.from(byStore.values())
          .map(store => ({
            storeName: store.storeName,
            medición: store.medición,
            fitting: store.fitting,
            total: store.total,
            employees: Array.from(store.employees.values())
              .sort((a, b) => b.total - a.total), // Ordenar empleados por total descendente
          }))
          .sort((a, b) => b.total - a.total) // Ordenar tiendas por total descendente

        return NextResponse.json({
          type: 'upcoming',
          days,
          total: byCategory.total,
          byCategory: {
            medición: byCategory.medición,
            fitting: byCategory.fitting,
          },
          byCalendar: Array.from(byCalendar.values()),
          byStore: byStoreArray,
          filtered: {
            category,
            calendar,
          },
        })
      }

      case 'availability': {
        // Citas disponibles próximos N días
        // Para campos DATE usamos formato YYYY-MM-DD
        // Extender rango a 1 año para incluir todas las fechas futuras
        // futureEndDateStrOnly ya está calculado arriba
        
        let query = supabase
          .from('acuity_availability')
          .select('*')
          .gte('date', startDateStrOnly)
          .lte('date', futureEndDateStrOnly)

        if (category) {
          query = query.eq('appointment_category', category)
        }
        if (calendar) {
          query = query.eq('calendar_name', calendar)
        }

        const { data: availability, error } = await query

        if (error) throw error

        const availabilityTyped = (availability || []) as AcuityAvailability[]

        // Obtener mapeo de calendar_name -> appointment_type_name desde acuity_calendars
        const { data: calendarsData } = await supabase
          .from('acuity_calendars')
          .select('name, appointment_type_name, appointment_category')
        
        const calendarToStoreMap = new Map<string, string>()
        if (calendarsData) {
          for (const cal of calendarsData as Array<{ name: string; appointment_type_name: string; appointment_category: string }>) {
            // Mapear por nombre de calendario (empleado) a tienda normalizada
            // Puede haber múltiples entradas por empleado (medición y fitting), usar la primera encontrada
            if (!calendarToStoreMap.has(cal.name)) {
              const normalizedStoreName = normalizeStoreName(cal.appointment_type_name)
              calendarToStoreMap.set(cal.name, normalizedStoreName)
            }
          }
        }

        // Agregar por categoría y calendario
        const byCategory = {
          medición: { total: 0, available: 0, booked: 0 },
          fitting: { total: 0, available: 0, booked: 0 },
        }

        const byCalendar = new Map<string, {
          calendarName: string
          medición: { total: number; available: number; booked: number }
          fitting: { total: number; available: number; booked: number }
        }>()

        // Agrupar por tienda (appointment_type_name) con empleados anidados
        const byStore = new Map<string, {
          storeName: string
          medición: { total: number; available: number; booked: number }
          fitting: { total: number; available: number; booked: number }
          employees: Map<string, {
            employeeName: string
            medición: { total: number; available: number; booked: number }
            fitting: { total: number; available: number; booked: number }
          }>
        }>()

        for (const avail of availabilityTyped) {
          const cat = avail.appointment_category as 'medición' | 'fitting'
          byCategory[cat].total += avail.total_slots || 0
          byCategory[cat].available += avail.available_slots || 0
          byCategory[cat].booked += avail.booked_slots || 0

          const calName = avail.calendar_name || 'Unknown'
          
          // Agrupación por empleado (calendar_name) - mantener para compatibilidad
          if (!byCalendar.has(calName)) {
            byCalendar.set(calName, {
              calendarName: calName,
              medición: { total: 0, available: 0, booked: 0 },
              fitting: { total: 0, available: 0, booked: 0 },
            })
          }

          const calData = byCalendar.get(calName)!
          calData[cat].total += avail.total_slots || 0
          calData[cat].available += avail.available_slots || 0
          calData[cat].booked += avail.booked_slots || 0

          // Agrupación por tienda usando el mapeo
          const storeName = calendarToStoreMap.get(calName) || 'Unknown'
          if (!byStore.has(storeName)) {
            byStore.set(storeName, {
              storeName,
              medición: { total: 0, available: 0, booked: 0 },
              fitting: { total: 0, available: 0, booked: 0 },
              employees: new Map(),
            })
          }

          const storeData = byStore.get(storeName)!
          storeData[cat].total += avail.total_slots || 0
          storeData[cat].available += avail.available_slots || 0
          storeData[cat].booked += avail.booked_slots || 0

          // Agregar empleado dentro de la tienda
          if (!storeData.employees.has(calName)) {
            storeData.employees.set(calName, {
              employeeName: calName,
              medición: { total: 0, available: 0, booked: 0 },
              fitting: { total: 0, available: 0, booked: 0 },
            })
          }

          const employeeData = storeData.employees.get(calName)!
          employeeData[cat].total += avail.total_slots || 0
          employeeData[cat].available += avail.available_slots || 0
          employeeData[cat].booked += avail.booked_slots || 0
        }

        // Convertir Map de empleados a Array, ordenar empleados por total descendente, y ordenar tiendas por total descendente
        const byStoreArray = Array.from(byStore.values())
          .map(store => ({
            storeName: store.storeName,
            medición: store.medición,
            fitting: store.fitting,
            employees: Array.from(store.employees.values())
              .sort((a, b) => (b.medición.total + b.fitting.total) - (a.medición.total + a.fitting.total)), // Ordenar empleados por total descendente
          }))
          .sort((a, b) => (b.medición.total + b.fitting.total) - (a.medición.total + a.fitting.total)) // Ordenar tiendas por total descendente

        return NextResponse.json({
          type: 'availability',
          days,
          byCategory,
          byCalendar: Array.from(byCalendar.values()),
          byStore: byStoreArray,
          filtered: {
            category,
            calendar,
          },
        })
      }

      case 'occupation': {
        // Porcentaje de ocupación
        // Para ocupación también necesitamos extender el rango
        // Usamos futureEndDateStr que ya está calculado arriba
        
        let appointmentsQuery = supabase
          .from('acuity_appointments')
          .select('*')
          .gte('datetime', startDateStr)
          .lte('datetime', futureEndDateStr)
          .neq('status', 'canceled') // Incluir scheduled y rescheduled

        if (category) {
          appointmentsQuery = appointmentsQuery.eq('appointment_category', category)
        }
        if (calendar) {
          appointmentsQuery = appointmentsQuery.eq('calendar_name', calendar)
        }

        // Extender rango para ocupación también
        const futureEndDateOnly = format(addDays(today, 365), 'yyyy-MM-dd')
        
        let availabilityQueryForOccupation = supabase
          .from('acuity_availability')
          .select('*')
          .gte('date', startDateStrOnly)
          .lte('date', futureEndDateStrOnly)

        if (category) {
          availabilityQueryForOccupation = availabilityQueryForOccupation.eq('appointment_category', category)
        }
        if (calendar) {
          availabilityQueryForOccupation = availabilityQueryForOccupation.eq('calendar_name', calendar)
        }

        const [{ data: appointments }, { data: availability }] = await Promise.all([
          appointmentsQuery,
          availabilityQueryForOccupation,
        ])

        if (!appointments) {
          console.log('[Acuity Stats] No appointments found for occupation calculation')
        }
        if (!availability) {
          console.log('[Acuity Stats] No availability found for occupation calculation')
        }

        const appointmentsTyped = (appointments || []) as AcuityAppointment[]
        const availabilityTyped = (availability || []) as AcuityAvailability[]

        // Obtener mapeo de calendar_name -> appointment_type_name desde acuity_calendars
        const { data: calendarsData } = await supabase
          .from('acuity_calendars')
          .select('name, appointment_type_name, appointment_category')
        
        const calendarToStoreMap = new Map<string, string>()
        if (calendarsData) {
          for (const cal of calendarsData as Array<{ name: string; appointment_type_name: string; appointment_category: string }>) {
            // Mapear por nombre de calendario (empleado) a tienda normalizada
            if (!calendarToStoreMap.has(cal.name)) {
              const normalizedStoreName = normalizeStoreName(cal.appointment_type_name)
              calendarToStoreMap.set(cal.name, normalizedStoreName)
            }
          }
        }

        // Calcular ocupación
        const byCategory = {
          medición: { booked: 0, total: 0, percentage: 0 },
          fitting: { booked: 0, total: 0, percentage: 0 },
          overall: { booked: 0, total: 0, percentage: 0 },
        }

        for (const avail of availabilityTyped) {
          const cat = avail.appointment_category as 'medición' | 'fitting'
          byCategory[cat].booked += avail.booked_slots || 0
          byCategory[cat].total += avail.total_slots || 0
          byCategory.overall.booked += avail.booked_slots || 0
          byCategory.overall.total += avail.total_slots || 0
        }

        // Calcular porcentajes
        for (const key of ['medición', 'fitting', 'overall'] as const) {
          if (byCategory[key].total > 0) {
            byCategory[key].percentage = Math.round((byCategory[key].booked / byCategory[key].total) * 100)
          }
        }

        // Por calendario (empleado) - mantener para compatibilidad
        const byCalendar = new Map<string, {
          calendarName: string
          medición: { booked: number; total: number; percentage: number }
          fitting: { booked: number; total: number; percentage: number }
          overall: { booked: number; total: number; percentage: number }
        }>()

        // Por tienda con empleados anidados
        const byStore = new Map<string, {
          storeName: string
          medición: { booked: number; total: number; percentage: number }
          fitting: { booked: number; total: number; percentage: number }
          overall: { booked: number; total: number; percentage: number }
          employees: Map<string, {
            employeeName: string
            medición: { booked: number; total: number; percentage: number }
            fitting: { booked: number; total: number; percentage: number }
            overall: { booked: number; total: number; percentage: number }
          }>
        }>()

        for (const avail of availabilityTyped) {
          const calName = avail.calendar_name || 'Unknown'
          const cat = avail.appointment_category as 'medición' | 'fitting'
          
          // Agrupación por empleado (calendar_name) - mantener para compatibilidad
          if (!byCalendar.has(calName)) {
            byCalendar.set(calName, {
              calendarName: calName,
              medición: { booked: 0, total: 0, percentage: 0 },
              fitting: { booked: 0, total: 0, percentage: 0 },
              overall: { booked: 0, total: 0, percentage: 0 },
            })
          }

          const calData = byCalendar.get(calName)!
          calData[cat].booked += avail.booked_slots || 0
          calData[cat].total += avail.total_slots || 0
          calData.overall.booked += avail.booked_slots || 0
          calData.overall.total += avail.total_slots || 0

          // Agrupación por tienda usando el mapeo
          const storeName = calendarToStoreMap.get(calName) || 'Unknown'
          if (!byStore.has(storeName)) {
            byStore.set(storeName, {
              storeName,
              medición: { booked: 0, total: 0, percentage: 0 },
              fitting: { booked: 0, total: 0, percentage: 0 },
              overall: { booked: 0, total: 0, percentage: 0 },
              employees: new Map(),
            })
          }

          const storeData = byStore.get(storeName)!
          storeData[cat].booked += avail.booked_slots || 0
          storeData[cat].total += avail.total_slots || 0
          storeData.overall.booked += avail.booked_slots || 0
          storeData.overall.total += avail.total_slots || 0

          // Agregar empleado dentro de la tienda
          if (!storeData.employees.has(calName)) {
            storeData.employees.set(calName, {
              employeeName: calName,
              medición: { booked: 0, total: 0, percentage: 0 },
              fitting: { booked: 0, total: 0, percentage: 0 },
              overall: { booked: 0, total: 0, percentage: 0 },
            })
          }

          const employeeData = storeData.employees.get(calName)!
          employeeData[cat].booked += avail.booked_slots || 0
          employeeData[cat].total += avail.total_slots || 0
          employeeData.overall.booked += avail.booked_slots || 0
          employeeData.overall.total += avail.total_slots || 0
        }

        // Calcular porcentajes por calendario (empleado)
        for (const calData of byCalendar.values()) {
          for (const key of ['medición', 'fitting', 'overall'] as const) {
            if (calData[key].total > 0) {
              calData[key].percentage = Math.round((calData[key].booked / calData[key].total) * 100)
            }
          }
        }

        // Calcular porcentajes por tienda y empleados
        for (const storeData of byStore.values()) {
          for (const key of ['medición', 'fitting', 'overall'] as const) {
            if (storeData[key].total > 0) {
              storeData[key].percentage = Math.round((storeData[key].booked / storeData[key].total) * 100)
            }
          }
          
          for (const employeeData of storeData.employees.values()) {
            for (const key of ['medición', 'fitting', 'overall'] as const) {
              if (employeeData[key].total > 0) {
                employeeData[key].percentage = Math.round((employeeData[key].booked / employeeData[key].total) * 100)
              }
            }
          }
        }

        // Convertir Map de empleados a Array, ordenar empleados por total descendente, y ordenar tiendas por total descendente
        const byStoreArray = Array.from(byStore.values())
          .map(store => ({
            storeName: store.storeName,
            medición: store.medición,
            fitting: store.fitting,
            overall: store.overall,
            employees: Array.from(store.employees.values())
              .sort((a, b) => b.overall.total - a.overall.total), // Ordenar empleados por total descendente
          }))
          .sort((a, b) => b.overall.total - a.overall.total) // Ordenar tiendas por total descendente

        return NextResponse.json({
          type: 'occupation',
          days,
          byCategory,
          byCalendar: Array.from(byCalendar.values()),
          byStore: byStoreArray,
          filtered: {
            category,
            calendar,
          },
        })
      }

      case 'monthly': {
        // Histórico mensual
        const months = parseInt(searchParams.get('months') || '12', 10)
        const startMonth = startOfMonth(subMonths(today, months - 1))

        let query = supabase
          .from('acuity_appointment_counts')
          .select('*')
          .gte('year', startMonth.getFullYear())
          .order('year', { ascending: true })
          .order('month', { ascending: true })

        if (category) {
          query = query.eq('appointment_category', category)
        }
        if (calendar) {
          query = query.eq('calendar_name', calendar)
        }

        const { data: counts, error } = await query

        if (error) throw error

        const countsTyped = (counts || []) as AcuityCount[]

        // Agrupar por mes y categoría
        const byMonth = new Map<string, {
          year: number
          month: number
          medición: number
          fitting: number
          total: number
        }>()

        for (const count of countsTyped) {
          const monthKey = `${count.year}-${String(count.month).padStart(2, '0')}`
          if (!byMonth.has(monthKey)) {
            byMonth.set(monthKey, {
              year: count.year,
              month: count.month,
              medición: 0,
              fitting: 0,
              total: 0,
            })
          }

          const monthData = byMonth.get(monthKey)!
          const cat = count.appointment_category as 'medición' | 'fitting'
          monthData[cat] += count.total_count || 0
          monthData.total += count.total_count || 0
        }

        return NextResponse.json({
          type: 'monthly',
          months,
          byMonth: Array.from(byMonth.values()).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year
            return a.month - b.month
          }),
          filtered: {
            category,
            calendar,
          },
        })
      }

      case 'cancellations': {
        // Citas canceladas y reagendadas
        // Si hay fechas personalizadas, usarlas; sino usar el mes actual
        let cancellationsStartDate: Date
        let cancellationsEndDate: Date
        
        if (customStartDate && customEndDate) {
          // Usar el rango personalizado
          cancellationsStartDate = new Date(parseISO(customStartDate))
          cancellationsEndDate = new Date(parseISO(customEndDate))
        } else {
          // Usar el mes actual por defecto
          cancellationsStartDate = startOfMonth(today)
          cancellationsEndDate = endOfMonth(today)
        }
        
        // Normalizar fechas (inicio del día inicio, final del día final)
        const cancellationsStart = new Date(cancellationsStartDate.getFullYear(), cancellationsStartDate.getMonth(), cancellationsStartDate.getDate(), 0, 0, 0, 0)
        const cancellationsEnd = new Date(cancellationsEndDate.getFullYear(), cancellationsEndDate.getMonth(), cancellationsEndDate.getDate(), 23, 59, 59, 999)
        
        const cancellationsStartStr = cancellationsStart.toISOString()
        const cancellationsEndStr = cancellationsEnd.toISOString()

        let query = supabase
          .from('acuity_appointments')
          .select('*')
          .gte('datetime', cancellationsStartStr)
          .lte('datetime', cancellationsEndStr)
          .in('status', ['canceled', 'rescheduled'])

        if (category) {
          query = query.eq('appointment_category', category)
        }
        if (calendar) {
          query = query.eq('calendar_name', calendar)
        }

        const { data: cancellations, error } = await query

        if (error) {
          console.error('[Acuity Stats] Error fetching cancellations:', error)
          throw error
        }

        const cancellationsTyped = (cancellations || []) as AcuityAppointment[]

        console.log(`[Acuity Stats] Found ${cancellationsTyped.length} cancellations`)

        const byCategory = {
          medición: { canceled: 0, rescheduled: 0 },
          fitting: { canceled: 0, rescheduled: 0 },
          total: { canceled: 0, rescheduled: 0 },
        }

        for (const cancel of cancellationsTyped) {
          const cat = cancel.appointment_category as 'medición' | 'fitting'
          if (cancel.status === 'canceled') {
            byCategory[cat].canceled++
            byCategory.total.canceled++
          } else if (cancel.status === 'rescheduled') {
            byCategory[cat].rescheduled++
            byCategory.total.rescheduled++
          }
        }

        return NextResponse.json({
          type: 'cancellations',
          period: customStartDate && customEndDate ? 'custom' : 'this_month',
          startDate: format(cancellationsStart, 'yyyy-MM-dd'),
          endDate: format(cancellationsEnd, 'yyyy-MM-dd'),
          byCategory,
          filtered: {
            category,
            calendar,
          },
        })
      }

      case 'daily': {
        // Datos diarios para un mes específico
        if (!year || !month) {
          return NextResponse.json(
            { error: 'year and month parameters are required for daily type' },
            { status: 400 }
          )
        }

        const monthStart = startOfMonth(new Date(year, month - 1, 1))
        const monthEnd = endOfMonth(monthStart)
        const monthStartStr = monthStart.toISOString()
        monthEnd.setHours(23, 59, 59, 999)
        const monthEndStr = monthEnd.toISOString()

        let query = supabase
          .from('acuity_appointments')
          .select('datetime, appointment_category, status')
          .gte('datetime', monthStartStr)
          .lte('datetime', monthEndStr)

        if (category) {
          query = query.eq('appointment_category', category)
        }
        if (calendar) {
          query = query.eq('calendar_name', calendar)
        }

        const { data: appointments, error } = await query

        if (error) throw error

        const appointmentsTyped = (appointments || []) as Array<{
          datetime: string
          appointment_category: 'medición' | 'fitting'
          status: 'scheduled' | 'canceled' | 'rescheduled'
        }>

        // Agrupar por día
        const byDay = new Map<number, {
          day: number
          medición: number
          fitting: number
          total: number
          canceled: number
        }>()

        // Inicializar todos los días del mes
        const daysInMonth = monthEnd.getDate()
        for (let day = 1; day <= daysInMonth; day++) {
          byDay.set(day, { day, medición: 0, fitting: 0, total: 0, canceled: 0 })
        }

        // Contar citas por día (incluyendo canceladas)
        for (const appointment of appointmentsTyped) {
          const appointmentDate = new Date(appointment.datetime)
          const day = appointmentDate.getDate()
          const dayData = byDay.get(day)

          if (dayData) {
            if (appointment.status === 'canceled') {
              // Las canceladas se cuentan en un campo separado
              dayData.canceled = (dayData.canceled || 0) + 1
            } else {
              // Scheduled y rescheduled se cuentan normalmente
              dayData[appointment.appointment_category]++
              dayData.total++
            }
          }
        }

        const dailyData = Array.from(byDay.values())
          .map(d => ({
            name: String(d.day),
            'Medición': d.medición,
            'Fitting': d.fitting,
            'Total': d.total,
            'Canceladas': d.canceled || 0,
          }))

        return NextResponse.json({
          type: 'daily',
          year,
          month,
          byDay: dailyData,
          filtered: {
            category,
            calendar,
          },
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter. Valid types: upcoming, availability, occupation, monthly, cancellations, daily' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error fetching Acuity stats:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch Acuity stats', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

