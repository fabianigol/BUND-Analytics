import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Obtener configuración de Acuity
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Verificar autenticación primero
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error in Acuity GET:', authError)
      return NextResponse.json(
        { error: 'Unauthorized', details: 'User not authenticated' },
        { status: 401 }
      )
    }
    
    const { data, error } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('integration', 'acuity')
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
      console.error('Supabase error in Acuity GET:', {
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
      hasCredentials: !!(settings.user_id && settings.api_key),
      lastSync: (data as any)?.last_sync || null,
    })
  } catch (error: any) {
    console.error('Error fetching Acuity settings:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      stack: error?.stack,
    })
    return NextResponse.json(
      { 
        error: 'Failed to fetch Acuity settings', 
        details: error?.message || String(error),
        code: error?.code,
      },
      { status: 500 }
    )
  }
}

// POST - Guardar credenciales de Acuity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, apiKey } = body

    if (!userId || !apiKey) {
      return NextResponse.json(
        { error: 'User ID y API Key son requeridos' },
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
        integration: 'acuity',
        settings: {
          user_id: userId,
          api_key: apiKey,
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
      message: 'Credenciales de Acuity guardadas correctamente',
      connected: (data as any)?.connected || false,
    })
  } catch (error) {
    console.error('Error saving Acuity credentials:', error)
    return NextResponse.json(
      { error: 'Failed to save Acuity credentials', details: String(error) },
      { status: 500 }
    )
  }
}

// DELETE - Desconectar Acuity
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
      .eq('integration', 'acuity')

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Acuity desconectado correctamente',
    })
  } catch (error) {
    console.error('Error disconnecting Acuity:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Acuity', details: String(error) },
      { status: 500 }
    )
  }
}

