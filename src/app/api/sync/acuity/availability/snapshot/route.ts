import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfQuarter, 
  endOfQuarter,
  subWeeks,
  subMonths,
  subQuarters,
  format,
} from 'date-fns'

type PeriodType = 'weekly' | 'monthly' | 'quarterly'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Obtener parámetros del request
    const body = await request.json().catch(() => ({}))
    const periodType: PeriodType = body.periodType || 'weekly'
    const targetDate = body.date ? new Date(body.date) : new Date()

    console.log(`[Acuity Availability Snapshot] Creating snapshot for ${periodType} period...`)

    // Calcular fechas del período según el tipo
    let periodStart: Date
    let periodEnd: Date
    let snapshotDate: Date

    if (periodType === 'weekly') {
      // Snapshot de la semana anterior
      const lastWeek = subWeeks(targetDate, 1)
      periodStart = startOfWeek(lastWeek, { weekStartsOn: 1 }) // Lunes
      periodEnd = endOfWeek(lastWeek, { weekStartsOn: 1 }) // Domingo
      snapshotDate = startOfWeek(targetDate, { weekStartsOn: 1 }) // Lunes actual
    } else if (periodType === 'monthly') {
      // Snapshot del mes anterior
      const lastMonth = subMonths(targetDate, 1)
      periodStart = startOfMonth(lastMonth)
      periodEnd = endOfMonth(lastMonth)
      snapshotDate = startOfMonth(targetDate) // Primer día del mes actual
    } else {
      // Snapshot del trimestre anterior
      const lastQuarter = subQuarters(targetDate, 1)
      periodStart = startOfQuarter(lastQuarter)
      periodEnd = endOfQuarter(lastQuarter)
      snapshotDate = startOfQuarter(targetDate) // Inicio del trimestre actual
    }

    const periodStartStr = format(periodStart, 'yyyy-MM-dd')
    const periodEndStr = format(periodEnd, 'yyyy-MM-dd')
    const snapshotDateStr = format(snapshotDate, 'yyyy-MM-dd')

    console.log(`[Acuity Availability Snapshot] Period: ${periodStartStr} to ${periodEndStr}, snapshot date: ${snapshotDateStr}`)

    // Obtener datos de disponibilidad del período desde acuity_availability_by_store
    const { data: availabilityData, error: availabilityError } = await supabase
      .from('acuity_availability_by_store')
      .select('*')
      .gte('date', periodStartStr)
      .lte('date', periodEndStr)

    if (availabilityError) {
      console.error('[Acuity Availability Snapshot] Error fetching availability data:', availabilityError)
      throw availabilityError
    }

    if (!availabilityData || availabilityData.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No availability data found for ${periodType} period ${periodStartStr} to ${periodEndStr}`,
        records_created: 0,
      })
    }

    // Agregar por tienda y categoría
    const aggregatedData = new Map<string, {
      storeName: string
      appointmentCategory: 'medición' | 'fitting'
      totalSlots: number
      bookedSlots: number
      availableSlots: number
    }>()

    for (const record of availabilityData as Array<{
      store_name: string
      appointment_category: 'medición' | 'fitting'
      total_slots: number
      booked_slots: number
      available_slots: number
    }>) {
      const key = `${record.store_name}-${record.appointment_category}`

      if (!aggregatedData.has(key)) {
        aggregatedData.set(key, {
          storeName: record.store_name,
          appointmentCategory: record.appointment_category,
          totalSlots: 0,
          bookedSlots: 0,
          availableSlots: 0,
        })
      }

      const data = aggregatedData.get(key)!
      data.totalSlots += record.total_slots || 0
      data.bookedSlots += record.booked_slots || 0
      data.availableSlots += record.available_slots || 0
    }

    // Guardar snapshots en acuity_availability_history
    let savedCount = 0

    for (const [key, data] of aggregatedData) {
      // Calcular porcentaje de ocupación
      const occupationPercentage = data.totalSlots > 0
        ? Math.round((data.bookedSlots / data.totalSlots) * 100 * 100) / 100 // 2 decimales
        : 0

      const snapshotId = `${snapshotDateStr}-${data.storeName}-${data.appointmentCategory}-${periodType}`

      const { error: insertError } = await supabase
        .from('acuity_availability_history')
        .upsert({
          id: snapshotId,
          snapshot_date: snapshotDateStr,
          store_name: data.storeName,
          appointment_category: data.appointmentCategory,
          period_type: periodType,
          period_start: periodStartStr,
          period_end: periodEndStr,
          total_slots: data.totalSlots,
          booked_slots: data.bookedSlots,
          available_slots: data.availableSlots,
          occupation_percentage: occupationPercentage,
        } as any, {
          onConflict: 'id',
        })

      if (insertError) {
        console.error(`[Acuity Availability Snapshot] Error saving snapshot ${snapshotId}:`, insertError)
      } else {
        savedCount++
      }
    }

    console.log(`[Acuity Availability Snapshot] Created ${savedCount} snapshot records`)

    return NextResponse.json({
      success: true,
      message: `Snapshot created for ${periodType} period`,
      period_type: periodType,
      period_start: periodStartStr,
      period_end: periodEndStr,
      snapshot_date: snapshotDateStr,
      records_created: savedCount,
    })
  } catch (error) {
    console.error('Acuity availability snapshot error:', error)
    
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
        error: 'Failed to create availability snapshot', 
        details: errorMessage
      },
      { status: 500 }
    )
  }
}

