import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  isWeekend,
  differenceInDays,
  addDays,
  isSameDay,
  startOfWeek,
  endOfWeek,
  getDay
} from 'date-fns'
import { es } from 'date-fns/locale'

export type CalendarLayer = 'marketing' | 'operations' | 'pr' | 'retail' | 'product' | 'personal' | 'otros' | 'tour'

export interface CalendarEvent {
  id: string
  user_id: string
  title: string
  description: string | null
  start_date: string
  end_date: string
  layer: CalendarLayer
  attachments: any
  created_at: string
  updated_at: string
}

// Paleta de colores para cada capa
export const LAYER_COLORS: Record<CalendarLayer, string> = {
  marketing: '#F97316',     // Naranja
  operations: '#3B82F6',    // Azul
  pr: '#A855F7',            // Morado
  retail: '#10B981',        // Verde
  product: '#EAB308',       // Amarillo
  personal: '#6B7280',      // Gris
  otros: '#EC4899',         // Rosa
  tour: '#06B6D4',          // Cyan
}

// Nombres legibles para cada capa
export const LAYER_NAMES: Record<CalendarLayer, string> = {
  marketing: 'Marketing',
  operations: 'Operaciones',
  pr: 'PR',
  retail: 'Retail',
  product: 'Producto',
  personal: 'Personal',
  otros: 'Otros',
  tour: 'Tour',
}

/**
 * Obtiene el color de una capa
 */
export function getLayerColor(layer: CalendarLayer): string {
  return LAYER_COLORS[layer]
}

/**
 * Obtiene el nombre legible de una capa
 */
export function getLayerName(layer: CalendarLayer): string {
  return LAYER_NAMES[layer]
}

/**
 * Genera todos los días de un mes específico
 */
export function getMonthDays(year: number, month: number): Date[] {
  const start = startOfMonth(new Date(year, month))
  const end = endOfMonth(new Date(year, month))
  return eachDayOfInterval({ start, end })
}

/**
 * Genera el grid completo de un mes incluyendo días de padding
 * para que el calendario siempre comience en lunes
 */
export function getMonthGrid(year: number, month: number): Date[] {
  const firstDay = startOfMonth(new Date(year, month))
  const lastDay = endOfMonth(new Date(year, month))
  
  // Obtener el inicio de la semana (lunes) para el primer día del mes
  const startDate = startOfWeek(firstDay, { weekStartsOn: 1 })
  
  // Obtener el final de la semana (domingo) para el último día del mes
  const endDate = endOfWeek(lastDay, { weekStartsOn: 1 })
  
  return eachDayOfInterval({ start: startDate, end: endDate })
}

/**
 * Verifica si una fecha es fin de semana (sábado o domingo)
 */
export function isWeekendDay(date: Date): boolean {
  return isWeekend(date)
}

/**
 * Calcula la duración en días de un evento
 */
export function getEventDuration(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return differenceInDays(end, start) + 1 // +1 para incluir el día final
}

/**
 * Formatea una fecha para mostrar en el calendario
 */
export function formatCalendarDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'd', { locale: es })
}

/**
 * Formatea una fecha completa para mostrar en detalles
 */
export function formatFullDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, "d 'de' MMMM 'de' yyyy", { locale: es })
}

/**
 * Formatea un rango de fechas
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  if (isSameDay(start, end)) {
    return formatFullDate(start)
  }
  
  return `${formatFullDate(start)} - ${formatFullDate(end)}`
}

/**
 * Verifica si un evento ocurre en una fecha específica
 */
export function eventOccursOnDate(event: CalendarEvent, date: Date): boolean {
  const eventStart = new Date(event.start_date)
  const eventEnd = new Date(event.end_date)
  const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  // Normalizar las fechas del evento a medianoche
  eventStart.setHours(0, 0, 0, 0)
  eventEnd.setHours(0, 0, 0, 0)
  
  return checkDate >= eventStart && checkDate <= eventEnd
}

/**
 * Obtiene todos los eventos que ocurren en una fecha específica
 */
export function getEventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  return events.filter(event => eventOccursOnDate(event, date))
}

/**
 * Obtiene el nombre del mes en español
 */
export function getMonthName(month: number): string {
  const date = new Date(2000, month, 1)
  return format(date, 'MMMM', { locale: es })
}

/**
 * Obtiene los nombres de los días de la semana (abreviados)
 * Comienza en lunes
 */
export function getWeekdayNames(): string[] {
  return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
}

/**
 * Verifica si una fecha pertenece al mes actual del calendario
 */
export function isDateInMonth(date: Date, year: number, month: number): boolean {
  return date.getMonth() === month && date.getFullYear() === year
}

/**
 * Calcula cuántos días de un evento multi-día aparecen en una semana específica
 * desde una fecha de inicio dada
 */
export function getEventDaysInWeek(
  event: CalendarEvent,
  weekStartDate: Date,
  currentMonth: number
): number {
  const eventStart = new Date(event.start_date)
  const eventEnd = new Date(event.end_date)
  
  // Normalizar fechas
  eventStart.setHours(0, 0, 0, 0)
  eventEnd.setHours(0, 0, 0, 0)
  weekStartDate.setHours(0, 0, 0, 0)
  
  const weekEnd = addDays(weekStartDate, 6)
  
  // Encontrar el rango de intersección
  const intersectStart = eventStart > weekStartDate ? eventStart : weekStartDate
  const intersectEnd = eventEnd < weekEnd ? eventEnd : weekEnd
  
  if (intersectStart > intersectEnd) {
    return 0
  }
  
  // Contar solo días que pertenecen al mes actual
  let daysInMonth = 0
  let currentDate = new Date(intersectStart)
  
  while (currentDate <= intersectEnd) {
    if (currentDate.getMonth() === currentMonth) {
      daysInMonth++
    }
    currentDate = addDays(currentDate, 1)
  }
  
  return daysInMonth
}

/**
 * Verifica si un evento comienza en una fecha específica
 */
export function eventStartsOnDate(event: CalendarEvent, date: Date): boolean {
  const eventStart = new Date(event.start_date)
  eventStart.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return isSameDay(eventStart, date)
}

/**
 * Convierte una fecha Date a string en formato YYYY-MM-DD
 */
export function dateToString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Convierte un string en formato YYYY-MM-DD a Date
 */
export function stringToDate(dateString: string): Date {
  return new Date(dateString)
}

/**
 * Obtiene todas las capas disponibles
 */
export function getAllLayers(): CalendarLayer[] {
  return ['marketing', 'operations', 'pr', 'retail', 'product', 'otros', 'tour', 'personal']
}

/**
 * Filtra eventos por capas visibles
 */
export function filterEventsByLayers(
  events: CalendarEvent[],
  visibleLayers: CalendarLayer[]
): CalendarEvent[] {
  return events.filter(event => visibleLayers.includes(event.layer))
}

