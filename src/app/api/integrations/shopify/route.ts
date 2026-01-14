import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  getShopifyAccessToken, 
  saveShopifyAccessTokenMX 
} from '@/lib/integrations/shopify-oauth'

// GET - Obtener configuración de Shopify
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Obtener parámetro country
    const searchParams = request.nextUrl.searchParams
    const country = (searchParams.get('country') || 'ES').toUpperCase()
    const integrationName = country === 'MX' ? 'shopify_mx' : 'shopify_es'
    
    // Verificar autenticación primero
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error in Shopify GET:', authError)
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User not authenticated' },
        { status: 401 }
      )
    }
    
    // Intentar con el nombre específico del país
    let { data, error } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('integration', integrationName)
      .single()
    
    // Si es ES y no encuentra shopify_es, intentar con legacy 'shopify'
    if (error && error.code === 'PGRST116' && country === 'ES') {
      const legacyResult = await supabase
        .from('integration_settings')
        .select('*')
        .eq('integration', 'shopify')
        .single()
      data = legacyResult.data
      error = legacyResult.error
    }

    // Si no hay datos, retornar estado desconectado
    if (error && error.code === 'PGRST116') {
      return NextResponse.json({
        connected: false,
        settings: {},
        lastSync: null,
      })
    }

    if (error) {
      console.error('Supabase error in Shopify GET:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      throw error
    }

    const settings = (data as any)?.settings || {}
    
    // No exponer credenciales completas en la respuesta
    return NextResponse.json({
      connected: (data as any)?.connected || false,
      hasCredentials: !!(settings.shop_domain && settings.access_token),
      shopDomain: settings.shop_domain || null,
      lastSync: (data as any)?.last_sync || null,
    })
  } catch (error: any) {
    console.error('Error fetching Shopify settings:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      stack: error?.stack,
    })
    return NextResponse.json(
      { 
        error: 'Failed to fetch Shopify settings', 
        details: error?.message || String(error),
        code: error?.code,
      },
      { status: 500 }
    )
  }
}

