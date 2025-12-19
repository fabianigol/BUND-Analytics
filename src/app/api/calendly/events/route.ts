import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/lib/supabase/server'
import { subDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    // Intentar usar service role client, si no está disponible usar cliente normal
    let supabase
    try {
      supabase = createServiceRoleClient()
    } catch (error) {
      console.warn('Service role key no configurada, usando cliente normal:', error)
      supabase = await createClient()
    }

    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const statusParam = searchParams.get('status')
    const daysParam = searchParams.get('days')
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')

    let query = supabase
      .from('calendly_events')
      .select('*')
      .order('start_time', { ascending: false })

    // Filtrar por estado si se proporciona
    if (statusParam && statusParam !== 'all') {
      query = query.eq('status', statusParam)
    }

    // Filtrar por días si se proporciona
    if (daysParam) {
      const days = parseInt(daysParam)
      if (!isNaN(days) && days > 0) {
        const startDate = subDays(new Date(), days)
        query = query.gte('start_time', startDate.toISOString())
      }
    }

    // Filtrar por rango de fechas si se proporciona
    if (startDateParam) {
      query = query.gte('start_time', startDateParam)
    }
    if (endDateParam) {
      query = query.lte('start_time', endDateParam)
    }

    // Limitar resultados si se proporciona
    if (limitParam) {
      const limit = parseInt(limitParam)
      if (!isNaN(limit) && limit > 0) {
        query = query.limit(limit)
      }
    } else {
      // Por defecto, limitar a 100 eventos
      query = query.limit(100)
    }

    const { data: events, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      events: events || [],
      count: events?.length || 0,
    })
  } catch (error) {
    console.error('Error fetching Calendly events:', error)
    return NextResponse.json(
      { error: 'No se pudieron obtener los eventos de Calendly', details: String(error) },
      { status: 500 }
    )
  }
}

