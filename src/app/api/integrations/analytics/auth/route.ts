import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/analytics/callback`

    if (!clientId) {
      return NextResponse.json(
        { error: 'Google OAuth not configured. Please add GOOGLE_CLIENT_ID to environment variables.' },
        { status: 500 }
      )
    }

    // OAuth 2.0 parameters - Include both Analytics and Search Console scopes
    const scopes = [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/webmasters.readonly', // Search Console
    ]
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline', // Required to get refresh token
      prompt: 'consent', // Force consent to get refresh token
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Error initiating Google OAuth:', error)
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow', details: String(error) },
      { status: 500 }
    )
  }
}

