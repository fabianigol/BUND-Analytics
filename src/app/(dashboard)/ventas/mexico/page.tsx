import { redirect } from 'next/navigation'

/**
 * Página de Ventas México
 * Redirige a /ventas con el parámetro country=MX
 */
export default function VentasMexicoPage() {
  // Redirigir a la página principal de ventas con el parámetro de país
  redirect('/ventas?country=MX')
}
