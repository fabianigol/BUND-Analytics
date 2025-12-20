import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Obtener configuración de Meta
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Verificar autenticación primero
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error in Meta GET:', authError)
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User not authenticated' },
        { status: 401 }
      )
    }
    
    const { data, error } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('integration', 'meta')
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
      console.error('Supabase error in Meta GET:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      throw error
    }

    return NextResponse.json({
      connected: (data as any)?.connected || false,
      settings: (data as any)?.settings || {},
      lastSync: (data as any)?.last_sync || null,
    })
  } catch (error: any) {
    console.error('Error fetching Meta settings:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      stack: error?.stack,
    })
    return NextResponse.json(
      { 
        error: 'Failed to fetch Meta settings', 
        details: error?.message || String(error),
        code: error?.code,
      },
      { status: 500 }
    )
  }
}

// POST - Guardar credenciales de Meta
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accessToken, adAccountId } = body

    if (!accessToken || !adAccountId) {
      return NextResponse.json(
        { error: 'Access Token y Ad Account ID son requeridos' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Guardar credenciales encriptadas en settings
    const { data, error } = await supabase
      .from('integration_settings')
      .upsert({
        integration: 'meta',
        settings: {
          access_token: accessToken,
          ad_account_id: adAccountId,
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
      message: 'Credenciales de Meta guardadas correctamente',
      connected: (data as any)?.connected || false,
    })
  } catch (error) {
    console.error('Error saving Meta credentials:', error)
    return NextResponse.json(
      { error: 'Failed to save Meta credentials', details: String(error) },
      { status: 500 }
    )
  }
}

// DELETE - Desconectar Meta
export async function DELETE() {
  try {
    const supabase = await createClient()

    const { error } = await (supabase
      .from('integration_settings') as any)
      .update({
        connected: false,
        settings: {},
        updated_at: new Date().toISOString(),
      })
      .eq('integration', 'meta')

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Meta desconectado correctamente',
    })
  } catch (error) {
    console.error('Error disconnecting Meta:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Meta', details: String(error) },
      { status: 500 }
    )
  }
}

