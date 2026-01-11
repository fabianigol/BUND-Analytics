import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Endpoint para sincronización automática periódica de Shopify
 * 
 * Este endpoint está diseñado para ser llamado por Vercel Cron Jobs.
 * Requiere un secret en el header para seguridad.
 * 
 * Flujo:
 * 1. Sincroniza pedidos desde Shopify
 * 
 * Configuración:
 * - Vercel Cron: vercel.json (ejecuta cada 4 horas de 07:00 a 23:00)
 * - Variable de entorno: CRON_SECRET (debe coincidir con el header)
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar secret para seguridad
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('[Cron Shopify] CRON_SECRET no está configurado en variables de entorno')
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
      console.warn('[Cron Shopify] Intento de acceso no autorizado', {
        hasAuthHeader: !!authHeader,
        hasQuerySecret: !!request.nextUrl.searchParams.get('secret'),
      })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Cron Shopify] Iniciando sincronización automática periódica de Shopify...')
    const startTime = Date.now()

    const supabase = await createClient()

    // Verificar que Shopify esté conectado
    const { data: settingsData, error: settingsError } = await supabase
      .from('integration_settings')
      .select('settings, connected')
      .eq('integration', 'shopify')
      .single()

    if (settingsError || !settingsData || !(settingsData as any).connected) {
      console.error('[Cron Shopify] Shopify no está conectado')
      return NextResponse.json(
        { 
          success: false,
          error: 'Shopify no está conectado',
          message: 'Por favor, configura las credenciales de Shopify primero'
        },
        { status: 400 }
      )
    }

    const results = {
      orders: { success: false, error: null as string | null },
    }

    // Sincronizar pedidos
    try {
      console.log('[Cron Shopify] Sincronizando pedidos...')
      const ordersResponse = await fetch(
        `${request.nextUrl.origin}/api/sync/shopify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cron-secret': cronSecret, // Pasar el secret a los endpoints internos
          },
        }
      )

      if (!ordersResponse.ok) {
        const errorData = await ordersResponse.json()
        throw new Error(errorData.error || 'Error sincronizando pedidos')
      }

      const ordersData = await ordersResponse.json()
      results.orders.success = true
      console.log(`[Cron Shopify] Pedidos sincronizados: ${ordersData.records_synced || 0} registros`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      results.orders.error = errorMessage
      console.error('[Cron Shopify] Error sincronizando pedidos:', errorMessage)
    }

    const duration = Date.now() - startTime
    const allSuccess = results.orders.success

    console.log(`[Cron Shopify] Sincronización completada en ${duration}ms`)

    return NextResponse.json({
      success: allSuccess,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      results: {
        orders: {
          success: results.orders.success,
          error: results.orders.error,
        },
      },
    }, {
      status: allSuccess ? 200 : 207, // 207 = Multi-Status (algunos pasos fallaron)
    })
  } catch (error) {
    console.error('[Cron Shopify] Error general:', error)
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
