import { NextRequest, NextResponse } from 'next/server'
import { 
  createShopifyServiceFromConfig, 
  createShopifyServiceByCountryAsync 
} from '@/lib/integrations/shopify'
import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database'
import { subDays, parseISO, startOfMonth } from 'date-fns'
import { isAuthorizedCronRequest } from '@/lib/utils/cron-auth'
import { getShopifyAccessTokenMX, isShopifyOAuthConfiguredMX } from '@/lib/integrations/shopify-oauth'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Obtener parámetro country del query string
    const searchParams = request.nextUrl.searchParams
    const country = (searchParams.get('country') || 'ES').toUpperCase() as 'ES' | 'MX'

    // Validar country
    if (country !== 'ES' && country !== 'MX') {
      return NextResponse.json(
        { error: 'Invalid country parameter. Use ES or MX.' },
        { status: 400 }
      )
    }

    console.log(`[Shopify Sync] Starting sync for country: ${country}`)

    // Permitir acceso desde cron jobs autorizados sin autenticación de usuario
    const isCronRequest = isAuthorizedCronRequest(request)

    // Verificar autenticación solo si NO es un cron job autorizado
    if (!isCronRequest) {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized', details: 'User not authenticated' },
          { status: 401 }
        )
      }
    }

    // Determinar nombre de integración según país
    const integrationName = country === 'MX' ? 'shopify_mx' : 'shopify_es'

    // Obtener credenciales desde Supabase
    const { data: settingsData, error: settingsError } = await supabase
      .from('integration_settings')
      .select('settings, connected, created_at')
      .eq('integration', integrationName)
      .single()
    const settings = settingsData as Database['public']['Tables']['integration_settings']['Row'] | null

    if (settingsError || !settings || !(settings as any).connected) {
      // Intentar con legacy integration name 'shopify' si es ES y no encuentra shopify_es
      if (country === 'ES') {
        const { data: legacySettingsData, error: legacyError } = await supabase
          .from('integration_settings')
          .select('settings, connected, created_at')
          .eq('integration', 'shopify')
          .single()
        
        if (!legacyError && legacySettingsData && (legacySettingsData as any).connected) {
          const { shop_domain, access_token } = ((legacySettingsData as any).settings as any) || {}
          if (shop_domain && access_token) {
            return syncShopifyData(supabase, country, shop_domain, access_token, (legacySettingsData as any).created_at, 'shopify')
          }
        }
      }

      return NextResponse.json(
        { error: `Shopify ${country} no está conectado. Por favor, configura las credenciales primero.` },
        { status: 400 }
      )
    }

    const { shop_domain, access_token } = (settings.settings as any) || {}

    if (!shop_domain) {
      return NextResponse.json(
        { error: `Credenciales de Shopify ${country} incompletas. Por favor, reconecta la integración.` },
        { status: 400 }
      )
    }

    // Para México: Intentar obtener token via OAuth si está configurado
    let finalAccessToken = access_token
    if (country === 'MX' && isShopifyOAuthConfiguredMX()) {
      console.log(`[Shopify Sync MX] Using OAuth to get access token...`)
      try {
        const oauthToken = await getShopifyAccessTokenMX()
        if (oauthToken) {
          finalAccessToken = oauthToken
          console.log(`[Shopify Sync MX] Successfully obtained OAuth token`)
        }
      } catch (oauthError: any) {
        console.error(`[Shopify Sync MX] OAuth failed, falling back to stored token:`, oauthError)
        // Continuar con access_token almacenado si existe
      }
    }

    if (!finalAccessToken) {
      return NextResponse.json(
        { error: `No se pudo obtener access token para Shopify ${country}. Por favor, reconecta la integración.` },
        { status: 400 }
      )
    }

    return await syncShopifyData(supabase, country, shop_domain, finalAccessToken, settings.created_at, integrationName)
  } catch (error: any) {
    console.error('Shopify sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync Shopify data', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

async function syncShopifyData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  country: 'ES' | 'MX',
  shop_domain: string,
  access_token: string,
  created_at: string | null,
  integrationName: string
) {
  // Crear servicio
  console.log(`[Shopify Sync ${country}] Creating Shopify service with domain: ${shop_domain}`)
  const shopifyService = createShopifyServiceFromConfig({
    shopDomain: shop_domain,
    accessToken: access_token,
  })
  
  if (!shopifyService) {
    throw new Error(`Failed to create Shopify service for ${country}. Check credentials.`)
  }

  // Crear log de sincronización
  const { data: syncLogData, error: logError } = await supabase
    .from('sync_logs')
    // @ts-ignore
    .insert({
      integration: integrationName,
      status: 'running',
      records_synced: 0,
    } as any)
    .select()
    .single()
  const syncLog = syncLogData as Database['public']['Tables']['sync_logs']['Row'] | null

  if (logError) {
    console.error(`[Shopify Sync ${country}] Error creating sync log:`, logError)
  }

  try {
    console.log(`[Shopify Sync ${country}] Starting sync process...`)

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
    const connectionDate = created_at ? parseISO(created_at) : today

    console.log(`[Shopify Sync ${country}] ==========================================`)
    console.log(`[Shopify Sync ${country}] Country: ${country}`)
    console.log(`[Shopify Sync ${country}] Today: ${today.toISOString()}`)
    console.log(`[Shopify Sync ${country}] Year: ${year}, Month: ${month + 1}`)
    console.log(`[Shopify Sync ${country}] First day ISO: ${firstDayISO}`)
    console.log(`[Shopify Sync ${country}] Today ISO: ${todayISO}`)
    console.log(`[Shopify Sync ${country}] Sync start date: ${syncStartDate.toISOString()}`)
    console.log(`[Shopify Sync ${country}] Sync end date: ${syncEndDate.toISOString()}`)
    console.log(`[Shopify Sync ${country}] Connection date: ${connectionDate.toISOString()}`)
    console.log(`[Shopify Sync ${country}] ==========================================`)

    // Obtener todos los pedidos con paginación
    console.log(`[Shopify Sync ${country}] Fetching orders from Shopify API...`)
    let allOrders: any[]
    try {
      allOrders = await shopifyService.getAllOrders({
        status: 'any',
        createdAtMin: syncStartDate.toISOString(),
        createdAtMax: syncEndDate.toISOString(),
      })
      console.log(`[Shopify Sync ${country}] Found ${allOrders.length} orders`)
    } catch (fetchError: any) {
      console.error(`[Shopify Sync ${country}] Error fetching orders from Shopify API:`, fetchError)
      throw new Error(`Failed to fetch orders from Shopify: ${fetchError.message || String(fetchError)}`)
    }

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
          tags: transformedOrder.tags || null, // Guardar tags como array o null
          country, // Agregar país
          created_at: transformedOrder.created_at,
          processed_at: transformedOrder.processed_at,
          updated_at: new Date().toISOString(),
        } as any, {
          onConflict: 'id',
        })

      if (upsertError) {
        console.error(`[Shopify Sync ${country}] Error upserting order ${order.id}:`, upsertError)
      } else {
        ordersProcessed++
        // No podemos distinguir fácilmente entre insert y update con upsert
        // Asumimos que si no hay error, fue exitoso
      }
    }

    console.log(`[Shopify Sync ${country}] Processed ${ordersProcessed} orders`)

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
      .eq('integration', integrationName)

    return NextResponse.json({
      success: true,
      country,
      message: `Sincronizados ${ordersProcessed} pedidos de Shopify ${country}`,
      records_synced: ordersProcessed,
      orders_inserted: ordersInserted,
      orders_updated: ordersUpdated,
    })
  } catch (syncError: any) {
    console.error(`[Shopify Sync ${country}] Error during sync:`, syncError)

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
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Obtener parámetro country
    const searchParams = request.nextUrl.searchParams
    const country = (searchParams.get('country') || 'ES').toUpperCase() as 'ES' | 'MX'

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Determinar nombre de integración según país
    const integrationName = country === 'MX' ? 'shopify_mx' : 'shopify_es'

    // Verificar si Shopify está configurado
    const { data: settingsData } = await supabase
      .from('integration_settings')
      .select('connected, settings')
      .eq('integration', integrationName)
      .single()

    let isConfigured = !!(settingsData && (settingsData as any).connected && 
      (settingsData as any).settings?.shop_domain && 
      (settingsData as any).settings?.access_token)

    // Fallback a 'shopify' legacy para ES
    if (!isConfigured && country === 'ES') {
      const { data: legacySettingsData } = await supabase
        .from('integration_settings')
        .select('connected, settings')
        .eq('integration', 'shopify')
        .single()

      isConfigured = !!(legacySettingsData && (legacySettingsData as any).connected && 
        (legacySettingsData as any).settings?.shop_domain && 
        (legacySettingsData as any).settings?.access_token)
    }

    return NextResponse.json({ 
      message: `Use POST to trigger Shopify sync for ${country}`,
      country,
      configured: isConfigured,
    })
  } catch (error) {
    return NextResponse.json({ 
      message: 'Use POST to trigger Shopify sync',
      configured: false,
    })
  }
}
