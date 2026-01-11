import { format, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export interface WeekRange {
  weekNumber: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
}

/**
 * Divide un mes en semanas calendario (lunes a domingo)
 * - La primera semana empieza el primer día del mes (aunque no sea lunes) y termina en domingo
 * - Las semanas intermedias son siempre lunes-domingo
 * - La última semana termina en el último día del mes (aunque no sea domingo)
 * @param year Año (ej: 2026)
 * @param month Mes (1-12)
 * @returns Array de semanas del mes
 */
export function getWeeksOfMonth(year: number, month: number): WeekRange[] {
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = endOfMonth(firstDayOfMonth);
  
  const weeks: WeekRange[] = [];
  let weekNumber = 1;
  let currentDate = new Date(firstDayOfMonth);
  
  while (currentDate <= lastDayOfMonth) {
    const weekStart = new Date(currentDate);
    
    // Calcular el fin de semana (domingo)
    // getDay() devuelve 0=domingo, 1=lunes, 2=martes, ..., 6=sábado
    const currentDayOfWeek = currentDate.getDay();
    
    // Días hasta el próximo domingo
    // Si es domingo (0), ir al mismo día. Si es lunes (1), faltan 6 días, etc.
    const daysUntilSunday = currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek;
    
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(currentDate.getDate() + daysUntilSunday);
    
    // Ajustar si el fin de semana excede el fin de mes
    const actualWeekEnd = weekEnd > lastDayOfMonth ? lastDayOfMonth : weekEnd;
    
    weeks.push({
      weekNumber,
      weekLabel: `Semana ${weekNumber} (${format(weekStart, 'd', { locale: es })}-${format(actualWeekEnd, 'd MMM', { locale: es })})`,
      startDate: format(weekStart, 'yyyy-MM-dd'),
      endDate: format(actualWeekEnd, 'yyyy-MM-dd'),
    });
    
    // Siguiente semana empieza el lunes siguiente
    currentDate = new Date(actualWeekEnd);
    currentDate.setDate(currentDate.getDate() + 1);
    weekNumber++;
  }
  
  return weeks;
}

/**
 * Obtiene el nombre corto del mes en español
 * @param month Mes (1-12)
 * @returns Nombre corto del mes (Ene, Feb, etc.)
 */
export function getMonthLabel(month: number): string {
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return monthNames[month - 1] || '';
}
