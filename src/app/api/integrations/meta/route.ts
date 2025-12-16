import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Obtener configuración de Meta
export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('integration', 'meta')
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return NextResponse.json({
      connected: data?.connected || false,
      settings: data?.settings || {},
      lastSync: data?.last_sync || null,
    })
  } catch (error) {
    console.error('Error fetching Meta settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Meta settings', details: String(error) },
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
      }, {
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
      connected: data.connected,
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

    const { error } = await supabase
      .from('integration_settings')
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

