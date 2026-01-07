import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/calendar/events
 * Obtiene eventos de calendario filtrados por año, capas y rango de fechas
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Obtener parámetros de consulta
    const year = searchParams.get('year')
    const layers = searchParams.get('layers')?.split(',')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Construir query base
    let query = supabase
      .from('calendar_events')
      .select('*')
      .order('start_date', { ascending: true })

    // Filtrar por año si se proporciona
    if (year) {
      const yearInt = parseInt(year)
      query = query
        .gte('start_date', `${yearInt}-01-01`)
        .lte('end_date', `${yearInt}-12-31`)
    }

    // Filtrar por rango de fechas si se proporciona
    if (startDate && endDate) {
      query = query
        .gte('end_date', startDate)
        .lte('start_date', endDate)
    }

    // Filtrar por capas si se proporciona
    if (layers && layers.length > 0) {
      query = query.in('layer', layers)
    }

    const { data: events, error } = await query

    if (error) {
      console.error('Error fetching events:', error)
      return NextResponse.json(
        { error: 'Error al obtener eventos' },
        { status: 500 }
      )
    }

    return NextResponse.json(events || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Error inesperado' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/calendar/events
 * Crea un nuevo evento de calendario
 */
export async function POST(request: NextRequest) {
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

    // Obtener datos del body
    const body = await request.json()
    const { title, description, start_date, end_date, layer, attachments } = body

    // Validaciones
    if (!title || !start_date || !end_date || !layer) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: title, start_date, end_date, layer' },
        { status: 400 }
      )
    }

    // Validar que end_date >= start_date
    if (new Date(end_date) < new Date(start_date)) {
      return NextResponse.json(
        { error: 'La fecha de fin debe ser mayor o igual a la fecha de inicio' },
        { status: 400 }
      )
    }

    // Validar capa válida
    const validLayers = ['marketing', 'operations', 'pr', 'retail', 'product', 'personal', 'otros']
    if (!validLayers.includes(layer)) {
      return NextResponse.json(
        { error: 'Capa inválida' },
        { status: 400 }
      )
    }

    // Crear evento
    const { data: event, error } = await (supabase
      .from('calendar_events') as any)
      .insert({
        user_id: user.id,
        title,
        description: description || null,
        start_date,
        end_date,
        layer,
        attachments: attachments || []
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating event:', error)
      return NextResponse.json(
        { error: 'Error al crear evento' },
        { status: 500 }
      )
    }

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Error inesperado' },
      { status: 500 }
    )
  }
}

