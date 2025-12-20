import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Intentar usar service role client
    let supabase
    try {
      supabase = createServiceRoleClient()
    } catch (error) {
      console.warn('Service role key no configurada, usando cliente normal:', error)
      supabase = await createClient()
    }

    const { searchParams } = new URL(request.url)
    const userParam = searchParams.get('user_name')
    const storeParam = searchParams.get('store')
    const eventTypeParam = searchParams.get('event_type') // Medición o Fitting
    const statusParam = searchParams.get('status') // active, canceled, rescheduled
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')
    const startDateParam = searchParams.get('start_date') // YYYY-MM-DD
    const endDateParam = searchParams.get('end_date') // YYYY-MM-DD
    const hasUtmParam = searchParams.get('has_utm') // true/false
    const aggregateParam = searchParams.get('aggregate') // true/false - si se quiere agregación

    let query = supabase
      .from('calendly_historical_stats')
      .select('*')

    // Filtros
    if (userParam) {
      query = query.eq('user_name', userParam)
    }

    if (storeParam) {
      query = query.eq('user_store', storeParam)
    }

    if (eventTypeParam) {
      if (eventTypeParam === 'Medición' || eventTypeParam === 'Fitting') {
        query = query.eq('event_type_category', eventTypeParam)
      }
    }

    if (statusParam) {
      if (['active', 'canceled', 'rescheduled'].includes(statusParam)) {
        query = query.eq('status', statusParam)
      }
    }

    if (yearParam) {
      const year = parseInt(yearParam)
      if (!isNaN(year)) {
        query = query.eq('year', year)
      }
    }

    if (monthParam) {
      const month = parseInt(monthParam)
      if (!isNaN(month) && month >= 1 && month <= 12) {
        query = query.eq('month', month)
      }
    }

    if (startDateParam) {
      const [year, month] = startDateParam.split('-').map(Number)
      if (!isNaN(year) && !isNaN(month)) {
        // Filtro: year > startYear OR (year = startYear AND month >= startMonth)
        query = query.or(`year.gt.${year},and(year.eq.${year},month.gte.${month})`)
      }
    }

    if (endDateParam) {
      const [year, month] = endDateParam.split('-').map(Number)
      if (!isNaN(year) && !isNaN(month)) {
        // Filtro: year < endYear OR (year = endYear AND month <= endMonth)
        query = query.or(`year.lt.${year},and(year.eq.${year},month.lte.${month})`)
      }
    }

    if (hasUtmParam !== null) {
      const hasUtm = hasUtmParam === 'true'
      query = query.eq('has_utm', hasUtm)
    }

    // Ordenamiento
    query = query
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('user_name', { ascending: true })

    const { data: stats, error } = await query

    if (error) {
      throw error
    }

    // Si se solicita agregación, calcular totales
    if (aggregateParam === 'true') {
      const aggregated = {
        total_count: 0,
        active_count: 0,
        canceled_count: 0,
        rescheduled_count: 0,
        by_user: {} as Record<string, number>,
        by_store: {} as Record<string, number>,
        by_event_type: {} as Record<string, number>,
        by_month: {} as Record<string, number>,
      }

      if (stats) {
        for (const stat of stats) {
          aggregated.total_count += stat.count

          if (stat.status === 'active') {
            aggregated.active_count += stat.count
          } else if (stat.status === 'canceled') {
            aggregated.canceled_count += stat.count
          } else if (stat.status === 'rescheduled') {
            aggregated.rescheduled_count += stat.count
          }

          // Por usuario
          if (stat.user_name) {
            aggregated.by_user[stat.user_name] = (aggregated.by_user[stat.user_name] || 0) + stat.count
          }

          // Por tienda
          if (stat.user_store) {
            aggregated.by_store[stat.user_store] = (aggregated.by_store[stat.user_store] || 0) + stat.count
          }

          // Por tipo de evento
          if (stat.event_type_category) {
            aggregated.by_event_type[stat.event_type_category] = (aggregated.by_event_type[stat.event_type_category] || 0) + stat.count
          }

          // Por mes
          const monthKey = `${stat.year}-${stat.month.toString().padStart(2, '0')}`
          aggregated.by_month[monthKey] = (aggregated.by_month[monthKey] || 0) + stat.count
        }
      }

      return NextResponse.json({
        success: true,
        data: stats || [],
        aggregated,
        filters: {
          user_name: userParam || null,
          store: storeParam || null,
          event_type: eventTypeParam || null,
          status: statusParam || null,
          year: yearParam || null,
          month: monthParam || null,
          start_date: startDateParam || null,
          end_date: endDateParam || null,
          has_utm: hasUtmParam || null,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: stats || [],
      count: stats?.length || 0,
      filters: {
        user_name: userParam || null,
        store: storeParam || null,
        event_type: eventTypeParam || null,
        status: statusParam || null,
        year: yearParam || null,
        month: monthParam || null,
        start_date: startDateParam || null,
        end_date: endDateParam || null,
        has_utm: hasUtmParam || null,
      },
    })
  } catch (error) {
    console.error('Error fetching historical Calendly stats:', error)
    return NextResponse.json(
      { error: 'No se pudieron obtener las estadísticas históricas', details: String(error) },
      { status: 500 }
    )
  }
}

