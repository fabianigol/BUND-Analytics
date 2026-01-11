import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCurrencyMXN(amount: number): string {
  // Formato: $1,234 MXN
  const formatted = new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  return `$${formatted} MXN`
}

export function formatCurrencyByCountry(amount: number, country: 'ES' | 'MX'): string {
  if (country === 'MX') {
    return formatCurrencyMXN(amount)
  }
  return formatCurrency(amount) // EUR por defecto
}

/**
 * Tasa de conversión MXN a EUR
 * Tipo de cambio aproximado: 1 EUR = 21.28 MXN (o 1 MXN = 0.047 EUR)
 * Actualizar periódicamente según el tipo de cambio real
 */
export const MXN_TO_EUR_RATE = 0.047

/**
 * Convierte MXN a EUR y formatea
 */
export function convertMXNtoEUR(amountMXN: number): string {
  const amountEUR = amountMXN * MXN_TO_EUR_RATE
  return formatCurrency(amountEUR, 'EUR')
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-ES').format(num)
}

export function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatDate(date: string | Date, formatStr: string = 'dd MMM yyyy'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return format(dateObj, formatStr, { locale: es })
}

export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return format(dateObj, "dd MMM yyyy 'a las' HH:mm", { locale: es })
}

export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(dateObj, { addSuffix: true, locale: es })
}

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }
  
  return `${minutes}m ${remainingSeconds}s`
}

export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export function getChangeIndicator(change: number): 'positive' | 'negative' | 'neutral' {
  if (change > 0) return 'positive'
  if (change < 0) return 'negative'
  return 'neutral'
}

