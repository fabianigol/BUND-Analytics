import { redirect } from 'next/navigation'

/**
 * Página de Ventas España
 * Redirige a /ventas con el parámetro country=ES
 */
export default function VentasEspanaPage() {
  // Redirigir a la página principal de ventas con el parámetro de país
  redirect('/ventas?country=ES')
}
