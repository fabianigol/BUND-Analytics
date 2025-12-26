import { NextRequest, NextResponse } from 'next/server'
import { createShopifyServiceFromConfig } from '@/lib/integrations/shopify'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { subDays, parseISO, startOfMonth } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Obtener credenciales desde Supabase
    const { data: settingsData, error: settingsError } = await supabase
      .from('integration_settings')
      .select('settings, connected, created_at')
      .eq('integration', 'shopify')
      .single()
    const settings = settingsData as Database['public']['Tables']['integration_settings']['Row'] | null

    if (settingsError || !settings || !(settings as any).connected) {
      return NextResponse.json(
        { error: 'Shopify no está conectado. Por favor, configura las credenciales primero.' },
        { status: 400 }
      )
    }

    const { shop_domain, access_token } = (settings.settings as any) || {}

    if (!shop_domain || !access_token) {
      return NextResponse.json(
        { error: 'Credenciales de Shopify incompletas. Por favor, reconecta la integración.' },
        { status: 400 }
      )
    }

    // Crear servicio
    const shopifyService = createShopifyServiceFromConfig({
      shopDomain: shop_domain,
      accessToken: access_token,
    })

    // Crear log de sincronización
    const { data: syncLogData, error: logError } = await supabase
      .from('sync_logs')
      // @ts-ignore
      .insert({
        integration: 'shopify',
        status: 'running',
        records_synced: 0,
      } as any)
      .select()
      .single()
    const syncLog = syncLogData as Database['public']['Tables']['sync_logs']['Row'] | null

    if (logError) {
      console.error('Error creating sync log:', logError)
    }

    try {
      console.log('[Shopify Sync] Starting sync process...')

      // Calcular rango de fechas: desde el día 1 del mes actual hasta hoy
      // Esto asegura que siempre tengamos los datos del mes completo
      const today = new Date()
      const year = today.getFullYear()
      const month = today.getMonth() // 0-11
      
      // Crear fecha del primer día del mes actual en formato ISO (YYYY-MM-DD)
      // Esto evita problemas de zona horaria
      const firstDayISO = `${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00.000Z`
      const todayISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T23:59:59.999Z`
      
      const syncStartDate = parseISO(firstDayISO)
      const syncEndDate = parseISO(todayISO)
      const connectionDate = settings.created_at ? parseISO(settings.created_at) : today

      console.log(`[Shopify Sync] ==========================================`)
      console.log(`[Shopify Sync] Starting sync process...`)
      console.log(`[Shopify Sync] Today: ${today.toISOString()}`)
      console.log(`[Shopify Sync] Year: ${year}, Month: ${month + 1}`)
      console.log(`[Shopify Sync] First day ISO: ${firstDayISO}`)
      console.log(`[Shopify Sync] Today ISO: ${todayISO}`)
      console.log(`[Shopify Sync] Sync start date: ${syncStartDate.toISOString()}`)
      console.log(`[Shopify Sync] Sync end date: ${syncEndDate.toISOString()}`)
      console.log(`[Shopify Sync] Connection date: ${connectionDate.toISOString()}`)
      console.log(`[Shopify Sync] ==========================================`)

      // Obtener todos los pedidos con paginación
      console.log('[Shopify Sync] Fetching orders...')
      const allOrders = await shopifyService.getAllOrders({
        status: 'any',
        createdAtMin: syncStartDate.toISOString(),
        createdAtMax: syncEndDate.toISOString(),
      })
      console.log(`[Shopify Sync] Found ${allOrders.length} orders`)

      // Transformar y guardar pedidos en BD
      let ordersProcessed = 0
      let ordersUpdated = 0
      let ordersInserted = 0

      for (const order of allOrders) {
        const transformedOrder = shopifyService.transformOrder(order)
        
        const { error: upsertError } = await supabase
          .from('shopify_orders')
          .upsert({
            id: order.id.toString(),
            order_number: transformedOrder.order_number,
            total_price: transformedOrder.total_price,
            subtotal_price: transformedOrder.subtotal_price,
            total_tax: transformedOrder.total_tax,
            currency: transformedOrder.currency,
            financial_status: transformedOrder.financial_status,
            fulfillment_status: transformedOrder.fulfillment_status,
            customer_email: transformedOrder.customer_email,
            customer_name: transformedOrder.customer_name,
            line_items: transformedOrder.line_items as any,
            created_at: transformedOrder.created_at,
            processed_at: transformedOrder.processed_at,
            updated_at: new Date().toISOString(),
          } as any, {
            onConflict: 'id',
          })

        if (upsertError) {
          console.error(`[Shopify Sync] Error upserting order ${order.id}:`, upsertError)
        } else {
          ordersProcessed++
          // No podemos distinguir fácilmente entre insert y update con upsert
          // Asumimos que si no hay error, fue exitoso
        }
      }

      console.log(`[Shopify Sync] Processed ${ordersProcessed} orders`)

      // Actualizar log de sincronización
      if (syncLog) {
        await supabase
          .from('sync_logs')
          // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
          .update({
            status: 'success',
            records_synced: ordersProcessed,
            completed_at: new Date().toISOString(),
          } as any)
          .eq('id', syncLog.id)
      }

      // Actualizar last_sync en integration_settings
      await supabase
        .from('integration_settings')
        // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
        .update({
          last_sync: new Date().toISOString(),
        } as any)
        .eq('integration', 'shopify')

      return NextResponse.json({
        success: true,
        message: `Sincronizados ${ordersProcessed} pedidos de Shopify`,
        records_synced: ordersProcessed,
        orders_inserted: ordersInserted,
        orders_updated: ordersUpdated,
      })
    } catch (syncError: any) {
      console.error('[Shopify Sync] Error during sync:', syncError)

      // Actualizar log de sincronización con error
      if (syncLog) {
        await supabase
          .from('sync_logs')
          // @ts-ignore - TypeScript can't infer the correct type for chained Supabase queries
          .update({
            status: 'error',
            error_message: syncError?.message || String(syncError),
            completed_at: new Date().toISOString(),
          } as any)
          .eq('id', syncLog.id)
      }

      throw syncError
    }
  } catch (error: any) {
    console.error('Shopify sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync Shopify data', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Verificar si Shopify está configurado
    const { data: settingsData } = await supabase
      .from('integration_settings')
      .select('connected, settings')
      .eq('integration', 'shopify')
      .single()

    const isConfigured = !!(settingsData && (settingsData as any).connected && 
      (settingsData as any).settings?.shop_domain && 
      (settingsData as any).settings?.access_token)

    return NextResponse.json({ 
      message: 'Use POST to trigger Shopify sync',
      configured: isConfigured,
    })
  } catch (error) {
    return NextResponse.json({ 
      message: 'Use POST to trigger Shopify sync',
      configured: false,
    })
  }
}
