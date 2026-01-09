/**
 * API para consultar citas históricas
 * GET /api/citas/historical
 * 
 * Query params:
 * - startDate: YYYY-MM-DD
 * - endDate: YYYY-MM-DD
 * - year: número
 * - month: 1-12
 * - storeCity: nombre de la ciudad
 * - appointmentType: medicion | fitting
 * - includePatterns: true para incluir patrones horarios
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { HistoricalFilters, HistoricalStatsResponse, PeriodMetrics, PatternData } from '@/types/historical';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    
    // Parsear query params
    const searchParams = request.nextUrl.searchParams;
    const filters: HistoricalFilters = {
      start_date: searchParams.get('startDate') || undefined,
      end_date: searchParams.get('endDate') || undefined,
      year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined,
      month: searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined,
      store_city: searchParams.get('city') || searchParams.get('storeCity') || undefined,
      appointment_type: (searchParams.get('appointmentType') as 'medicion' | 'fitting') || undefined,
    };
    
    const includePatterns = searchParams.get('includePatterns') === 'true';
    const aggregateBy = searchParams.get('aggregateBy'); // 'dayOfWeek' | 'hour' | 'month'
    
    // Si aggregateBy está especificado, necesitamos patterns
    const needsPatterns = includePatterns || aggregateBy === 'dayOfWeek' || aggregateBy === 'hour';
    
    // Construir query base
    let query = supabase
      .from('historical_appointments')
      .select('*')
      .limit(100000); // Eliminar límite por defecto de 1000
    
    // Aplicar filtros
    if (filters.start_date && filters.end_date) {
      query = query
        .gte('datetime', `${filters.start_date}T00:00:00Z`)
        .lte('datetime', `${filters.end_date}T23:59:59Z`);
    } else if (filters.year && filters.month) {
      query = query
        .eq('year', filters.year)
        .eq('month', filters.month);
    } else if (filters.year) {
      query = query.eq('year', filters.year);
    }
    
    if (filters.store_city) {
      query = query.eq('store_city', filters.store_city);
    }
    
    if (filters.appointment_type) {
      query = query.eq('appointment_type', filters.appointment_type);
    }
    
    // Ejecutar query
    const { data, error } = await query;
    
    if (error) {
      console.error('[Historical API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Calcular métricas
    const appointments = (data || []) as any[];
    
    // Separar canceladas
    const cancelled = appointments.filter((a: any) => a.is_cancelled).length;
    
    // Citas = SOLO las NO canceladas (confirmadas/programadas)
    const medicion = appointments.filter((a: any) => a.appointment_type === 'medicion' && !a.is_cancelled).length;
    const fitting = appointments.filter((a: any) => a.appointment_type === 'fitting' && !a.is_cancelled).length;
    
    // Total = Citas confirmadas + Canceladas
    const total = medicion + fitting + cancelled;
    const cancellation_rate = total > 0 ? (cancelled / total) * 100 : 0;
    
    // Calcular promedio por día
    const uniqueDays = new Set(appointments.map(a => a.datetime.split('T')[0]));
    const avg_per_day = uniqueDays.size > 0 ? total / uniqueDays.size : 0;
    
    // Agrupar por tienda
    const byStore = new Map<string, typeof appointments>();
    appointments.forEach(apt => {
      const store = apt.store_city;
      if (!byStore.has(store)) {
        byStore.set(store, []);
      }
      byStore.get(store)!.push(apt);
    });
    
    const storeMetrics = Array.from(byStore.entries()).map(([store_city, apts]) => {
      // Separar canceladas
      const cancelledTotal = apts.filter(a => a.is_cancelled).length;
      const cancelledMedicion = apts.filter(a => a.appointment_type === 'medicion' && a.is_cancelled).length;
      const cancelledFitting = apts.filter(a => a.appointment_type === 'fitting' && a.is_cancelled).length;
      
      // Citas = SOLO las NO canceladas
      const medicionConfirmed = apts.filter(a => a.appointment_type === 'medicion' && !a.is_cancelled).length;
      const fittingConfirmed = apts.filter(a => a.appointment_type === 'fitting' && !a.is_cancelled).length;
      
      // Total = Citas confirmadas + Canceladas
      const totalApts = medicionConfirmed + fittingConfirmed + cancelledTotal;
      
      return {
        store_city,
        total: totalApts,
        medicion: medicionConfirmed,
        fitting: fittingConfirmed,
        cancelled: cancelledTotal,
        cancellation_rate: totalApts > 0 ? (cancelledTotal / totalApts) * 100 : 0,
        cancelled_medicion: cancelledMedicion,
        cancelled_fitting: cancelledFitting,
        cancellation_rate_medicion: (medicionConfirmed + cancelledMedicion) > 0 ? (cancelledMedicion / (medicionConfirmed + cancelledMedicion)) * 100 : 0,
        cancellation_rate_fitting: (fittingConfirmed + cancelledFitting) > 0 ? (cancelledFitting / (fittingConfirmed + cancelledFitting)) * 100 : 0,
      };
    });
    
    // Construir período string
    let periodStr = 'custom';
    if (filters.year && filters.month) {
      periodStr = `${filters.year}-${String(filters.month).padStart(2, '0')}`;
    } else if (filters.start_date && filters.end_date) {
      periodStr = `${filters.start_date}_${filters.end_date}`;
    }
    
    const metrics: PeriodMetrics = {
      period: periodStr,
      total,
      medicion,
      fitting,
      cancelled,
      cancellation_rate,
      avg_per_day,
      by_store: storeMetrics.sort((a, b) => b.total - a.total), // Ordenar por total descendente
    };
    
    // Calcular patrones si se solicita
    let patterns: PatternData | undefined;
    if (needsPatterns) {
      // Patrones por día de la semana
      const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const byDayMap = new Map<number, typeof appointments>();
      
      appointments.forEach(apt => {
        if (!byDayMap.has(apt.day_of_week)) {
          byDayMap.set(apt.day_of_week, []);
        }
        byDayMap.get(apt.day_of_week)!.push(apt);
      });
      
      const by_day_of_week = Array.from(byDayMap.entries())
        .map(([day, apts]) => {
          const cancelled = apts.filter(a => a.is_cancelled).length;
          const medicion = apts.filter(a => a.appointment_type === 'medicion' && !a.is_cancelled).length;
          const fitting = apts.filter(a => a.appointment_type === 'fitting' && !a.is_cancelled).length;
          return {
            day,
            day_name: dayNames[day],
            total: medicion + fitting + cancelled,
            medicion,
            fitting,
          };
        })
        .sort((a, b) => a.day - b.day);
      
      // Patrones por hora
      const byHourMap = new Map<number, typeof appointments>();
      
      appointments.forEach(apt => {
        if (!byHourMap.has(apt.hour)) {
          byHourMap.set(apt.hour, []);
        }
        byHourMap.get(apt.hour)!.push(apt);
      });
      
      const by_hour = Array.from(byHourMap.entries())
        .map(([hour, apts]) => {
          const cancelled = apts.filter(a => a.is_cancelled).length;
          const medicion = apts.filter(a => a.appointment_type === 'medicion' && !a.is_cancelled).length;
          const fitting = apts.filter(a => a.appointment_type === 'fitting' && !a.is_cancelled).length;
          return {
            hour,
            total: medicion + fitting + cancelled,
            medicion,
            fitting,
          };
        })
        .sort((a, b) => a.hour - b.hour);
      
      // Heatmap (día x hora)
      const heatmapMap = new Map<string, number>();
      
      appointments.forEach(apt => {
        const key = `${apt.day_of_week}-${apt.hour}`;
        heatmapMap.set(key, (heatmapMap.get(key) || 0) + 1);
      });
      
      const heatmap: any[][] = [];
      for (let day = 0; day <= 6; day++) {
        const dayRow = [];
        for (let hour = 0; hour < 24; hour++) {
          const key = `${day}-${hour}`;
          dayRow.push({
            day,
            hour,
            count: heatmapMap.get(key) || 0,
          });
        }
        heatmap.push(dayRow);
      }
      
      patterns = {
        by_day_of_week,
        by_hour,
        heatmap,
      };
    }
    
    // Si aggregateBy está especificado, agregar datos específicos a metrics
    if (aggregateBy === 'dayOfWeek' && patterns) {
      (metrics as any).byDayOfWeek = patterns.by_day_of_week;
    } else if (aggregateBy === 'hour' && patterns) {
      (metrics as any).byHour = patterns.by_hour;
    } else if (aggregateBy === 'month') {
      // Agrupar por mes
      const monthlyMap = new Map<string, typeof appointments>();
      appointments.forEach(apt => {
        const key = `${apt.year}-${apt.month}`;
        if (!monthlyMap.has(key)) {
          monthlyMap.set(key, []);
        }
        monthlyMap.get(key)!.push(apt);
      });
      
      (metrics as any).byMonth = Array.from(monthlyMap.entries())
        .map(([key, apts]) => {
          const [year, month] = key.split('-').map(Number);
          const cancelled = apts.filter(a => a.is_cancelled).length;
          const medicion = apts.filter(a => a.appointment_type === 'medicion' && !a.is_cancelled).length;
          const fitting = apts.filter(a => a.appointment_type === 'fitting' && !a.is_cancelled).length;
          return {
            year,
            month,
            total: medicion + fitting + cancelled,
            medicion,
            fitting,
            cancelled,
          };
        })
        .sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        });
    }
    
    const response: HistoricalStatsResponse = {
      filters,
      metrics,
      patterns,
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[Historical API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

