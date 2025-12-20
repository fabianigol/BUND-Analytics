import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
      const url = new URL('/integraciones', request.url)
      url.searchParams.set('error', 'oauth_cancelled')
      return NextResponse.redirect(url)
    }

    if (!code) {
      return NextResponse.json(
        { error: 'No authorization code provided' },
        { status: 400 }
      )
    }

    const clientId = process.env.CALENDLY_CLIENT_ID
    const clientSecret = process.env.CALENDLY_CLIENT_SECRET
    const redirectUri = process.env.CALENDLY_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/calendly/callback`

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Calendly OAuth not configured' },
        { status: 500 }
      )
    }

    // Exchange authorization code for tokens
    // Calendly token endpoint: https://auth.calendly.com/oauth/token
    const tokenResponse = await fetch('https://auth.calendly.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token exchange error:', errorData)
      throw new Error('Failed to exchange authorization code for tokens')
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokenData

    if (!access_token) {
      throw new Error('No access token received')
    }

    // Calculate expiration time
    const expiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null

    // Save tokens to Supabase
    const supabase = await createClient()

    const { data, error: dbError } = await supabase
      .from('integration_settings')
      .upsert({
        integration: 'calendly',
        settings: {
          access_token,
          refresh_token: refresh_token || null,
          expires_at: expiresAt,
        },
        connected: true,
        updated_at: new Date().toISOString(),
      } as any, {
        onConflict: 'integration',
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error saving tokens:', dbError)
      throw dbError
    }

    // Redirect back to integrations page with success
    const url = new URL('/integraciones', request.url)
    url.searchParams.set('connected', 'calendly')
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('Error in OAuth callback:', error)
    const url = new URL('/integraciones', request.url)
    url.searchParams.set('error', 'oauth_failed')
    return NextResponse.redirect(url)
  }
}
