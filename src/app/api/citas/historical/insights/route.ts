/**
 * API para calcular insights automáticos de patrones
 * GET /api/citas/historical/insights
 * 
 * Query params:
 * - years: array de años (ej: 2025,2024,2023)
 * - stores: array de tiendas o 'all'
 * - insightTypes: array de tipos o 'all' (day|hour|cancellation|growth|anomaly)
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
    const insightTypesParam = searchParams.get('insightTypes');
    
    const years = yearsParam ? yearsParam.split(',').map(Number) : [2025];
    const stores = storesParam === 'all' ? null : (storesParam ? storesParam.split(',') : null);
    const insightTypes = insightTypesParam === 'all' ? ['day', 'hour', 'cancellation', 'growth', 'anomaly'] : (insightTypesParam ? insightTypesParam.split(',') : ['all']);
    
    // Cargar TODOS los datos con paginación
    const appointments = await fetchAllAppointments(supabase, years, stores);
    const insights: any[] = [];
    
    // Función helper para calcular promedio
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    
    // Función helper para calcular desviación estándar
    const stdDev = (arr: number[]) => {
      if (arr.length === 0) return 0;
      const mean = avg(arr);
      const squareDiffs = arr.map(value => Math.pow(value - mean, 2));
      return Math.sqrt(avg(squareDiffs));
    };
    
    // INSIGHTS POR DÍA DE SEMANA (SIN DOMINGO)
    if (insightTypes.includes('day') || insightTypes.includes('all')) {
      const dayNames = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dayMap = new Map<number, number>();
      
      appointments.forEach(apt => {
        // Excluir domingo (día 0)
        if (!apt.is_cancelled && apt.day_of_week >= 1 && apt.day_of_week <= 6) {
          dayMap.set(apt.day_of_week, (dayMap.get(apt.day_of_week) || 0) + 1);
        }
      });
      
      const dayCounts = Array.from(dayMap.entries()).map(([day, count]) => ({ day, count }));
      const avgPerDay = avg(dayCounts.map(d => d.count));
      
      // Día más activo
      const mostActiveDay = dayCounts.sort((a, b) => b.count - a.count)[0];
      if (mostActiveDay && mostActiveDay.count > avgPerDay * 1.15) {
        const percentAboveAvg = ((mostActiveDay.count - avgPerDay) / avgPerDay * 100).toFixed(0);
        insights.push({
          type: 'peak',
          category: 'day',
          message: `${dayNames[mostActiveDay.day]}: Día más activo`,
          detail: `${mostActiveDay.count} citas (+${percentAboveAvg}% vs promedio)`,
          data: { day: mostActiveDay.day, count: mostActiveDay.count, avgPerDay },
        });
      }
      
      // Día menos activo (oportunidad)
      const leastActiveDay = dayCounts.sort((a, b) => a.count - b.count)[0];
      if (leastActiveDay && leastActiveDay.count < avgPerDay * 0.7) {
        const percentBelowAvg = ((avgPerDay - leastActiveDay.count) / avgPerDay * 100).toFixed(0);
        insights.push({
          type: 'info',
          category: 'day',
          message: `${dayNames[leastActiveDay.day]}: Oportunidad de promoción`,
          detail: `Solo ${leastActiveDay.count} citas (-${percentBelowAvg}% vs promedio)`,
          data: { day: leastActiveDay.day, count: leastActiveDay.count, avgPerDay },
        });
      }
      
      // Comparar medición vs fitting por día
      const dayTypeMap = new Map<number, { medicion: number; fitting: number }>();
      appointments.forEach(apt => {
        if (!apt.is_cancelled) {
          const current = dayTypeMap.get(apt.day_of_week) || { medicion: 0, fitting: 0 };
          if (apt.appointment_type === 'medicion') current.medicion++;
          else if (apt.appointment_type === 'fitting') current.fitting++;
          dayTypeMap.set(apt.day_of_week, current);
        }
      });
      
      dayTypeMap.forEach((types, day) => {
        const total = types.medicion + types.fitting;
        if (total > 0) {
          const medicionPercent = (types.medicion / total) * 100;
          if (medicionPercent > 70) {
            insights.push({
              type: 'info',
              category: 'day',
              message: `${dayNames[day]}: Preferencia Medición`,
              detail: `${medicionPercent.toFixed(0)}% de citas son mediciones`,
              data: { day, medicionPercent, types },
            });
          } else if (medicionPercent < 30) {
            insights.push({
              type: 'info',
              category: 'day',
              message: `${dayNames[day]}: Preferencia Fitting`,
              detail: `${(100 - medicionPercent).toFixed(0)}% de citas son fittings`,
              data: { day, medicionPercent, types },
            });
          }
        }
      });
    }
    
    // INSIGHTS POR HORA (SOLO HORARIO COMERCIAL 8-23)
    if (insightTypes.includes('hour') || insightTypes.includes('all')) {
      const hourMap = new Map<number, number>();
      
      appointments.forEach(apt => {
        // Solo horario comercial 8:00-23:00
        if (!apt.is_cancelled && apt.hour >= 8 && apt.hour <= 23) {
          hourMap.set(apt.hour, (hourMap.get(apt.hour) || 0) + 1);
        }
      });
      
      const hourCounts = Array.from(hourMap.entries()).map(([hour, count]) => ({ hour, count }));
      const avgPerHour = avg(hourCounts.map(h => h.count));
      
      // Horas pico (top 3)
      const topHours = hourCounts.sort((a, b) => b.count - a.count).slice(0, 3);
      if (topHours.length > 0) {
        const hoursStr = topHours.map(h => `${h.hour}:00`).join(', ');
        insights.push({
          type: 'peak',
          category: 'hour',
          message: `Horas pico: ${hoursStr}`,
          detail: `${topHours[0].count} citas en promedio`,
          data: { topHours },
        });
      }
      
      // Detectar si hay más actividad matutina o vespertina
      const morningCitas = appointments.filter(a => !a.is_cancelled && a.hour >= 8 && a.hour < 14).length;
      const afternoonCitas = appointments.filter(a => !a.is_cancelled && a.hour >= 14 && a.hour < 20).length;
      
      if (morningCitas > afternoonCitas * 1.3) {
        const percent = ((morningCitas / (morningCitas + afternoonCitas)) * 100).toFixed(0);
        insights.push({
          type: 'trend',
          category: 'hour',
          message: `Preferencia matutina`,
          detail: `${percent}% de citas antes de 14:00`,
          data: { morningCitas, afternoonCitas },
        });
      } else if (afternoonCitas > morningCitas * 1.3) {
        const percent = ((afternoonCitas / (morningCitas + afternoonCitas)) * 100).toFixed(0);
        insights.push({
          type: 'trend',
          category: 'hour',
          message: `Preferencia vespertina`,
          detail: `${percent}% de citas después de 14:00`,
          data: { morningCitas, afternoonCitas },
        });
      }
    }
    
    // INSIGHTS DE CANCELACIÓN
    if (insightTypes.includes('cancellation') || insightTypes.includes('all')) {
      const totalCitas = appointments.length;
      const totalCancelled = appointments.filter(a => a.is_cancelled).length;
      const cancelRate = totalCitas > 0 ? (totalCancelled / totalCitas) * 100 : 0;
      
      // Cancelaciones por día (SIN DOMINGO)
      const cancelDayMap = new Map<number, { total: number; cancelled: number }>();
      appointments.forEach(apt => {
        // Excluir domingo (día 0)
        if (apt.day_of_week >= 1 && apt.day_of_week <= 6) {
          const current = cancelDayMap.get(apt.day_of_week) || { total: 0, cancelled: 0 };
          current.total++;
          if (apt.is_cancelled) current.cancelled++;
          cancelDayMap.set(apt.day_of_week, current);
        }
      });
      
      const dayNames = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      cancelDayMap.forEach((data, day) => {
        const rate = (data.cancelled / data.total) * 100;
        if (rate > cancelRate * 1.5) {
          insights.push({
            type: 'warning',
            category: 'cancellation',
            message: `${dayNames[day]}: Alta tasa de cancelación`,
            detail: `${rate.toFixed(1)}% canceladas (vs ${cancelRate.toFixed(1)}% promedio)`,
            data: { day, rate, cancelled: data.cancelled, total: data.total },
          });
        }
      });
      
      // Cancelaciones por hora (SOLO HORARIO COMERCIAL 8-23)
      const cancelHourMap = new Map<number, { total: number; cancelled: number }>();
      appointments.forEach(apt => {
        // Solo horario comercial 8:00-23:00
        if (apt.hour >= 8 && apt.hour <= 23) {
          const current = cancelHourMap.get(apt.hour) || { total: 0, cancelled: 0 };
          current.total++;
          if (apt.is_cancelled) current.cancelled++;
          cancelHourMap.set(apt.hour, current);
        }
      });
      
      cancelHourMap.forEach((data, hour) => {
        const rate = (data.cancelled / data.total) * 100;
        if (rate > 35 && data.total > 10) { // Solo alertar si hay suficientes datos
          insights.push({
            type: 'warning',
            category: 'cancellation',
            message: `${hour}:00 - ${hour + 1}:00: Crítico`,
            detail: `${rate.toFixed(1)}% de cancelación`,
            data: { hour, rate, cancelled: data.cancelled, total: data.total },
          });
        }
      });
    }
    
    // INSIGHTS DE CRECIMIENTO
    if (insightTypes.includes('growth') || insightTypes.includes('all') && years.length >= 2) {
      const sortedYears = years.sort((a, b) => a - b);
      
      for (let i = 1; i < sortedYears.length; i++) {
        const currentYear = sortedYears[i];
        const previousYear = sortedYears[i - 1];
        
        const currentTotal = appointments.filter(a => a.year === currentYear && !a.is_cancelled).length;
        const previousTotal = appointments.filter(a => a.year === previousYear && !a.is_cancelled).length;
        
        if (previousTotal > 0) {
          const growth = ((currentTotal - previousTotal) / previousTotal) * 100;
          
          if (Math.abs(growth) > 15) {
            insights.push({
              type: growth > 0 ? 'growth' : 'warning',
              category: 'growth',
              message: `${currentYear} vs ${previousYear}: ${growth > 0 ? 'Crecimiento' : 'Descenso'} ${Math.abs(growth).toFixed(0)}%`,
              detail: `${currentTotal} citas (${growth > 0 ? '+' : ''}${(currentTotal - previousTotal).toLocaleString()})`,
              data: { currentYear, previousYear, growth, currentTotal, previousTotal },
            });
          }
        }
        
        // Crecimiento por segmento horario
        const currentMorning = appointments.filter(a => a.year === currentYear && !a.is_cancelled && a.hour >= 8 && a.hour < 14).length;
        const previousMorning = appointments.filter(a => a.year === previousYear && !a.is_cancelled && a.hour >= 8 && a.hour < 14).length;
        
        if (previousMorning > 0) {
          const morningGrowth = ((currentMorning - previousMorning) / previousMorning) * 100;
          if (morningGrowth > 25) {
            insights.push({
              type: 'growth',
              category: 'growth',
              message: `Crecimiento matutino: +${morningGrowth.toFixed(0)}%`,
              detail: `Citas de 8:00-14:00 aumentaron en ${currentYear}`,
              data: { segment: 'morning', growth: morningGrowth },
            });
          }
        }
        
        const currentAfternoon = appointments.filter(a => a.year === currentYear && !a.is_cancelled && a.hour >= 14 && a.hour < 20).length;
        const previousAfternoon = appointments.filter(a => a.year === previousYear && !a.is_cancelled && a.hour >= 14 && a.hour < 20).length;
        
        if (previousAfternoon > 0) {
          const afternoonGrowth = ((currentAfternoon - previousAfternoon) / previousAfternoon) * 100;
          if (afternoonGrowth > 25) {
            insights.push({
              type: 'growth',
              category: 'growth',
              message: `Crecimiento vespertino: +${afternoonGrowth.toFixed(0)}%`,
              detail: `Citas de 14:00-20:00 aumentaron en ${currentYear}`,
              data: { segment: 'afternoon', growth: afternoonGrowth },
            });
          }
        }
      }
    }
    
    // INSIGHTS DE ANOMALÍAS
    if (insightTypes.includes('anomaly') || insightTypes.includes('all')) {
      // Detectar días con comportamiento anómalo (SIN DOMINGO)
      const dayMap = new Map<number, number>();
      appointments.forEach(apt => {
        // Excluir domingo (día 0) y solo no canceladas
        if (!apt.is_cancelled && apt.day_of_week >= 1 && apt.day_of_week <= 6) {
          dayMap.set(apt.day_of_week, (dayMap.get(apt.day_of_week) || 0) + 1);
        }
      });
      
      const dayCounts = Array.from(dayMap.values());
      const dayAvg = avg(dayCounts);
      const dayStd = stdDev(dayCounts);
      
      const dayNames = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      dayMap.forEach((count, day) => {
        if (count > dayAvg + 2 * dayStd) {
          insights.push({
            type: 'info',
            category: 'anomaly',
            message: `${dayNames[day]}: Actividad excepcional`,
            detail: `${count} citas (muy por encima del promedio)`,
            data: { day, count, avg: dayAvg, std: dayStd },
          });
        }
      });
      
      // Detectar horas con comportamiento anómalo (SOLO HORARIO COMERCIAL 8-23)
      const hourMap = new Map<number, number>();
      appointments.forEach(apt => {
        // Solo horario comercial 8:00-23:00 y no canceladas
        if (!apt.is_cancelled && apt.hour >= 8 && apt.hour <= 23) {
          hourMap.set(apt.hour, (hourMap.get(apt.hour) || 0) + 1);
        }
      });
      
      const hourCounts = Array.from(hourMap.values());
      const hourAvg = avg(hourCounts);
      const hourStd = stdDev(hourCounts);
      
      hourMap.forEach((count, hour) => {
        if (count > hourAvg + 2 * hourStd && count > 50) {
          insights.push({
            type: 'peak',
            category: 'anomaly',
            message: `${hour}:00: Demanda excepcional`,
            detail: `${count} citas (anomalía positiva)`,
            data: { hour, count, avg: hourAvg, std: hourStd },
          });
        }
      });
    }
    
    // Diversificar insights (máximo 2 por categoría para evitar que todo sea de un solo tipo)
    const diversifiedInsights: any[] = [];
    const byCategory = {
      warning: insights.filter(i => i.type === 'warning').slice(0, 2),
      peak: insights.filter(i => i.type === 'peak').slice(0, 2),
      growth: insights.filter(i => i.type === 'growth').slice(0, 2),
      trend: insights.filter(i => i.type === 'trend').slice(0, 2),
      info: insights.filter(i => i.type === 'info').slice(0, 2),
    };
    
    // Mezclar en orden de prioridad
    diversifiedInsights.push(
      ...byCategory.warning, 
      ...byCategory.peak, 
      ...byCategory.growth,
      ...byCategory.trend, 
      ...byCategory.info
    );
    
    return NextResponse.json({
      filters: { years, stores, insightTypes },
      totalInsights: diversifiedInsights.length,
      insights: diversifiedInsights,
    });
    
  } catch (error) {
    console.error('[Insights API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
