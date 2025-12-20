import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.CALENDLY_CLIENT_ID
    const redirectUri = process.env.CALENDLY_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/calendly/callback`

    console.log('[Calendly Auth] Iniciando flujo OAuth...')
    console.log('[Calendly Auth] Client ID configurado:', !!clientId)
    console.log('[Calendly Auth] Redirect URI:', redirectUri)

    if (!clientId) {
      console.error('[Calendly Auth] ERROR: CALENDLY_CLIENT_ID no configurado')
      return NextResponse.json(
        { error: 'Calendly OAuth not configured. Please add CALENDLY_CLIENT_ID to environment variables.' },
        { status: 500 }
      )
    }

    // OAuth 2.0 parameters for Calendly
    // Calendly OAuth endpoint: https://auth.calendly.com/oauth/authorize
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'default', // Calendly uses 'default' scope for basic API access
    })

    const authUrl = `https://auth.calendly.com/oauth/authorize?${params.toString()}`
    console.log('[Calendly Auth] Redirigiendo a:', authUrl)

    // IMPORTANTE: Usar redirect con status 307 para mantener el método GET
    return NextResponse.redirect(authUrl, { status: 307 })
  } catch (error) {
    console.error('[Calendly Auth] Error initiating OAuth:', error)
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow', details: String(error) },
      { status: 500 }
    )
  }
}
