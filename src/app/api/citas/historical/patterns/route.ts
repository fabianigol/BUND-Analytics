/**
 * API para consultar patrones avanzados de citas históricas
 * GET /api/citas/historical/patterns
 * 
 * Query params:
 * - years: array de años (ej: 2025,2024,2023)
 * - stores: array de tiendas o 'all'
 * - patternType: temporal|hourly|weekly|store|cancellation|peak|growth
 * - compareMode: multi-year|single-year
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Función helper para cargar TODOS los datos con paginación
async function fetchAllAppointments(supabase: any, years: number[], stores: string[] | null) {
  let allData: any[] = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    let query = supabase
      .from('historical_appointments')
      .select('*')
      .in('year', years)
      .range(from, from + batchSize - 1);
    
    if (stores && stores.length > 0) {
      query = query.in('store_city', stores);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allData = allData.concat(data);
    hasMore = data.length === batchSize;
    from += batchSize;
  }
  
  return allData;
}

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
    const yearsParam = searchParams.get('years');
    const storesParam = searchParams.get('stores');
    const patternType = searchParams.get('patternType') || 'all';
    const compareMode = searchParams.get('compareMode') || 'multi-year';
    
    const years = yearsParam ? yearsParam.split(',').map(Number) : [2025];
    const stores = storesParam === 'all' ? null : (storesParam ? storesParam.split(',') : null);
    
    // Cargar TODOS los datos con paginación
    const appointments = await fetchAllAppointments(supabase, years, stores);
    
    // Calcular patrones según el tipo solicitado
    const result: any = {
      filters: { years, stores, patternType, compareMode },
    };
    
    // PATRÓN TEMPORAL (estacionalidad mes × día de semana)
    if (patternType === 'temporal' || patternType === 'all') {
      const seasonalMap = new Map<string, any[]>();
      
      appointments.forEach(apt => {
        const key = `${apt.month}-${apt.day_of_week}`;
        if (!seasonalMap.has(key)) {
          seasonalMap.set(key, []);
        }
        seasonalMap.get(key)!.push(apt);
      });
      
      const seasonal = Array.from(seasonalMap.entries()).map(([key, apts]) => {
        const [month, dayOfWeek] = key.split('-').map(Number);
        const cancelled = apts.filter(a => a.is_cancelled).length;
        const medicion = apts.filter(a => a.appointment_type === 'medicion' && !a.is_cancelled).length;
        const fitting = apts.filter(a => a.appointment_type === 'fitting' && !a.is_cancelled).length;
        const total = medicion + fitting + cancelled;
        
        return {
          month,
          dayOfWeek,
          total,
          medicion,
          fitting,
          cancelled,
          avgPerDay: total / (apts.length > 0 ? new Set(apts.map(a => a.datetime.split('T')[0])).size : 1),
        };
      });
      
      result.seasonal = seasonal.sort((a, b) => {
        if (a.month !== b.month) return a.month - b.month;
        return a.dayOfWeek - b.dayOfWeek;
      });
    }
    
    // PATRÓN SEMANAL (por día de semana)
    if (patternType === 'weekly' || patternType === 'all') {
      const weeklyMap = new Map<string, any[]>();
      
      appointments.forEach(apt => {
        const key = `${apt.year}-${apt.day_of_week}`;
        if (!weeklyMap.has(key)) {
          weeklyMap.set(key, []);
        }
        weeklyMap.get(key)!.push(apt);
      });
      
      const weeklyByYear: any = {};
      weeklyMap.forEach((apts, key) => {
        const [year, dayOfWeek] = key.split('-').map(Number);
        if (!weeklyByYear[year]) {
          weeklyByYear[year] = [];
        }
        
        const cancelled = apts.filter(a => a.is_cancelled).length;
        const medicion = apts.filter(a => a.appointment_type === 'medicion' && !a.is_cancelled).length;
        const fitting = apts.filter(a => a.appointment_type === 'fitting' && !a.is_cancelled).length;
        
        weeklyByYear[year].push({
          dayOfWeek,
          total: medicion + fitting + cancelled,
          medicion,
          fitting,
          cancelled,
        });
      });
      
      // Ordenar cada año
      Object.keys(weeklyByYear).forEach(year => {
        weeklyByYear[year].sort((a: any, b: any) => a.dayOfWeek - b.dayOfWeek);
      });
      
      result.weekly = weeklyByYear;
    }
    
    // PATRÓN HORARIO (por hora del día)
    if (patternType === 'hourly' || patternType === 'all') {
      const hourlyMap = new Map<string, any[]>();
      
      appointments.forEach(apt => {
        const key = `${apt.year}-${apt.hour}`;
        if (!hourlyMap.has(key)) {
          hourlyMap.set(key, []);
        }
        hourlyMap.get(key)!.push(apt);
      });
      
      const hourlyByYear: any = {};
      hourlyMap.forEach((apts, key) => {
        const [year, hour] = key.split('-').map(Number);
        if (!hourlyByYear[year]) {
          hourlyByYear[year] = [];
        }
        
        const cancelled = apts.filter(a => a.is_cancelled).length;
        const medicion = apts.filter(a => a.appointment_type === 'medicion' && !a.is_cancelled).length;
        const fitting = apts.filter(a => a.appointment_type === 'fitting' && !a.is_cancelled).length;
        
        hourlyByYear[year].push({
          hour,
          total: medicion + fitting + cancelled,
          medicion,
          fitting,
          cancelled,
        });
      });
      
      // Ordenar cada año
      Object.keys(hourlyByYear).forEach(year => {
        hourlyByYear[year].sort((a: any, b: any) => a.hour - b.hour);
      });
      
      result.hourly = hourlyByYear;
      
      // Heatmap día × hora (agregado)
      const heatmapMap = new Map<string, number>();
      appointments.forEach(apt => {
        const key = `${apt.day_of_week}-${apt.hour}`;
        heatmapMap.set(key, (heatmapMap.get(key) || 0) + 1);
      });
      
      const heatmap: any[] = [];
      for (let day = 0; day <= 6; day++) {
        for (let hour = 8; hour < 24; hour++) { // Solo 8:00 a 23:00
          const key = `${day}-${hour}`;
          heatmap.push({
            dayOfWeek: day,
            hour,
            count: heatmapMap.get(key) || 0,
          });
        }
      }
      
      result.dayHourHeatmap = heatmap;
    }
    
    // PATRÓN POR TIENDA
    if (patternType === 'store' || patternType === 'all') {
      const storeMap = new Map<string, any[]>();
      
      appointments.forEach(apt => {
        if (!storeMap.has(apt.store_city)) {
          storeMap.set(apt.store_city, []);
        }
        storeMap.get(apt.store_city)!.push(apt);
      });
      
      const storePatterns: any[] = [];
      storeMap.forEach((apts, store) => {
        // Patrones por día de semana
        const dayMap = new Map<number, number>();
        apts.forEach(apt => {
          if (!apt.is_cancelled) {
            dayMap.set(apt.day_of_week, (dayMap.get(apt.day_of_week) || 0) + 1);
          }
        });
        
        // Patrones por hora
        const hourMap = new Map<number, number>();
        apts.forEach(apt => {
          if (!apt.is_cancelled) {
            hourMap.set(apt.hour, (hourMap.get(apt.hour) || 0) + 1);
          }
        });
        
        // Encontrar días preferidos (top 3)
        const preferredDays = Array.from(dayMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([day]) => day);
        
        // Encontrar horas preferidas (top 3)
        const preferredHours = Array.from(hourMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([hour]) => hour);
        
        // Hora pico (la más alta)
        const peakHour = Array.from(hourMap.entries())
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
        
        const peakDay = Array.from(dayMap.entries())
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
        
        const cancelled = apts.filter(a => a.is_cancelled).length;
        const medicion = apts.filter(a => a.appointment_type === 'medicion' && !a.is_cancelled).length;
        const fitting = apts.filter(a => a.appointment_type === 'fitting' && !a.is_cancelled).length;
        
        storePatterns.push({
          store,
          preferredDays,
          preferredHours,
          peakTime: { day: peakDay, hour: peakHour },
          total: medicion + fitting + cancelled,
          medicion,
          fitting,
          cancelled,
          dayDistribution: Array.from(dayMap.entries()).map(([day, count]) => ({ day, count })),
          hourDistribution: Array.from(hourMap.entries()).map(([hour, count]) => ({ hour, count })),
        });
      });
      
      result.storePatterns = storePatterns.sort((a, b) => b.total - a.total);
    }
    
    // PATRÓN DE CANCELACIÓN
    if (patternType === 'cancellation' || patternType === 'all') {
      const cancelledApts = appointments.filter(a => a.is_cancelled);
      
      // Por día de semana
      const cancelDayMap = new Map<number, { total: number; cancelled: number }>();
      appointments.forEach(apt => {
        const current = cancelDayMap.get(apt.day_of_week) || { total: 0, cancelled: 0 };
        current.total++;
        if (apt.is_cancelled) current.cancelled++;
        cancelDayMap.set(apt.day_of_week, current);
      });
      
      const cancellationByDay = Array.from(cancelDayMap.entries()).map(([day, data]) => ({
        dayOfWeek: day,
        total: data.total,
        cancelled: data.cancelled,
        cancellationRate: data.total > 0 ? (data.cancelled / data.total) * 100 : 0,
      }));
      
      // Por hora
      const cancelHourMap = new Map<number, { total: number; cancelled: number }>();
      appointments.forEach(apt => {
        const current = cancelHourMap.get(apt.hour) || { total: 0, cancelled: 0 };
        current.total++;
        if (apt.is_cancelled) current.cancelled++;
        cancelHourMap.set(apt.hour, current);
      });
      
      const cancellationByHour = Array.from(cancelHourMap.entries()).map(([hour, data]) => ({
        hour,
        total: data.total,
        cancelled: data.cancelled,
        cancellationRate: data.total > 0 ? (data.cancelled / data.total) * 100 : 0,
      }));
      
      // Heatmap de cancelación día × hora
      const cancelHeatmapMap = new Map<string, { total: number; cancelled: number }>();
      appointments.forEach(apt => {
        const key = `${apt.day_of_week}-${apt.hour}`;
        const current = cancelHeatmapMap.get(key) || { total: 0, cancelled: 0 };
        current.total++;
        if (apt.is_cancelled) current.cancelled++;
        cancelHeatmapMap.set(key, current);
      });
      
      const cancellationHeatmap: any[] = [];
      for (let day = 1; day <= 6; day++) { // 1-6 excluye domingo (día 0)
        for (let hour = 8; hour < 24; hour++) { // Solo 8:00 a 23:00
          const key = `${day}-${hour}`;
          const data = cancelHeatmapMap.get(key) || { total: 0, cancelled: 0 };
          const rate = data.total > 0 ? (data.cancelled / data.total) * 100 : 0;
          
          cancellationHeatmap.push({
            dayOfWeek: day,
            hour,
            cancellationRate: rate,
            total: data.total,
            cancelled: data.cancelled,
            severity: rate > 40 ? 'critical' : rate > 25 ? 'high' : rate > 15 ? 'medium' : 'low',
          });
        }
      }
      
      result.cancellationPatterns = {
        byDay: cancellationByDay.sort((a, b) => a.dayOfWeek - b.dayOfWeek),
        byHour: cancellationByHour.sort((a, b) => a.hour - b.hour),
        heatmap: cancellationHeatmap,
      };
    }
    
    // PICOS Y VALLES - Corregido para usar datos reales
    if (patternType === 'peak' || patternType === 'all') {
      const slotMap = new Map<string, number>();
      appointments.forEach(apt => {
        if (!apt.is_cancelled) {
          const key = `${apt.day_of_week}-${apt.hour}`;
          slotMap.set(key, (slotMap.get(key) || 0) + 1);
        }
      });
      
      const slots = Array.from(slotMap.entries()).map(([key, count]) => {
        const [day, hour] = key.split('-').map(Number);
        return { dayOfWeek: day, hour, count };
      });
      
      // CORRECCIÓN: Calcular promedio solo de slots con datos
      const avgPerSlot = slots.length > 0 
        ? slots.reduce((sum, s) => sum + s.count, 0) / slots.length 
        : 0;
      
      // Identificar picos (> 1.5× promedio)
      const peaks = slots
        .filter(s => s.count > avgPerSlot * 1.5)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      // Identificar valles (< 0.5× promedio, pero que tengan datos)
      const valleys = slots
        .filter(s => s.count > 0 && s.count < avgPerSlot * 0.5)
        .sort((a, b) => a.count - b.count)
        .slice(0, 10);
      
      result.peaksAndValleys = {
        avgPerSlot,
        peaks,
        valleys,
        totalSlots: slots.length,
        totalAppointments: appointments.filter(a => !a.is_cancelled).length,
      };
    }
    
    // TENDENCIAS DE CRECIMIENTO
    if (patternType === 'growth' || patternType === 'all') {
      if (years.length >= 2) {
        const sortedYears = years.sort((a, b) => a - b);
        const growthData: any[] = [];
        
        // Comparar año más reciente con el anterior
        for (let i = 1; i < sortedYears.length; i++) {
          const currentYear = sortedYears[i];
          const previousYear = sortedYears[i - 1];
          
          const currentApts = appointments.filter(a => a.year === currentYear && !a.is_cancelled);
          const previousApts = appointments.filter(a => a.year === previousYear && !a.is_cancelled);
          
          // Por día de semana
          const dayGrowth: any[] = [];
          for (let day = 0; day <= 6; day++) {
            const currentCount = currentApts.filter(a => a.day_of_week === day).length;
            const previousCount = previousApts.filter(a => a.day_of_week === day).length;
            const growth = previousCount > 0 ? ((currentCount - previousCount) / previousCount) * 100 : 0;
            
            dayGrowth.push({ dayOfWeek: day, growth, currentCount, previousCount });
          }
          
          // Por hora
          const hourGrowth: any[] = [];
          for (let hour = 0; hour < 24; hour++) {
            const currentCount = currentApts.filter(a => a.hour === hour).length;
            const previousCount = previousApts.filter(a => a.hour === hour).length;
            const growth = previousCount > 0 ? ((currentCount - previousCount) / previousCount) * 100 : 0;
            
            hourGrowth.push({ hour, growth, currentCount, previousCount });
          }
          
          growthData.push({
            comparison: `${currentYear} vs ${previousYear}`,
            currentYear,
            previousYear,
            byDay: dayGrowth,
            byHour: hourGrowth,
          });
        }
        
        result.growthTrends = growthData;
      }
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[Patterns API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
