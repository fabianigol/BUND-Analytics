import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

/**
 * Endpoint para sincronización automática diaria de Acuity
 * 
 * Este endpoint está diseñado para ser llamado por Vercel Cron Jobs.
 * Requiere un secret en el header para seguridad.
 * 
 * Flujo:
 * 1. Sincroniza citas desde Acuity
 * 2. Sincroniza disponibilidad desde Acuity
 * 3. Crea snapshot del día anterior
 * 
 * Configuración:
 * - Vercel Cron: vercel.json (ejecuta a las 2:00 AM UTC diariamente)
 * - Variable de entorno: CRON_SECRET (debe coincidir con el header)
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar secret para seguridad
    // Vercel Cron envía el secret en el header 'authorization' como 'Bearer <secret>'
    // También puede venir como query param 'secret' (útil para pruebas manuales)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('[Cron Sync] CRON_SECRET no está configurado en variables de entorno')
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    // Verificar que el secret coincida
    const providedSecret = 
      authHeader?.replace('Bearer ', '') ||
      request.nextUrl.searchParams.get('secret')

    if (!providedSecret || providedSecret !== cronSecret) {
      console.warn('[Cron Sync] Intento de acceso no autorizado', {
        hasAuthHeader: !!authHeader,
        hasQuerySecret: !!request.nextUrl.searchParams.get('secret'),
      })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Cron Sync] Iniciando sincronización automática diaria de Acuity...')
    const startTime = Date.now()

    const supabase = await createClient()

    // Verificar que Acuity esté conectado
    const { data: settingsData, error: settingsError } = await supabase
      .from('integration_settings')
      .select('settings, connected')
      .eq('integration', 'acuity')
      .single()

    if (settingsError || !settingsData || !(settingsData as any).connected) {
      console.error('[Cron Sync] Acuity no está conectado')
      return NextResponse.json(
        { 
          success: false,
          error: 'Acuity no está conectado',
          message: 'Por favor, configura las credenciales de Acuity primero'
        },
        { status: 400 }
      )
    }

    const results = {
      appointments: { success: false, error: null as string | null },
      availability: { success: false, error: null as string | null },
      snapshot: { success: false, error: null as string | null },
    }

    // 1. Sincronizar citas
    try {
      console.log('[Cron Sync] Paso 1/3: Sincronizando citas...')
      const appointmentsResponse = await fetch(
        `${request.nextUrl.origin}/api/sync/acuity`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Nota: Los endpoints internos no requieren autenticación de usuario
            // porque ya estamos autenticados por el cron secret
          },
          body: JSON.stringify({}),
        }
      )

      if (!appointmentsResponse.ok) {
        const errorData = await appointmentsResponse.json()
        throw new Error(errorData.error || 'Error sincronizando citas')
      }

      const appointmentsData = await appointmentsResponse.json()
      results.appointments.success = true
      console.log(`[Cron Sync] Citas sincronizadas: ${appointmentsData.records_synced || 0} registros`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      results.appointments.error = errorMessage
      console.error('[Cron Sync] Error sincronizando citas:', errorMessage)
      // Continuar con los siguientes pasos aunque falle este
    }

    // Esperar un poco antes de la siguiente sincronización
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 2. Sincronizar disponibilidad
    try {
      console.log('[Cron Sync] Paso 2/3: Sincronizando disponibilidad...')
      const availabilityResponse = await fetch(
        `${request.nextUrl.origin}/api/sync/acuity/availability`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ maxDays: 21 }),
        }
      )

      if (!availabilityResponse.ok) {
        const errorData = await availabilityResponse.json()
        throw new Error(errorData.error || 'Error sincronizando disponibilidad')
      }

      const availabilityData = await availabilityResponse.json()
      results.availability.success = true
      console.log(`[Cron Sync] Disponibilidad sincronizada: ${availabilityData.records_saved || 0} registros`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      results.availability.error = errorMessage
      console.error('[Cron Sync] Error sincronizando disponibilidad:', errorMessage)
      // Continuar con el snapshot aunque falle este
    }

    // Esperar un poco antes del snapshot
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 3. Crear snapshot del día anterior
    try {
      console.log('[Cron Sync] Paso 3/3: Creando snapshot del día anterior...')
      const snapshotResponse = await fetch(
        `${request.nextUrl.origin}/api/sync/acuity/availability/snapshot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ periodType: 'daily' }),
        }
      )

      if (!snapshotResponse.ok) {
        const errorData = await snapshotResponse.json()
        throw new Error(errorData.error || 'Error creando snapshot')
      }

      const snapshotData = await snapshotResponse.json()
      results.snapshot.success = true
      console.log(`[Cron Sync] Snapshot creado: ${snapshotData.records_created || 0} registros`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      results.snapshot.error = errorMessage
      console.error('[Cron Sync] Error creando snapshot:', errorMessage)
    }

    const duration = Date.now() - startTime
    const allSuccess = results.appointments.success && results.availability.success && results.snapshot.success

    console.log(`[Cron Sync] Sincronización completada en ${duration}ms`)

    return NextResponse.json({
      success: allSuccess,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      results: {
        appointments: {
          success: results.appointments.success,
          error: results.appointments.error,
        },
        availability: {
          success: results.availability.success,
          error: results.availability.error,
        },
        snapshot: {
          success: results.snapshot.success,
          error: results.snapshot.error,
        },
      },
    }, {
      status: allSuccess ? 200 : 207, // 207 = Multi-Status (algunos pasos fallaron)
    })
  } catch (error) {
    console.error('[Cron Sync] Error general:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error inesperado en sincronización automática',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

