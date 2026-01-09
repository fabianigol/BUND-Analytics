/**
 * Funciones para calcular insights automáticos de patrones
 * Análisis estadístico y detección de anomalías
 */

import type { DayPattern, HourPattern } from '@/types/historical';
import type { PatternInsight } from '@/types/patterns';

/**
 * Calcular promedio de un array de números
 */
export const avg = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

/**
 * Calcular desviación estándar
 */
export const stdDev = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  const mean = avg(arr);
  const squareDiffs = arr.map(value => Math.pow(value - mean, 2));
  return Math.sqrt(avg(squareDiffs));
};

/**
 * Detectar outliers usando método IQR
 */
export const detectOutliers = (arr: number[]): { value: number; index: number }[] => {
  if (arr.length < 4) return [];
  
  const sorted = [...arr].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  const outliers: { value: number; index: number }[] = [];
  arr.forEach((value, index) => {
    if (value < lowerBound || value > upperBound) {
      outliers.push({ value, index });
    }
  });
  
  return outliers;
};

/**
 * Calcular insights por día de semana
 */
export function calculateDayInsights(data: DayPattern[]): PatternInsight[] {
  const insights: PatternInsight[] = [];
  
  if (data.length === 0) return insights;
  
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const totals = data.map(d => d.total);
  const avgTotal = avg(totals);
  const stdDevTotal = stdDev(totals);
  
  // Día más activo
  const maxDay = data.reduce((prev, current) => 
    current.total > prev.total ? current : prev
  );
  
  if (maxDay.total > avgTotal * 1.2) {
    const percentAbove = ((maxDay.total - avgTotal) / avgTotal * 100).toFixed(0);
    insights.push({
      type: 'peak',
      category: 'day',
      message: `${dayNames[maxDay.day]}: Día más activo`,
      detail: `${maxDay.total} citas (+${percentAbove}% vs promedio)`,
      data: { day: maxDay.day, total: maxDay.total, avgTotal },
    });
  }
  
  // Día menos activo (oportunidad)
  const minDay = data.reduce((prev, current) => 
    current.total < prev.total ? current : prev
  );
  
  if (minDay.total < avgTotal * 0.7) {
    const percentBelow = ((avgTotal - minDay.total) / avgTotal * 100).toFixed(0);
    insights.push({
      type: 'info',
      category: 'day',
      message: `${dayNames[minDay.day]}: Oportunidad de promoción`,
      detail: `Solo ${minDay.total} citas (-${percentBelow}% vs promedio)`,
      data: { day: minDay.day, total: minDay.total, avgTotal },
    });
  }
  
  // Detectar preferencia por tipo de cita
  data.forEach(dayData => {
    const total = dayData.medicion + dayData.fitting;
    if (total > 0) {
      const medicionPercent = (dayData.medicion / total) * 100;
      
      if (medicionPercent > 65) {
        insights.push({
          type: 'info',
          category: 'day',
          message: `${dayNames[dayData.day]}: Fuerte preferencia Medición`,
          detail: `${medicionPercent.toFixed(0)}% de citas son mediciones`,
          data: { day: dayData.day, medicionPercent },
        });
      } else if (medicionPercent < 35) {
        insights.push({
          type: 'info',
          category: 'day',
          message: `${dayNames[dayData.day]}: Fuerte preferencia Fitting`,
          detail: `${(100 - medicionPercent).toFixed(0)}% de citas son fittings`,
          data: { day: dayData.day, fittingPercent: 100 - medicionPercent },
        });
      }
    }
  });
  
  // Detectar anomalías estadísticas
  const outliers = detectOutliers(totals);
  outliers.forEach(outlier => {
    const dayData = data[outlier.index];
    if (outlier.value > avgTotal + 2 * stdDevTotal) {
      insights.push({
        type: 'info',
        category: 'anomaly',
        message: `${dayNames[dayData.day]}: Actividad excepcional`,
        detail: `${outlier.value} citas (anomalía positiva)`,
        data: { day: dayData.day, value: outlier.value, avgTotal, stdDevTotal },
      });
    }
  });
  
  return insights;
}

/**
 * Calcular insights por hora del día
 */
