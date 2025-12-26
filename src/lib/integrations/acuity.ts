import { format } from 'date-fns'
import { SupabaseClient } from '@supabase/supabase-js'

const ACUITY_API_URL = 'https://acuityscheduling.com/api/v1'

export type AcuityAppointmentCategory = 'medición' | 'fitting'

interface AcuityConfig {
  userId: string
  apiKey: string
}

export interface AcuityAppointment {
  id: number
  calendarID: number
  appointmentTypeID: number
  calendar: string
  type: string
  datetime: string
  endTime: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  canceled: boolean
  canClientCancel: boolean
  confirmationPage: string
  timezone: string
  price?: string
  paid?: string
  amountPaid?: string
  coupon?: string
  notes?: string
  fields?: Array<{ id: number; value: string }>
}

export interface AcuityCalendar {
  id: number
  name: string
  email: string
  timezone: string
  appointmentCounts?: {
    today?: number
    tomorrow?: number
    thisWeek?: number
    thisMonth?: number
  }
}

export interface AcuityAppointmentType {
  id: number
  name: string
  category: string
  description?: string
  duration: number
  price?: string
  color?: string
  calendarIDs?: number[]
  schedulingLink?: string
  categoryID?: number
  categoryName?: string
}

export interface AcuityAvailability {
  dates: Array<{
    date: string
    slots: Array<{
      time: string
      calendarID: number
      calendar: string
    }>
  }>
}

export interface AvailabilityByStoreResult {
  date: string
  appointmentTypeID: number
  appointmentTypeName: string
  category: AcuityAppointmentCategory
  totalSlots: number
}

/**
 * Normaliza el nombre de una tienda eliminando variaciones y sufijos.
 * Ejemplos:
 * - "The Bundclub Madrid + Añadir 1 persona más" → "The Bundclub Madrid"
 * - "- The Bundclub Valencia -" → "The Bundclub Valencia"
 * - "The Bundclub Madrid + Solo quiero informarme" → "The Bundclub Madrid"
 */
