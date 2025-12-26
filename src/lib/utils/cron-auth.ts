import { NextRequest } from 'next/server'

/**
 * Verifica si una request viene de un cron job autorizado
 * 
 * @param request - NextRequest object
 * @returns true si la request está autorizada, false en caso contrario
 */
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return false
  }

  // Vercel Cron envía el secret en diferentes lugares:
  // 1. Header 'authorization' como 'Bearer <secret>'
  // 2. Query param 'secret'
  // 3. Header personalizado 'x-cron-secret'
  const authHeader = request.headers.get('authorization')
  const providedSecret = 
    authHeader?.replace('Bearer ', '') ||
    request.nextUrl.searchParams.get('secret') ||
    request.headers.get('x-cron-secret')

  return providedSecret === cronSecret
}