export function calculateHourInsights(data: HourPattern[]): PatternInsight[] {
  const insights: PatternInsight[] = [];
  
  if (data.length === 0) return insights;
  
  const totals = data.map(d => d.total);
  const avgTotal = avg(totals);
  
  // Horas pico (top 3)
  const sortedByTotal = [...data].sort((a, b) => b.total - a.total);
  const topHours = sortedByTotal.slice(0, 3);
  
  if (topHours.length > 0 && topHours[0].total > avgTotal * 1.3) {
    const hoursStr = topHours.map(h => `${h.hour}:00`).join(', ');
    insights.push({
      type: 'peak',
      category: 'hour',
      message: `Horas pico: ${hoursStr}`,
      detail: `Concentran ${topHours.reduce((sum, h) => sum + h.total, 0)} citas`,
      data: { topHours: topHours.map(h => ({ hour: h.hour, total: h.total })) },
    });
  }
  
  // Detectar preferencia matutina vs vespertina
  const morningTotal = data
    .filter(h => h.hour >= 8 && h.hour < 14)
    .reduce((sum, h) => sum + h.total, 0);
    
  const afternoonTotal = data
    .filter(h => h.hour >= 14 && h.hour < 20)
    .reduce((sum, h) => sum + h.total, 0);
  
  const totalBusinessHours = morningTotal + afternoonTotal;
  
  if (totalBusinessHours > 0) {
    if (morningTotal > afternoonTotal * 1.3) {
      const percent = ((morningTotal / totalBusinessHours) * 100).toFixed(0);
      insights.push({
        type: 'trend',
        category: 'hour',
        message: `Fuerte preferencia matutina`,
        detail: `${percent}% de citas entre 8:00-14:00`,
        data: { morningTotal, afternoonTotal, percent },
      });
    } else if (afternoonTotal > morningTotal * 1.3) {
      const percent = ((afternoonTotal / totalBusinessHours) * 100).toFixed(0);
      insights.push({
        type: 'trend',
        category: 'hour',
        message: `Fuerte preferencia vespertina`,
        detail: `${percent}% de citas entre 14:00-20:00`,
        data: { morningTotal, afternoonTotal, percent },
      });
    }
  }
  
  // Horas valle (oportunidades)
  const bottomHours = sortedByTotal
    .slice(-3)
    .filter(h => h.hour >= 9 && h.hour <= 19); // Solo horario comercial
  
  if (bottomHours.length > 0 && bottomHours[0].total < avgTotal * 0.5) {
    const hoursStr = bottomHours.map(h => `${h.hour}:00`).join(', ');
    insights.push({
      type: 'info',
      category: 'hour',
      message: `Horarios con baja demanda: ${hoursStr}`,
      detail: `Oportunidad para promociones especiales`,
      data: { bottomHours: bottomHours.map(h => ({ hour: h.hour, total: h.total })) },
    });
  }
  
  return insights;
}

/**
 * Calcular insights de cancelaciones
 */
export function calculateCancellationInsights(
  data: { dayOfWeek?: number; hour?: number; total: number; cancelled: number; cancellationRate: number }[]
): PatternInsight[] {
  const insights: PatternInsight[] = [];
  
  if (data.length === 0) return insights;
  
  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const avgCancelRate = avg(data.map(d => d.cancellationRate));
  
  // Detectar momentos con alta cancelación
  data.forEach(item => {
    if (item.cancellationRate > avgCancelRate * 1.5 && item.total > 10) {
      let location = '';
      if (item.dayOfWeek !== undefined && item.hour !== undefined) {
        location = `${dayNames[item.dayOfWeek]} ${item.hour}:00`;
      } else if (item.dayOfWeek !== undefined) {
        location = dayNames[item.dayOfWeek];
      } else if (item.hour !== undefined) {
        location = `${item.hour}:00`;
      }
      
      const severity = item.cancellationRate > 40 ? 'Crítico' : 
                      item.cancellationRate > 25 ? 'Alto' : 'Medio';
      
      insights.push({
        type: 'warning',
        category: 'cancellation',
        message: `${location}: ${severity} índice de cancelación`,
        detail: `${item.cancellationRate.toFixed(1)}% canceladas (${item.cancelled}/${item.total})`,
        data: { ...item, severity, location },
      });
    }
  });
  
  // Si hay insights críticos, agregar recomendación
  const criticalInsights = insights.filter(i => 
    i.data.severity === 'Crítico' || i.data.cancellationRate > 35
  );
  
  if (criticalInsights.length > 0) {
    insights.push({
      type: 'warning',
      category: 'cancellation',
      message: `${criticalInsights.length} momento(s) con cancelación crítica`,
      detail: `Revisar política de confirmaciones y recordatorios`,
      data: { criticalCount: criticalInsights.length, criticalInsights },
    });
  }
  
  return insights;
}

