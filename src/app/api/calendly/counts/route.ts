import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/lib/supabase/server'

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
    const yearParam = searchParams.get('year')

    let query = supabase
      .from('calendly_appointment_counts')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    if (yearParam) {
      const year = parseInt(yearParam)
      if (!isNaN(year)) {
        query = query.eq('year', year)
      }
    }

    const { data: counts, error } = await query

    if (error) {
      throw error
    }

    // Calcular totales si se solicita
    const totals = counts
      ? counts.reduce(
          (acc, count) => ({
            total: acc.total + count.total_count,
            active: acc.active + count.active_count,
            canceled: acc.canceled + count.canceled_count,
            completed: acc.completed + count.completed_count,
          }),
          { total: 0, active: 0, canceled: 0, completed: 0 }
        )
      : { total: 0, active: 0, canceled: 0, completed: 0 }

    return NextResponse.json({
      success: true,
      counts: counts || [],
      totals,
      year_filter: yearParam || null,
    })
  } catch (error) {
    console.error('Error fetching Calendly appointment counts:', error)
    return NextResponse.json(
      { error: 'No se pudieron obtener los conteos de citas', details: String(error) },
      { status: 500 }
    )
  }
}