export function normalizeStoreName(storeName: string): string {
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

export class AcuityService {
  private userId: string
  private apiKey: string
  private authHeader: string

  constructor(config: AcuityConfig) {
    this.userId = config.userId
    this.apiKey = config.apiKey
    // Basic Auth: base64(userId:apiKey)
    this.authHeader = `Basic ${Buffer.from(`${config.userId}:${config.apiKey}`).toString('base64')}`
  }

  private async request<T>(endpoint: string, params?: Record<string, string | number>): Promise<T> {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
    }

    const url = `${ACUITY_API_URL}${endpoint}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    console.log(`[Acuity API] Requesting: ${endpoint}`)

    const response = await fetch(url, {
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      let errorMessage = response.statusText
      try {
        const error = await response.json()
        errorMessage = error.message || error.error || JSON.stringify(error)
        console.error(`[Acuity API] Error response:`, error)
      } catch (e) {
        const text = await response.text()
        errorMessage = text || response.statusText
        console.error(`[Acuity API] Error text:`, text)
      }
      throw new Error(`Acuity API error: ${errorMessage} (Status: ${response.status})`)
    }

    return response.json()
  }

  /**
   * Identifica si un tipo de cita es "medición" o "fitting"
   * Usa múltiples métodos para identificar la categoría
   */
  identifyCategory(appointmentType: AcuityAppointmentType, schedulingLink?: string): AcuityAppointmentCategory {
    // Método 1: Por URL del scheduling link
    if (schedulingLink) {
      const link = schedulingLink.toLowerCase()
      if (link.includes('medicion-') || link.includes('medición-')) {
        return 'medición'
      }
      if (link.includes('fitting-')) {
        return 'fitting'
      }
    }

    // Método 2: Por nombre del tipo de cita
    const typeName = appointmentType.name?.toLowerCase() || ''
    if (typeName.includes('medición') || typeName.includes('medicion') || typeName.includes('medida')) {
      return 'medición'
    }
    if (typeName.includes('fitting') || typeName.includes('prueba') || typeName.includes('probador')) {
      return 'fitting'
    }

    // Método 3: Por categoría del tipo de cita
    const categoryName = appointmentType.categoryName?.toLowerCase() || appointmentType.category?.toLowerCase() || ''
    if (categoryName.includes('medición') || categoryName.includes('medicion') || categoryName === 'medición') {
      return 'medición'
    }
    if (categoryName.includes('fitting') || categoryName === 'fitting') {
      return 'fitting'
    }

    // Fallback: intentar detectar por palabras clave comunes
    const allText = `${typeName} ${categoryName}`.toLowerCase()
    if (allText.includes('medición') || allText.includes('medicion') || allText.includes('medida')) {
      return 'medición'
    }
    
    // Por defecto, si no se puede identificar, asumir 'fitting'
    // (puedes ajustar esto según tu caso de uso)
    console.warn(`[Acuity] No se pudo identificar categoría para tipo: ${appointmentType.name}. Usando 'fitting' por defecto.`)
    return 'fitting'
  }

  /**
   * Obtiene todos los calendarios
   */
  async getCalendars(): Promise<AcuityCalendar[]> {
    return this.request<AcuityCalendar[]>('/calendars')
  }

  /**
   * Obtiene todos los tipos de citas
   */
  async getAppointmentTypes(): Promise<AcuityAppointmentType[]> {
    const types = await this.request<AcuityAppointmentType[]>('/appointment-types')
    
    // Obtener scheduling links para cada tipo
    // Nota: La API puede no devolver los links directamente, 
    // pero los podemos construir o obtener de otra forma
    return types
  }

  /**
   * Función auxiliar recursiva para obtener citas con subdivisión automática cuando se alcanza el límite de 100
   */
  private async fetchAppointmentsWithSubdivision(
    startDate: Date,
    endDate: Date,
    params: {
      calendarID?: number
      appointmentTypeID?: number
      canceled?: boolean
    },
    depth: number = 0
  ): Promise<AcuityAppointment[]> {
    const MAX_DEPTH = 3 // mes → semana → día
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]
    
    // Calcular días de diferencia
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    
    // Si el rango es de 1 día o menos, hacer petición directa sin subdivisión
    if (daysDiff <= 1 || depth >= MAX_DEPTH) {
      const queryParams: Record<string, string | number> = {
        minDate: startDateStr,
        maxDate: endDateStr,
      }
      
      if (params.calendarID) {
        queryParams.calendarID = params.calendarID
      }
      if (params.appointmentTypeID) {
        queryParams.appointmentTypeID = params.appointmentTypeID
      }
      if (params.canceled !== undefined) {
        queryParams.canceled = params.canceled ? 1 : 0
      }

      try {
        const appointments = await this.request<AcuityAppointment[]>('/appointments', queryParams)
        const depthIndicator = '  '.repeat(depth)
        console.log(`${depthIndicator}[Acuity API] Fetched ${appointments.length} appointments for ${startDateStr} to ${endDateStr} (depth: ${depth})`)
        return appointments
      } catch (error) {
        console.error(`[Acuity API] Error fetching appointments for ${startDateStr} to ${endDateStr}:`, error)
        return []
      }
    }

    // Hacer petición inicial
    const queryParams: Record<string, string | number> = {
      minDate: startDateStr,
      maxDate: endDateStr,
    }
    
    if (params.calendarID) {
      queryParams.calendarID = params.calendarID
    }
    if (params.appointmentTypeID) {
      queryParams.appointmentTypeID = params.appointmentTypeID
    }
    if (params.canceled !== undefined) {
      queryParams.canceled = params.canceled ? 1 : 0
    }

    try {
      const appointments = await this.request<AcuityAppointment[]>('/appointments', queryParams)
      const depthIndicator = '  '.repeat(depth)
      console.log(`${depthIndicator}[Acuity API] Fetched ${appointments.length} appointments for ${startDateStr} to ${endDateStr} (depth: ${depth}, days: ${daysDiff})`)
      
      // Si obtenemos menos de 100, no necesitamos subdividir
      if (appointments.length < 100) {
        return appointments
      }
      
      // Si obtenemos >= 100, necesitamos subdividir
      console.warn(`${depthIndicator}[Acuity API] Got ${appointments.length} appointments (>= 100), subdividing range ${startDateStr} to ${endDateStr} (depth: ${depth})`)
      
      // Subdividir según la profundidad
      let subdivisions: Array<{ start: Date; end: Date }> = []
      
      if (depth === 0) {
        // Nivel 0: subdividir mes en semanas (~7 días cada una)
        let currentStart = new Date(startDate)
        while (currentStart <= endDate) {
          const weekEnd = new Date(currentStart)
          weekEnd.setDate(weekEnd.getDate() + 6) // 7 días incluyendo el día inicial
          
          const adjustedEnd = weekEnd > endDate ? endDate : weekEnd
          subdivisions.push({ start: new Date(currentStart), end: new Date(adjustedEnd) })
          
          currentStart = new Date(adjustedEnd)
          currentStart.setDate(currentStart.getDate() + 1) // Siguiente día después del final
        }
        console.log(`${depthIndicator}[Acuity API] Subdividing into ${subdivisions.length} weeks`)
      } else if (depth === 1) {
        // Nivel 1: subdividir semana en días
        let currentStart = new Date(startDate)
        while (currentStart <= endDate) {
          const dayEnd = new Date(currentStart)
          dayEnd.setHours(23, 59, 59, 999)
          
          const adjustedEnd = dayEnd > endDate ? endDate : dayEnd
          subdivisions.push({ start: new Date(currentStart), end: new Date(adjustedEnd) })
          
          currentStart = new Date(adjustedEnd)
          currentStart.setDate(currentStart.getDate() + 1)
          currentStart.setHours(0, 0, 0, 0)
        }
        console.log(`${depthIndicator}[Acuity API] Subdividing into ${subdivisions.length} days`)
      } else {
        // Nivel 2+: ya estamos en días, devolver lo que obtuvimos
        return appointments
      }
      
      // Hacer peticiones recursivas en paralelo
      const subdivisionResults = await Promise.all(
        subdivisions.map(sub => 
          this.fetchAppointmentsWithSubdivision(sub.start, sub.end, params, depth + 1)
        )
      )
      
      // Combinar todos los resultados
      const allSubdividedAppointments = subdivisionResults.flat()
      
      // Eliminar duplicados por ID
      const uniqueAppointments = new Map<number, AcuityAppointment>()
      for (const appointment of allSubdividedAppointments) {
        if (!uniqueAppointments.has(appointment.id)) {
          uniqueAppointments.set(appointment.id, appointment)
        }
      }
      
      const uniqueCount = uniqueAppointments.size
      console.log(`${depthIndicator}[Acuity API] After subdivision: ${uniqueCount} unique appointments (originally got ${appointments.length} before subdivision)`)
      
      return Array.from(uniqueAppointments.values())
    } catch (error) {
      console.error(`[Acuity API] Error fetching appointments for ${startDateStr} to ${endDateStr}:`, error)
      return []
    }
  }

  /**
   * Obtiene una lista de citas con filtros opcionales
   * Implementa paginación dividiendo el rango de fechas en meses y subdividiendo automáticamente cuando se detectan >= 100 citas
   */
  async getAppointments(params?: {
    minDate?: string // YYYY-MM-DD
    maxDate?: string // YYYY-MM-DD
    calendarID?: number
    appointmentTypeID?: number
    canceled?: boolean
  }): Promise<AcuityAppointment[]> {
    const allAppointments: AcuityAppointment[] = []
    
    // Si hay un rango de fechas, dividirlo en meses primero
    if (params?.minDate && params?.maxDate) {
      const startDate = new Date(params.minDate)
      const endDate = new Date(params.maxDate)
      
      // Dividir el rango en meses
      let currentMonthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
      
      while (currentMonthStart <= endDate) {
        // Calcular el final del mes actual
        const currentMonthEnd = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 0)
        
        // Ajustar para no exceder el maxDate
        const monthStart = currentMonthStart > startDate ? currentMonthStart : startDate
        const monthEnd = currentMonthEnd < endDate ? currentMonthEnd : endDate
        
        // Usar la función recursiva que maneja la subdivisión automática
        const monthAppointments = await this.fetchAppointmentsWithSubdivision(
          monthStart,
          monthEnd,
          {
            calendarID: params.calendarID,
            appointmentTypeID: params.appointmentTypeID,
            canceled: params.canceled,
          },
          0 // Empezar en profundidad 0 (nivel de mes)
        )
        
        allAppointments.push(...monthAppointments)
        
        // Avanzar al siguiente mes
        currentMonthStart = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 1)
      }
      
      // Eliminar duplicados por ID (por si acaso)
      const uniqueAppointments = new Map<number, AcuityAppointment>()
      for (const appointment of allAppointments) {
        if (!uniqueAppointments.has(appointment.id)) {
          uniqueAppointments.set(appointment.id, appointment)
        }
      }
      
      console.log(`[Acuity API] Total unique appointments fetched: ${uniqueAppointments.size}`)
      return Array.from(uniqueAppointments.values())
    } else {
      // Si no hay rango de fechas, hacer una petición normal
      const queryParams: Record<string, string | number> = {}
      
      if (params?.minDate) {
        queryParams.minDate = params.minDate
      }
      if (params?.maxDate) {
        queryParams.maxDate = params.maxDate
      }
      if (params?.calendarID) {
        queryParams.calendarID = params.calendarID
      }
      if (params?.appointmentTypeID) {
        queryParams.appointmentTypeID = params.appointmentTypeID
      }
      if (params?.canceled !== undefined) {
        queryParams.canceled = params.canceled ? 1 : 0
      }

      return this.request<AcuityAppointment[]>('/appointments', queryParams)
    }
  }

  /**
   * Obtiene una cita específica por ID
   */
  async getAppointment(appointmentId: number): Promise<AcuityAppointment> {
    return this.request<AcuityAppointment>(`/appointments/${appointmentId}`)
  }

  /**
   * Obtiene disponibilidad (horarios disponibles)
   * Según documentación oficial: /availability/times solo acepta date (YYYY-MM-DD), appointmentTypeID, y opcionalmente calendarID
   */
  async getAvailability(params: {
    date: string // YYYY-MM-DD (obligatorio)
    appointmentTypeID: number // Obligatorio
    calendarID?: number // Opcional
  }): Promise<AcuityAvailability> {
    const queryParams: Record<string, string | number> = {
      date: params.date,
      appointmentTypeID: params.appointmentTypeID,
    }
    
    if (params.calendarID) {
      queryParams.calendarID = params.calendarID
    }

    return this.request<AcuityAvailability>('/availability/times', queryParams)
  }

  /**
   * Obtiene fechas disponibles
   */
  async getAvailableDates(params: {
    appointmentTypeID?: number
    calendarID?: number
    month?: string // YYYY-MM
    days?: number
  }): Promise<Array<{ date: string }>> {
    const queryParams: Record<string, string | number> = {}
    
    if (params.appointmentTypeID) {
      queryParams.appointmentTypeID = params.appointmentTypeID
    }
    if (params.calendarID) {
      queryParams.calendarID = params.calendarID
    }
    if (params.month) {
      queryParams.month = params.month
    }
    if (params.days) {
      queryParams.days = params.days
    }

    return this.request<Array<{ date: string }>>('/availability/dates', queryParams)
  }

  /**
   * Helper function para hacer delay entre llamadas (rate limiting)
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Obtiene disponibilidad agregada por tienda
   * Llama a la API para cada calendarID (empleado) individualmente y agrega los resultados
   */
  async getAvailabilityByStore(params: {
    appointmentTypeID: number
    appointmentTypeName: string
    category: AcuityAppointmentCategory
    months: number // Número de meses a consultar desde hoy
    supabase: SupabaseClient // Supabase client para consultar calendarios
  }): Promise<AvailabilityByStoreResult[]> {
    const results: AvailabilityByStoreResult[] = []
    const today = new Date()
    
    // Obtener calendarios (empleados) asociados a este tipo de cita
    const { data: calendars, error: calendarsError } = await params.supabase
      .from('acuity_calendars')
      .select('acuity_calendar_id, name, appointment_type_name')
      .eq('appointment_type_id', params.appointmentTypeID)
      .eq('is_active', true)

    if (calendarsError) {
      console.error(`[Acuity API] Error fetching calendars for appointment type ${params.appointmentTypeID}:`, calendarsError)
      return []
    }

    if (!calendars || calendars.length === 0) {
      console.log(`[Acuity API] No calendars found for appointment type ${params.appointmentTypeID}`)
      return []
    }

    console.log(`[Acuity API] Found ${calendars.length} calendars for appointment type ${params.appointmentTypeID}`)
    
    // Para cada mes en el rango
    for (let i = 0; i < params.months; i++) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1)
      const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
      
      // Calcular primer día y último día del mes
      const firstDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
      const lastDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
      
      // OPTIMIZACIÓN 1: Obtener fechas UNA VEZ por mes/tipo (SIN calendarID - resuelve 0 resultados)
      await this.sleep(200)
      const availableDates = await this.getAvailableDates({
        month: monthStr,
        appointmentTypeID: params.appointmentTypeID,
        // NO pasar calendarID - esto resuelve el problema de 0 resultados
      })

      if (!availableDates || availableDates.length === 0) {
        continue // No hay fechas disponibles este mes
      }

      // Filtrar fechas dentro del mes
      const datesInMonth = availableDates
        .map(d => d.date)
        .filter(dateStr => {
          const dateObj = new Date(dateStr + 'T00:00:00')
          return dateObj >= firstDayOfMonth && dateObj <= lastDayOfMonth
        })

      // Crear un Set de calendarIDs válidos para filtrar después
      const validCalendarIDs = new Set(
        calendars
          .map(c => c.acuity_calendar_id)
          .filter((id): id is number => id !== null && id !== undefined)
      )

      // OPTIMIZACIÓN 2: Procesar fechas en paralelo (SIN iterar por calendarios)
      // Llamar /availability/times SIN calendarID para obtener TODOS los slots
      // Luego filtrar por calendarID usando el campo de cada slot
      const BATCH_SIZE = 5
      const dateBatches: string[][] = []
      for (let j = 0; j < datesInMonth.length; j += BATCH_SIZE) {
        dateBatches.push(datesInMonth.slice(j, j + BATCH_SIZE))
      }

      for (const dateBatch of dateBatches) {
        try {
          // Procesar lote de fechas en paralelo
          const batchPromises = dateBatch.map(async (date) => {
            await this.sleep(100) // Rate limiting reducido
            
            // NO pasar calendarID - obtener TODOS los slots de TODOS los empleados
            const availability = await this.getAvailability({
              date: date,
              appointmentTypeID: params.appointmentTypeID,
              // calendarID omitido - esto permite obtener slots de todos los empleados
            })

            if (!availability.dates || availability.dates.length === 0) {
              return { date, slotsCount: 0 }
            }

            // Cada fecha solo tiene un objeto con todos los slots
            const slots = availability.dates[0]?.slots || []
            
            // Filtrar slots que pertenecen a calendarios de esta tienda
            const validSlots = slots.filter(slot => 
              validCalendarIDs.has(slot.calendarID)
            )

            return { date, slotsCount: validSlots.length }
          })

          const batchResults = await Promise.all(batchPromises)
          
          // Agregar resultados por fecha
          for (const { date, slotsCount } of batchResults) {
            if (slotsCount > 0) {
              const existingResult = results.find(r => r.date === date && r.appointmentTypeID === params.appointmentTypeID)
              
              if (existingResult) {
                existingResult.totalSlots += slotsCount
              } else {
                results.push({
                  date,
                  appointmentTypeID: params.appointmentTypeID,
                  appointmentTypeName: params.appointmentTypeName,
                  category: params.category,
                  totalSlots: slotsCount,
                })
              }
            }
          }
        } catch (error) {
          console.error(`[Acuity API] Error fetching availability for dates batch:`, error)
        }
      }
    }

    console.log(`[Acuity API] Processed ${results.length} availability records for type ${params.appointmentTypeID}`)
    return results
  }
}

/**
 * Factory function para crear AcuityService desde credenciales en Supabase
 */
export async function createAcuityServiceFromSupabase(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
): Promise<AcuityService | null> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('settings, connected')
    .eq('integration', 'acuity')
    .single()

  if (error || !data || !(data as any).connected) {
    console.log('[Acuity] Integration not connected')
    return null
  }

  const settings = (data as any).settings as {
    user_id?: string
    api_key?: string
  }

  if (!settings?.user_id || !settings?.api_key) {
    console.error('[Acuity] Missing credentials in settings')
    return null
  }

  return new AcuityService({
    userId: settings.user_id,
    apiKey: settings.api_key,
  })
}

