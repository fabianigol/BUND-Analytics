import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Obtener configuración de Google Analytics
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Verificar autenticación primero
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error in Analytics GET:', authError)
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User not authenticated' },
        { status: 401 }
      )
    }
    
    const { data, error } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('integration', 'analytics')
      .single()

    // Si no hay datos, retornar estado desconectado
    if (error && error.code === 'PGRST116') {
      return NextResponse.json({
        property_id: null,
        connected: false,
        lastSync: null,
        hasTokens: false,
      })
    }

    if (error) {
      console.error('Supabase error in Analytics GET:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      throw error
    }

    const settings = (data as any)?.settings || {}
    
    // Don't expose tokens in response
    const safeSettings = {
      property_id: settings.property_id,
      connected: (data as any)?.connected || false,
      lastSync: (data as any)?.last_sync || null,
      hasTokens: !!(settings.access_token && settings.refresh_token),
    }

    return NextResponse.json(safeSettings)
  } catch (error: any) {
    console.error('Error fetching Analytics settings:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      stack: error?.stack,
    })
    return NextResponse.json(
      { 
        error: 'Failed to fetch Analytics settings', 
        details: error?.message || String(error),
        code: error?.code,
      },
      { status: 500 }
    )
  }
}

// POST - Guardar Property ID (opcional, puede venir del OAuth)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { propertyId } = body

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID es requerido' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get existing settings to preserve tokens
    const { data: existing } = await supabase
      .from('integration_settings')
      .select('settings')
      .eq('integration', 'analytics')
      .single()

    const existingSettings = (existing as any)?.settings || {}

    const { data, error } = await supabase
      .from('integration_settings')
      .upsert({
        integration: 'analytics',
        settings: {
          ...existingSettings,
          property_id: propertyId,
        },
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
      message: 'Property ID guardado correctamente',
      connected: (data as any)?.connected || false,
    })
  } catch (error) {
    console.error('Error saving Analytics Property ID:', error)
    return NextResponse.json(
      { error: 'Failed to save Property ID', details: String(error) },
      { status: 500 }
    )
  }
}

// DELETE - Desconectar Google Analytics
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
      .eq('integration', 'analytics')

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Google Analytics desconectado correctamente',
    })
  } catch (error) {
    console.error('Error disconnecting Analytics:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Analytics', details: String(error) },
      { status: 500 }
    )
  }
}

