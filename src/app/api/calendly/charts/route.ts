import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, createClient } from '@/lib/supabase/server'
import { subDays, format, eachDayOfInterval, startOfDay } from 'date-fns'

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
    const daysParam = searchParams.get('days')
    const days = daysParam ? parseInt(daysParam) : 30

    if (isNaN(days) || days <= 0 || days > 365) {
      return NextResponse.json(
        { error: 'Parámetro days inválido. Debe estar entre 1 y 365.' },
        { status: 400 }
      )
    }

    // Obtener eventos de los últimos N días
    const startDate = subDays(new Date(), days - 1)
    const { data: events, error } = await supabase
      .from('calendly_events')
      .select('*')
      .gte('start_time', startDate.toISOString())
      .order('start_time', { ascending: true })

    if (error) {
      throw error
    }

    // Generar datos para el gráfico de citas por día
    const endDate = new Date()
    const dateRange = eachDayOfInterval({
      start: startOfDay(startDate),
      end: startOfDay(endDate),
    })

    const dailyData = dateRange.map((date) => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayEvents = events?.filter((event) => {
        const eventDate = format(new Date(event.start_time), 'yyyy-MM-dd')
        return eventDate === dateStr
      }) || []

      const completadas = dayEvents.filter((e) => e.status === 'completed').length
      const canceladas = dayEvents.filter((e) => e.status === 'canceled').length

      return {
        date: format(date, 'dd MMM'),
        value: dayEvents.length,
        completadas,
        canceladas,
      }
    })

    // Generar datos para el gráfico de citas por tipo
    const eventsByType: Record<string, number> = {}
    events?.forEach((event) => {
      const typeName = event.event_type_name || 'Otros'
      eventsByType[typeName] = (eventsByType[typeName] || 0) + 1
    })

    const appointmentsByType = Object.entries(eventsByType)
      .map(([name, value], index) => ({
        name,
        value,
        color: `var(--chart-${(index % 5) + 1})`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10) // Top 10 tipos

    return NextResponse.json({
      success: true,
      daily_data: dailyData,
      by_type: appointmentsByType,
      total_events: events?.length || 0,
    })
  } catch (error) {
    console.error('Error fetching Calendly chart data:', error)
    return NextResponse.json(
      { error: 'No se pudieron obtener los datos de gráficos de Calendly', details: String(error) },
      { status: 500 }
    )
  }
}