// POST - Guardar credenciales de Shopify
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Sanitizar inputs: quitar espacios en blanco al inicio y final
    const shopDomain = body.shopDomain?.trim()?.toLowerCase()
    const accessToken = body.accessToken?.trim()
    const clientId = body.clientId?.trim()
    const clientSecret = body.clientSecret?.trim()
    const country = body.country?.toUpperCase() || 'ES'
    
    // Determinar nombre de integración según país
    const integrationName = country === 'MX' ? 'shopify_mx' : 'shopify_es'
    
    console.log(`[Shopify API] POST request for ${integrationName}`)
    console.log(`[Shopify API] Country received: "${country}"`)
    console.log(`[Shopify API] Shop domain received: "${shopDomain}"`)
    console.log(`[Shopify API] Has accessToken: ${!!accessToken} (length: ${accessToken?.length || 0})`)
    console.log(`[Shopify API] Has clientId: ${!!clientId}`)
    console.log(`[Shopify API] Has clientSecret: ${!!clientSecret}`)
    
    // VALIDACIÓN CRÍTICA: Prevenir mezcla de credenciales México/España
    if (country === 'ES') {
      // España SOLO debe usar accessToken directo, NO OAuth
      if (clientId || clientSecret) {
        console.error(`[Shopify API] ERROR: España received OAuth credentials - this is not allowed`)
        return NextResponse.json(
          { error: 'España usa Access Token directo, no OAuth. Usa clientId/clientSecret solo para México.' },
          { status: 400 }
        )
      }
      if (!accessToken) {
        return NextResponse.json(
          { error: 'Access Token es requerido para Shopify España' },
          { status: 400 }
        )
      }
      // Validar que no se esté usando un dominio de México para España
      if (shopDomain?.includes('mexico') || shopDomain?.includes('mx')) {
        console.warn(`[Shopify API] WARNING: Shop domain "${shopDomain}" parece ser de México pero country es ES`)
      }
    }
    
    if (country === 'MX') {
      // México usa OAuth (clientId + clientSecret) O accessToken directo
      if (!clientId && !clientSecret && !accessToken) {
        return NextResponse.json(
          { error: 'México requiere Client ID + Client Secret (OAuth) o Access Token directo' },
          { status: 400 }
        )
      }
    }

    if (!shopDomain) {
      return NextResponse.json(
        { error: 'Shop Domain es requerido' },
        { status: 400 }
      )
    }

    // Validar formato del shop domain
    if (!shopDomain.includes('.myshopify.com')) {
      return NextResponse.json(
        { error: 'El Shop Domain debe tener el formato: tu-tienda.myshopify.com' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User not authenticated' },
        { status: 401 }
      )
    }

    let finalAccessToken = accessToken
    let oauthSettings: any = {}

    // Para México: Si se proporcionan Client ID y Client Secret, usar OAuth
    if (country === 'MX' && clientId && clientSecret) {
      console.log('[Shopify API] Using OAuth Client Credentials for Mexico')
      
      try {
        // Obtener access token usando Client Credentials Grant
        const tokenData = await getShopifyAccessToken({
          shopDomain,
          clientId,
          clientSecret,
        })

        finalAccessToken = tokenData.access_token
        
        // Guardar el token con su información de expiración
        await saveShopifyAccessTokenMX(
          tokenData.access_token,
          tokenData.expires_in,
          tokenData.scope
        )

        oauthSettings = {
          client_id: clientId,
          client_secret: clientSecret,
          oauth_enabled: true,
        }

        console.log('[Shopify API] OAuth token obtained and saved successfully')
      } catch (oauthError: any) {
        console.error('[Shopify API] OAuth failed:', oauthError)
        return NextResponse.json(
          { 
            error: 'Error al obtener token de Shopify usando OAuth', 
            details: oauthError.message || String(oauthError) 
          },
          { status: 400 }
        )
      }
    }

    // Validar que tengamos un access token (ya sea directo o de OAuth)
    if (!finalAccessToken) {
      return NextResponse.json(
        { error: 'Se requiere Access Token O Client ID + Client Secret' },
        { status: 400 }
      )
    }

    // Para tokens directos (no OAuth), validar formato
    if (!clientId && !clientSecret) {
      if (!finalAccessToken.startsWith('shpat_') && !finalAccessToken.startsWith('shpca_')) {
        return NextResponse.json(
          { error: 'El Access Token debe comenzar con shpat_ o shpca_' },
          { status: 400 }
        )
      }
    }

    // Guardar credenciales en settings
    const { data, error } = await supabase
      .from('integration_settings')
      .upsert({
        integration: integrationName,
        settings: {
          shop_domain: shopDomain,
          access_token: finalAccessToken,
          ...oauthSettings,
        },
        connected: true,
        updated_at: new Date().toISOString(),
      } as any, {
        onConflict: 'integration',
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: `Credenciales de Shopify ${country} guardadas correctamente`,
      connected: (data as any)?.connected || false,
      country,
    })
  } catch (error) {
    console.error('Error saving Shopify credentials:', error)
    return NextResponse.json(
      { error: 'Failed to save Shopify credentials', details: String(error) },
      { status: 500 }
    )
  }
}

// DELETE - Desconectar Shopify
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Obtener parámetro country
    const searchParams = request.nextUrl.searchParams
    const country = (searchParams.get('country') || 'ES').toUpperCase()
    const integrationName = country === 'MX' ? 'shopify_mx' : 'shopify_es'

    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User not authenticated' },
        { status: 401 }
      )
    }

    const { error } = await (supabase
      .from('integration_settings') as any)
      .update({
        connected: false,
        settings: {},
        updated_at: new Date().toISOString(),
      })
      .eq('integration', integrationName)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: `Shopify ${country} desconectado correctamente`,
      country,
    })
  } catch (error) {
    console.error('Error disconnecting Shopify:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Shopify', details: String(error) },
      { status: 500 }
    )
  }
}