/**
 * Calcular insights de crecimiento año tras año
 */
export function calculateGrowthInsights(
  currentYear: { total: number; byDay?: any[]; byHour?: any[] },
  previousYear: { total: number; byDay?: any[]; byHour?: any[] }
): PatternInsight[] {
  const insights: PatternInsight[] = [];
  
  if (!currentYear || !previousYear || previousYear.total === 0) {
    return insights;
  }
  
  // Crecimiento total
  const totalGrowth = ((currentYear.total - previousYear.total) / previousYear.total) * 100;
  
  if (Math.abs(totalGrowth) > 10) {
    insights.push({
      type: totalGrowth > 0 ? 'growth' : 'warning',
      category: 'growth',
      message: `${totalGrowth > 0 ? 'Crecimiento' : 'Descenso'} anual: ${Math.abs(totalGrowth).toFixed(0)}%`,
      detail: `${currentYear.total} citas (${totalGrowth > 0 ? '+' : ''}${currentYear.total - previousYear.total})`,
      data: { totalGrowth, currentTotal: currentYear.total, previousTotal: previousYear.total },
    });
  }
  
  // Crecimiento por segmentos horarios si disponible
  if (currentYear.byHour && previousYear.byHour) {
    const currentMorning = currentYear.byHour
      .filter((h: any) => h.hour >= 8 && h.hour < 14)
      .reduce((sum: number, h: any) => sum + (h.total || h.count || 0), 0);
      
    const previousMorning = previousYear.byHour
      .filter((h: any) => h.hour >= 8 && h.hour < 14)
      .reduce((sum: number, h: any) => sum + (h.total || h.count || 0), 0);
    
    if (previousMorning > 0) {
      const morningGrowth = ((currentMorning - previousMorning) / previousMorning) * 100;
      
      if (morningGrowth > 20) {
        insights.push({
          type: 'growth',
          category: 'growth',
          message: `Crecimiento matutino destacado: +${morningGrowth.toFixed(0)}%`,
          detail: `Horario 8:00-14:00 con fuerte tendencia al alza`,
          data: { segment: 'morning', growth: morningGrowth, currentMorning, previousMorning },
        });
      }
    }
    
    const currentAfternoon = currentYear.byHour
      .filter((h: any) => h.hour >= 14 && h.hour < 20)
      .reduce((sum: number, h: any) => sum + (h.total || h.count || 0), 0);
      
    const previousAfternoon = previousYear.byHour
      .filter((h: any) => h.hour >= 14 && h.hour < 20)
      .reduce((sum: number, h: any) => sum + (h.total || h.count || 0), 0);
    
    if (previousAfternoon > 0) {
      const afternoonGrowth = ((currentAfternoon - previousAfternoon) / previousAfternoon) * 100;
      
      if (afternoonGrowth > 20) {
        insights.push({
          type: 'growth',
          category: 'growth',
          message: `Crecimiento vespertino destacado: +${afternoonGrowth.toFixed(0)}%`,
          detail: `Horario 14:00-20:00 con fuerte tendencia al alza`,
          data: { segment: 'afternoon', growth: afternoonGrowth, currentAfternoon, previousAfternoon },
        });
      }
    }
  }
  
  return insights;
}

/**
 * Priorizar insights por relevancia
 */
export function prioritizeInsights(insights: PatternInsight[]): PatternInsight[] {
  const priorityOrder: Record<string, number> = {
    warning: 1,
    peak: 2,
    growth: 3,
    trend: 4,
    info: 5,
  };
  
  return [...insights].sort((a, b) => {
    const priorityA = priorityOrder[a.type] || 99;
    const priorityB = priorityOrder[b.type] || 99;
    return priorityA - priorityB;
  });
}

/**
 * Filtrar insights por categoría
 */
export function filterInsightsByCategory(
  insights: PatternInsight[],
  category: string
): PatternInsight[] {
  return insights.filter(i => i.category === category);
}

/**
 * Agrupar insights por tipo
 */
export function groupInsightsByType(insights: PatternInsight[]): Record<string, PatternInsight[]> {
  const grouped: Record<string, PatternInsight[]> = {
    warning: [],
    peak: [],
    growth: [],
    trend: [],
    info: [],
  };
  
  insights.forEach(insight => {
    if (grouped[insight.type]) {
      grouped[insight.type].push(insight);
    }
  });
  
  return grouped;
}
