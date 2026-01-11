/**
 * Shopify OAuth Client Credentials Grant
 * Para Dev Apps que usan Client ID + Client Secret (shpss_)
 * Específicamente para México
 */

import { createClient } from '@/lib/supabase/server'

export interface ShopifyOAuthConfig {
  shopDomain: string
  clientId: string
  clientSecret: string
}

export interface ShopifyAccessToken {
  access_token: string
  scope: string
  expires_in: number // segundos hasta expiración (86399 = 24h)
}

/**
 * Obtiene un access token usando Client Credentials Grant
 * https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant
 */
export async function getShopifyAccessToken(
  config: ShopifyOAuthConfig
): Promise<ShopifyAccessToken> {
  const { shopDomain, clientId, clientSecret } = config

  const url = `https://${shopDomain}/admin/oauth/access_token`
  
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  console.log(`[Shopify OAuth] Requesting access token for ${shopDomain}...`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Shopify OAuth] Failed to get access token:`, errorText)
    throw new Error(`Failed to get Shopify access token: ${response.status} ${errorText}`)
  }

  const data: ShopifyAccessToken = await response.json()
  
  console.log(`[Shopify OAuth] Access token obtained successfully. Expires in ${data.expires_in}s (${(data.expires_in / 3600).toFixed(1)}h)`)
  
  return data
}

/**
 * Guarda el access token en Supabase para México
 */
export async function saveShopifyAccessTokenMX(
  accessToken: string,
  expiresIn: number,
  scope: string
): Promise<void> {
  const supabase = await createClient()
  
  // Calcular fecha de expiración
  const expiresAt = new Date()
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn)

  // Guardar en integration_settings
  const settings = {
    access_token: accessToken,
    expires_at: expiresAt.toISOString(),
    scope: scope,
    last_refreshed: new Date().toISOString(),
  }

  const { error } = await (supabase as any)
    .from('integration_settings')
    .update({
      settings,
      connected: true,
      updated_at: new Date().toISOString(),
    })
    .eq('integration', 'shopify_mx')

  if (error) {
    console.error('[Shopify OAuth] Failed to save token to Supabase:', error)
    throw new Error('Failed to save access token to database')
  }

  console.log(`[Shopify OAuth] Token saved to Supabase. Expires at ${expiresAt.toISOString()}`)
}

/**
 * Obtiene el access token guardado para México desde Supabase
 * Si el token está próximo a expirar (< 1h), lo renueva automáticamente
 */
export async function getShopifyAccessTokenMX(): Promise<string | null> {
  const supabase = await createClient()

  // Obtener configuración de Shopify México
  const { data: integrationData, error: integrationError } = await (supabase as any)
    .from('integration_settings')
    .select('settings, connected')
    .eq('integration', 'shopify_mx')
    .single()

  if (integrationError || !integrationData?.connected) {
    console.log('[Shopify OAuth] Shopify MX not connected')
    return null
  }

  const settings = integrationData.settings as any

  // Verificar si existe un token guardado
  if (settings.access_token) {
    const expiresAt = settings.expires_at ? new Date(settings.expires_at) : null
    const now = new Date()

    // Si el token expira en más de 1 hora, usarlo
    if (expiresAt && expiresAt.getTime() > now.getTime() + (60 * 60 * 1000)) {
      console.log(`[Shopify OAuth] Using cached token. Expires at ${expiresAt.toISOString()}`)
      return settings.access_token
    }

    console.log(`[Shopify OAuth] Token expired or expiring soon. Refreshing...`)
  }

  // Si no hay token o está próximo a expirar, obtener uno nuevo
  return await refreshShopifyAccessTokenMX()
}

/**
 * Refresca el access token de México obteniendo uno nuevo
 */
export async function refreshShopifyAccessTokenMX(): Promise<string> {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN_MX
  const clientId = process.env.SHOPIFY_CLIENT_ID_MX
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET_MX

  if (!shopDomain || !clientId || !clientSecret) {
    throw new Error('Shopify MX OAuth credentials not configured in environment variables')
  }

  // Obtener nuevo token
  const tokenData = await getShopifyAccessToken({
    shopDomain,
    clientId,
    clientSecret,
  })

  // Guardar en Supabase
  await saveShopifyAccessTokenMX(
    tokenData.access_token,
    tokenData.expires_in,
    tokenData.scope
  )

  return tokenData.access_token
}

/**
 * Verifica si las credenciales de OAuth están configuradas para México
 */
export function isShopifyOAuthConfiguredMX(): boolean {
  return !!(
    process.env.SHOPIFY_SHOP_DOMAIN_MX &&
    process.env.SHOPIFY_CLIENT_ID_MX &&
    process.env.SHOPIFY_CLIENT_SECRET_MX
  )
}
