/**
 * Utilidades para calcular períodos comparativos (mes anterior, año anterior)
 * para la funcionalidad de comparativas de campañas
 */

/**
 * Calcula el período del mes anterior manteniendo el mismo número de días
 * @param startDate Fecha de inicio en formato YYYY-MM-DD
 * @param endDate Fecha de fin en formato YYYY-MM-DD
 * @returns Objeto con start y end del mes anterior
 */
export function calculatePreviousMonthPeriod(
  startDate: string,
  endDate: string
): { start: string; end: string } {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  // Calcular número de días del período
  const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  
  // Calcular fecha de inicio del mes anterior
  const prevStart = new Date(start)
  prevStart.setMonth(prevStart.getMonth() - 1)
  
  // Calcular fecha de fin del mes anterior (mismo número de días después)
  const prevEnd = new Date(prevStart)
  prevEnd.setDate(prevEnd.getDate() + daysDiff)
  
  // Manejar casos edge: si el día no existe en el mes anterior (ej: 31 de enero -> 31 de febrero)
  // Ajustar al último día del mes anterior
  if (prevEnd.getMonth() !== prevStart.getMonth()) {
    // Si prevEnd se pasó al siguiente mes, ajustar al último día del mes anterior
    prevEnd.setDate(0) // Esto establece el último día del mes anterior
  }
  
  return {
    start: formatDate(prevStart),
    end: formatDate(prevEnd),
  }
}

/**
 * Calcula el período del año anterior manteniendo el mismo rango de fechas
 * @param startDate Fecha de inicio en formato YYYY-MM-DD
 * @param endDate Fecha de fin en formato YYYY-MM-DD
 * @returns Objeto con start y end del año anterior
 */
export function calculatePreviousYearPeriod(
  startDate: string,
  endDate: string
): { start: string; end: string } {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  // Calcular número de días del período
  const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  
  // Calcular fecha de inicio del año anterior
  const prevStart = new Date(start)
  prevStart.setFullYear(prevStart.getFullYear() - 1)
  
  // Calcular fecha de fin del año anterior (mismo número de días después)
  const prevEnd = new Date(prevStart)
  prevEnd.setDate(prevEnd.getDate() + daysDiff)
  
  // Manejar años bisiestos: si el año anterior no tiene 29 de febrero pero el actual sí
  // Ajustar al 28 de febrero si es necesario
  if (start.getMonth() === 1 && start.getDate() === 29) {
    // Si la fecha de inicio es 29 de febrero
    const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    if (!isLeapYear(prevStart.getFullYear())) {
      // Si el año anterior no es bisiesto, usar 28 de febrero
      prevStart.setDate(28)
    }
  }
  
  return {
    start: formatDate(prevStart),
    end: formatDate(prevEnd),
  }
}

/**
 * Formatea una fecha a formato YYYY-MM-DD
 * @param date Objeto Date
 * @returns String en formato YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}


