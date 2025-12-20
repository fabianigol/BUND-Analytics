import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CalendlyService } from '@/lib/integrations/calendly'

// GET - Obtener estado de conexión de Calendly
export async function GET() {
  try {
    const supabase = await createClient()
    
    // Verificar autenticación primero
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error in Calendly GET:', authError)
      return NextResponse.json({
        connected: false,
        lastSync: null,
        hasOAuth: false,
        hasApiKey: false,
        authMethod: 'none',
      })
    }
    
    const { data, error } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('integration', 'calendly')
      .single()

    // Si no hay datos, no está conectado
    if (error && error.code === 'PGRST116') {
      return NextResponse.json({
        connected: false,
        lastSync: null,
        hasOAuth: false,
        hasApiKey: false,
        authMethod: 'none',
      })
    }

    if (error) {
      console.error('Supabase error in Calendly GET:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      throw error
    }

    const settings = (data as any)?.settings || {}
    const connected = (data as any)?.connected || false
    
    // Solo OAuth - eliminar cualquier rastro de API key
    const hasOAuth = !!(settings.access_token)
    const hasApiKeyInSettings = !!(settings.api_key)
    
    console.log('[Calendly GET] Estado actual en DB:', { 
      connected, 
      hasOAuth, 
      hasApiKeyInSettings, 
      access_token_exists: !!settings.access_token,
      access_token_preview: settings.access_token ? `${settings.access_token.substring(0, 20)}...` : 'none'
    })
    
    // Si connected está en false en la base de datos, no verificar tokens
    // Esto es porque el usuario explícitamente desconectó
    if (!connected) {
      console.log('[Calendly GET] Database muestra connected=false. Devolviendo desconectado sin verificar tokens.')
      // Pero aún limpiar API keys si existen
      if (hasApiKeyInSettings) {
        console.log('[Calendly GET] Limpiando API key antigua...')
        await supabase
          .from('integration_settings')
          .update({
            settings: {
              access_token: null,
              refresh_token: null,
              expires_at: null,
            },
            updated_at: new Date().toISOString(),
          } as any)
          .eq('integration', 'calendly')
      }
      return NextResponse.json({
        connected: false,
        lastSync: (data as any)?.last_sync || null,
        hasOAuth: false,
        hasApiKey: false,
        authMethod: 'none',
      })
    }
    
    // Verificar si el token OAuth es válido haciendo una llamada real a la API
    // No solo verificar que existe, sino que realmente funciona
    // IMPORTANTE: Si falla la verificación, considerar como inválido
    let isOAuthValid = false
    let needsCleanup = false
    
    // SIEMPRE limpiar API key si existe (no queremos soportar API keys)
    if (hasApiKeyInSettings) {
      console.log('[Calendly GET] Encontrada API key antigua. Marcando para limpiar...')
      needsCleanup = true
    }
    
    // Si hay token OAuth, verificar que funcione realmente
    if (hasOAuth && settings.access_token) {
      try {
        // Intentar hacer una llamada real a la API para verificar que el token funciona
        const testService = new CalendlyService({
          accessToken: settings.access_token,
          refreshToken: settings.refresh_token,
          expiresAt: settings.expires_at,
          clientId: process.env.CALENDLY_CLIENT_ID,
          clientSecret: process.env.CALENDLY_CLIENT_SECRET,
        })
        
        // Hacer una llamada simple con timeout para evitar que se quede colgado
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Token verification timeout')), 5000)
        )
        
        await Promise.race([
          testService.getCurrentUser(),
          timeoutPromise
        ])
        
        isOAuthValid = true
        console.log('[Calendly GET] Token OAuth válido y funcional')
      } catch (error: any) {
        console.log('[Calendly GET] Token OAuth inválido o expirado. Error:', error?.message || error)
        isOAuthValid = false
        // Si el token no funciona, marcarlo para limpiar
        needsCleanup = true
      }
    } else {
      // No hay token OAuth pero connected=true en DB, corregir
      console.log('[Calendly GET] No hay token OAuth pero connected=true en DB. Marcando para corregir...')
      needsCleanup = true
    }
    
    // Solo considerar conectado si hay OAuth tokens válidos Y el flag 'connected' es true
    const isConnected = isOAuthValid && connected
    
    // Si necesitamos limpiar (API key antigua, token inválido, o falta token)
    if (needsCleanup || !isOAuthValid) {
      console.log('[Calendly GET] Limpiando estado inválido...')
      await supabase
        .from('integration_settings')
        .update({
          connected: false, // Siempre false si no hay OAuth válido
          settings: {
            // Eliminar tokens inválidos, mantener solo si son válidos
            access_token: isOAuthValid ? settings.access_token : null,
            refresh_token: isOAuthValid ? settings.refresh_token : null,
            expires_at: isOAuthValid ? settings.expires_at : null,
          },
          updated_at: new Date().toISOString(),
        } as any)
        .eq('integration', 'calendly')
      
      console.log('[Calendly GET] Estado limpiado. Conectado:', false, 'OAuth válido:', isOAuthValid)
      
      // Devolver estado desconectado después de limpiar
      return NextResponse.json({
        connected: false,
        lastSync: null,
        hasOAuth: false,
        hasApiKey: false,
        authMethod: 'none',
      })
    }

    return NextResponse.json({
      connected: isConnected,
      lastSync: (data as any)?.last_sync || null,
      hasOAuth: isOAuthValid, // Solo true si el token es válido
      hasApiKey: false, // Siempre false ahora
      authMethod: isOAuthValid ? 'oauth' : 'none',
    })
  } catch (error) {
    console.error('Error fetching Calendly integration:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Calendly integration', details: String(error) },
      { status: 500 }
    )
  }
}

// POST - Ya no soportamos API keys, solo OAuth
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      error: 'API Key method is no longer supported. Please use OAuth authentication via /api/integrations/calendly/auth',
      message: 'Calendly integration now requires OAuth 2.0. Click "Connect with Calendly" to use OAuth.',
    },
    { status: 400 }
  )
}

// DELETE - Desconectar Calendly y limpiar todos los tokens
export async function DELETE() {
  try {
    const supabase = await createClient()

    console.log('[Calendly DELETE] Desconectando y limpiando todos los tokens...')

    // Limpiar completamente: eliminar todos los tokens OAuth y API keys
    const { error } = await supabase
      .from('integration_settings')
      .update({
        connected: false,
        settings: {}, // Limpiar completamente todos los settings
        updated_at: new Date().toISOString(),
      } as any)
      .eq('integration', 'calendly')

    if (error) {
      throw error
    }

    console.log('[Calendly DELETE] Desconexión completada. Todos los tokens eliminados.')

    return NextResponse.json({
      success: true,
      message: 'Calendly desconectado correctamente. Todos los tokens han sido eliminados.',
    })
  } catch (error) {
    console.error('[Calendly DELETE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect Calendly', details: String(error) },
      { status: 500 }
    )
  }
}

