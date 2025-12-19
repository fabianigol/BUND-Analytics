import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CalendlyService } from '@/lib/integrations/calendly'

// GET - Obtener estado de conexión de Calendly
export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('integration', 'calendly')
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    const settings = (data as any)?.settings || {}
    const connected = (data as any)?.connected || false
    const hasApiKey = !!process.env.CALENDLY_API_KEY || !!settings.api_key

    return NextResponse.json({
      connected: connected && hasApiKey,
      lastSync: (data as any)?.last_sync || null,
      hasApiKey,
    })
  } catch (error) {
    console.error('Error fetching Calendly integration:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Calendly integration', details: String(error) },
      { status: 500 }
    )
  }
}

// POST - Guardar API key de Calendly
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key es requerida' },
        { status: 400 }
      )
    }

    // Verificar que la API key sea válida probando una llamada simple
    const testService = new CalendlyService({ apiKey })
    try {
      await testService.getCurrentUser()
    } catch (error) {
      return NextResponse.json(
        { error: 'API Key inválida. Por favor, verifica tu API key de Calendly.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Guardar API key en settings
    const { data, error } = await supabase
      .from('integration_settings')
      .upsert({
        integration: 'calendly',
        settings: {
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
      message: 'API Key de Calendly guardada correctamente',
      connected: (data as any)?.connected || false,
    })
  } catch (error) {
    console.error('Error saving Calendly API key:', error)
    return NextResponse.json(
      { error: 'Failed to save Calendly API key', details: String(error) },
      { status: 500 }
    )
  }
}

// DELETE - Desconectar Calendly
export async function DELETE() {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('integration_settings')
      .update({
        connected: false,
        settings: {},
        updated_at: new Date().toISOString(),
      } as any)
      .eq('integration', 'calendly')

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Calendly desconectado correctamente',
    })
  } catch (error) {
    console.error('Error disconnecting Calendly:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Calendly', details: String(error) },
      { status: 500 }
    )
  }
}

