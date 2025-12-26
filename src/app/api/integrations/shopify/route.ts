import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Obtener configuración de Shopify
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Verificar autenticación primero
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error in Shopify GET:', authError)
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User not authenticated' },
        { status: 401 }
      )
    }
    
    const { data, error } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('integration', 'shopify')
      .single()

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
    const { shopDomain, accessToken } = body

    if (!shopDomain || !accessToken) {
      return NextResponse.json(
        { error: 'Shop Domain y Access Token son requeridos' },
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

    // Validar formato del access token
    if (!accessToken.startsWith('shpat_') && !accessToken.startsWith('shpca_')) {
      return NextResponse.json(
        { error: 'El Access Token debe comenzar con shpat_ o shpca_' },
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

    // Guardar credenciales en settings
    const { data, error } = await supabase
      .from('integration_settings')
      .upsert({
        integration: 'shopify',
        settings: {
          shop_domain: shopDomain,
          access_token: accessToken,
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
      message: 'Credenciales de Shopify guardadas correctamente',
      connected: (data as any)?.connected || false,
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
export async function DELETE() {
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

    const { error } = await (supabase
      .from('integration_settings') as any)
      .update({
        connected: false,
        settings: {},
        updated_at: new Date().toISOString(),
      })
      .eq('integration', 'shopify')

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Shopify desconectado correctamente',
    })
  } catch (error) {
    console.error('Error disconnecting Shopify:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Shopify', details: String(error) },
      { status: 500 }
    )
  }
}

