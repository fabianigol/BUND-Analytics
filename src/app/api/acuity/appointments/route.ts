import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeStoreName } from '@/lib/integrations/acuity'
import { parseISO, format } from 'date-fns'

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
    const store = searchParams.get('store')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Si se proporcionan ambas fechas, usarlas exactamente como están (para comparativas)
    // Si no, incluir rango amplio (1 año hacia atrás y 1 año hacia adelante)
    let startDateStr: string
    let endDateStr: string
    
    if (startDate && endDate) {
      // Modo exacto: usar las fechas proporcionadas sin modificar
      startDateStr = parseISO(startDate).toISOString()
      endDateStr = parseISO(endDate).toISOString()
    } else {
      // Modo amplio: rango de 1 año atrás a 1 año adelante
      const todayStart = startDate ? parseISO(startDate) : new Date()
      
      if (startDate && !endDate) {
        // Solo startDate: desde 1 año atrás hasta 1 año adelante
        const pastDate = new Date(todayStart)
        pastDate.setFullYear(pastDate.getFullYear() - 1)
        startDateStr = pastDate.toISOString()
        
        const futureDate = new Date(todayStart)
        futureDate.setFullYear(futureDate.getFullYear() + 1)
        endDateStr = futureDate.toISOString()
      } else if (!startDate && endDate) {
        // Solo endDate: desde 1 año atrás del endDate hasta endDate
        const endParsed = parseISO(endDate)
        const pastDate = new Date(endParsed)
        pastDate.setFullYear(pastDate.getFullYear() - 1)
        startDateStr = pastDate.toISOString()
        endDateStr = endParsed.toISOString()
      } else {
        // Sin fechas: últimos 12 meses
        const now = new Date()
        const pastDate = new Date(now)
        pastDate.setFullYear(pastDate.getFullYear() - 1)
        startDateStr = pastDate.toISOString()
        endDateStr = now.toISOString()
      }
    }

    let query = supabase
      .from('acuity_appointments')
      .select('datetime, appointment_type_name, appointment_category, status')
      .gte('datetime', startDateStr)
      .lte('datetime', endDateStr)

    const { data: appointments, error } = await query

    if (error) {
      console.error('[Acuity Appointments] Error fetching appointments:', error)
      throw error
    }

    // Filtrar por tienda si se proporciona
    let filteredAppointments = (appointments || []) as Array<{
      datetime: string
      appointment_type_name: string
      appointment_category: string
      status: string
    }>
    
    console.log(`[Acuity Appointments] Total appointments before filtering: ${filteredAppointments.length}`)
    
    if (store) {
      const normalizedStore = normalizeStoreName(store)
      console.log(`[Acuity Appointments] Filtering by store: "${store}" (normalized: "${normalizedStore}")`)
      
      // Obtener todos los nombres únicos de tiendas para debugging
      const uniqueStores = [...new Set(filteredAppointments.map(apt => apt.appointment_type_name))]
      console.log(`[Acuity Appointments] Unique store names in data:`, uniqueStores.slice(0, 5))
      
      const beforeFilter = filteredAppointments.length
      filteredAppointments = filteredAppointments.filter(apt => {
        const aptStoreNormalized = normalizeStoreName(apt.appointment_type_name || '')
        return aptStoreNormalized === normalizedStore
      })
      
      console.log(`[Acuity Appointments] Filtered appointments: ${beforeFilter} -> ${filteredAppointments.length}`)
    }

    return NextResponse.json({
      appointments: filteredAppointments,
      count: filteredAppointments.length,
    })
  } catch (error) {
    console.error('[Acuity Appointments] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

