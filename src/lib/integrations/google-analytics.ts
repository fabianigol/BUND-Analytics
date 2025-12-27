import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { OAuth2Client } from 'google-auth-library'
import { AnalyticsData, TrafficSource, TopPage } from '@/types'

interface GAConfig {
  propertyId: string
  accessToken: string
}

interface GATokenData {
  access_token: string
  refresh_token?: string
  expires_at?: string
}

interface GAOverviewMetrics {
  sessions: number
  totalUsers: number
  newUsers: number
  screenPageViews: number
  bounceRate: number
  averageSessionDuration: number
}

export class GoogleAnalyticsService {
  private propertyId: string
  private accessToken: string
  private refreshToken?: string
  private expiresAt?: Date
  private clientId?: string
  private clientSecret?: string
  private onTokenRefreshed?: (tokenData: { accessToken: string; expiresAt?: Date }) => Promise<void>

  constructor(config: GAConfig & { refreshToken?: string; expiresAt?: string; clientId?: string; clientSecret?: string; onTokenRefreshed?: (tokenData: { accessToken: string; expiresAt?: Date }) => Promise<void> }) {
    this.propertyId = config.propertyId
    this.accessToken = config.accessToken
    this.refreshToken = config.refreshToken
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
    this.onTokenRefreshed = config.onTokenRefreshed
    
    if (config.expiresAt) {
      this.expiresAt = new Date(config.expiresAt)
    }
  }

  // Refresh access token if needed
  private async ensureValidToken(): Promise<string> {
    // Check if token is expired or will expire in the next 5 minutes
    if (this.expiresAt && new Date() >= new Date(this.expiresAt.getTime() - 5 * 60 * 1000)) {
      if (!this.refreshToken || !this.clientId || !this.clientSecret) {
        throw new Error('Token expired and no refresh token available. Please reconnect Google Analytics.')
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: this.refreshToken,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorData: any
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: 'unknown_error', error_description: errorText }
        }

        // Check if token was revoked or expired
        if (errorData.error === 'invalid_grant') {
          const errorMessage = errorData.error_description || 'Token has been expired or revoked'
          throw new Error(`TOKEN_REVOKED: ${errorMessage}. Please reconnect Google Analytics from the integrations page.`)
        }

        throw new Error(`Failed to refresh token: ${errorText}`)
      }

      const tokenData = await response.json()
      this.accessToken = tokenData.access_token
      
      if (tokenData.expires_in) {
        this.expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)
      }

      // Save refreshed token to database if callback is provided
      if (this.onTokenRefreshed) {
        try {
          await this.onTokenRefreshed({
            accessToken: this.accessToken,
            expiresAt: this.expiresAt,
          })
          console.log('[GA Service] Refreshed token saved to database')
        } catch (error) {
          console.error('[GA Service] Error saving refreshed token:', error)
          // Don't throw - token is still valid in memory for this request
        }
      }
    }

    return this.accessToken
  }

  // Create authenticated client
  private async getClient(): Promise<BetaAnalyticsDataClient> {
    let token: string
    try {
      token = await this.ensureValidToken()
    } catch (error) {
      // Re-throw token errors as-is (they already have proper error messages)
      throw error
    }
    
    console.log('[GA Service] Creating authenticated client with token')
    console.log('[GA Service] Property ID:', this.propertyId)
    
    if (!this.clientId || !this.clientSecret) {
      throw new Error('OAuth2 credentials not configured')
    }
    
    // Create OAuth2Client instance for token management
    const oauth2Client = new OAuth2Client(
      this.clientId,
      this.clientSecret
    )
    
    // Set the credentials (access token and refresh token)
    oauth2Client.setCredentials({
      access_token: token,
      refresh_token: this.refreshToken,
    })
    
    // Create a wrapper that implements the GoogleAuth interface
    // BetaAnalyticsDataClient expects a GoogleAuth-like object with all required methods
    const authWrapper = {
      getClient: async () => oauth2Client,
      getAccessToken: async () => {
        try {
          const credentials = await oauth2Client.getAccessToken()
          return credentials.token || token
        } catch (error: any) {
          // Check if it's a token error
          const errorMessage = error?.message || String(error)
          if (errorMessage.includes('invalid_grant') || errorMessage.includes('Token has been expired')) {
            throw new Error('TOKEN_REVOKED: Token has been expired or revoked. Please reconnect Google Analytics from the integrations page.')
          }
          throw error
        }
      },
      getUniverseDomain: () => 'googleapis.com',
      request: async (opts: any) => {
        try {
          return await oauth2Client.request(opts)
        } catch (error: any) {
          // Check if it's a token error
          const errorMessage = error?.message || String(error)
          if (errorMessage.includes('invalid_grant') || errorMessage.includes('Token has been expired')) {
            throw new Error('TOKEN_REVOKED: Token has been expired or revoked. Please reconnect Google Analytics from the integrations page.')
          }
          throw error
        }
      },
      // Additional methods that might be needed
      getProjectId: async () => null,
      getCredentials: async () => {
        const credentials = oauth2Client.credentials
        return {
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token,
        }
      },
    }
    
    // Create client with auth wrapper
    try {
      const client = new BetaAnalyticsDataClient({
        auth: authWrapper as any,
      })
      console.log('[GA Service] Client created successfully')
      return client
    } catch (error) {
      console.error('[GA Service] Error creating client:', error)
      throw error
    }
  }

  async getOverviewMetrics(dateRange: { startDate: string; endDate: string }): Promise<GAOverviewMetrics> {
    const client = await this.getClient()
    
    const [response] = await client.runReport({
      property: `properties/${this.propertyId}`,
      dateRanges: [
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
    })

    const rows = response.rows || []
    if (rows.length === 0) {
      return {
        sessions: 0,
        totalUsers: 0,
        newUsers: 0,
        screenPageViews: 0,
        bounceRate: 0,
        averageSessionDuration: 0,
      }
    }

    const row = rows[0]
    const metricValues = row.metricValues || []

    return {
      sessions: parseInt(metricValues[0]?.value || '0', 10),
      totalUsers: parseInt(metricValues[1]?.value || '0', 10),
      newUsers: parseInt(metricValues[2]?.value || '0', 10),
      screenPageViews: parseInt(metricValues[3]?.value || '0', 10),
      bounceRate: parseFloat(metricValues[4]?.value || '0'),
      averageSessionDuration: parseFloat(metricValues[5]?.value || '0'),
    }
  }

  async getTrafficSources(dateRange: { startDate: string; endDate: string }): Promise<Array<{
    source: string
    medium: string
    sessions: number
    users: number
  }>> {
    const client = await this.getClient()
    
    const [response] = await client.runReport({
      property: `properties/${this.propertyId}`,
      dateRanges: [
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
      ],
      dimensions: [
        { name: 'sessionSource' },
        { name: 'sessionMedium' },
      ],
      limit: 10,
    })

    const rows = response.rows || []
    return rows.map((row) => {
      const dimensionValues = row.dimensionValues || []
      const metricValues = row.metricValues || []
      
      return {
        source: dimensionValues[0]?.value || '(direct)',
        medium: dimensionValues[1]?.value || '(none)',
        sessions: parseInt(metricValues[0]?.value || '0', 10),
        users: parseInt(metricValues[1]?.value || '0', 10),
      }
    })
  }

  async getTopPages(dateRange: { startDate: string; endDate: string }): Promise<Array<{
    pagePath: string
    pageTitle: string
    pageViews: number
    avgTimeOnPage: number
  }>> {
    const client = await this.getClient()
    
    const [response] = await client.runReport({
      property: `properties/${this.propertyId}`,
      dateRanges: [
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
      ],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
      ],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' },
      ],
      limit: 10,
    })

    const rows = response.rows || []
    return rows.map((row) => {
      const dimensionValues = row.dimensionValues || []
      const metricValues = row.metricValues || []
      
      return {
        pagePath: dimensionValues[0]?.value || '/',
        pageTitle: dimensionValues[1]?.value || 'Unknown',
        pageViews: parseInt(metricValues[0]?.value || '0', 10),
        avgTimeOnPage: parseFloat(metricValues[1]?.value || '0'),
      }
    })
  }

  async getDailyMetrics(dateRange: { startDate: string; endDate: string }) {
    const client = await this.getClient()
    
    const [response] = await client.runReport({
      property: `properties/${this.propertyId}`,
      dateRanges: [
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
      dimensions: [
        { name: 'date' },
      ],
      orderBys: [
        {
          dimension: { dimensionName: 'date' },
          desc: false,
        },
      ],
    })

    return response
  }

  async getDeviceBreakdown(dateRange: { startDate: string; endDate: string }): Promise<Array<{
    device: string
    sessions: number
  }>> {
    const client = await this.getClient()
    
    const [response] = await client.runReport({
      property: `properties/${this.propertyId}`,
      dateRanges: [
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
      ],
      metrics: [
        { name: 'sessions' },
      ],
      dimensions: [
        { name: 'deviceCategory' },
      ],
    })

    const rows = response.rows || []
    return rows.map((row) => {
      const dimensionValues = row.dimensionValues || []
      const metricValues = row.metricValues || []
      
      return {
        device: dimensionValues[0]?.value || 'unknown',
        sessions: parseInt(metricValues[0]?.value || '0', 10),
      }
    })
  }

  async getGeographicData(dateRange: { startDate: string; endDate: string }): Promise<Array<{
    country: string
    sessions: number
    users: number
  }>> {
    const client = await this.getClient()
    
    const [response] = await client.runReport({
      property: `properties/${this.propertyId}`,
      dateRanges: [
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
      ],
      dimensions: [
        { name: 'country' },
      ],
      limit: 50,
      orderBys: [
        {
          metric: { metricName: 'sessions' },
          desc: true,
        },
      ],
    })

    if (!response.rows || response.rows.length === 0) {
      return []
    }

    return response.rows.map((row) => {
      const dimensionValues = row.dimensionValues || []
      const metricValues = row.metricValues || []

      return {
        country: dimensionValues[0]?.value || 'Unknown',
        sessions: parseInt(metricValues[0]?.value || '0', 10),
        users: parseInt(metricValues[1]?.value || '0', 10),
      }
    })
  }

  async getCityData(dateRange: { startDate: string; endDate: string }): Promise<Array<{
    city: string
    country: string
    sessions: number
    users: number
  }>> {
    const client = await this.getClient()
    
    const [response] = await client.runReport({
      property: `properties/${this.propertyId}`,
      dateRanges: [
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
      ],
      dimensions: [
        { name: 'city' },
        { name: 'country' },
      ],
      limit: 50,
      orderBys: [
        {
          metric: { metricName: 'sessions' },
          desc: true,
        },
      ],
    })

    if (!response.rows || response.rows.length === 0) {
      return []
    }

    return response.rows.map((row) => {
      const dimensionValues = row.dimensionValues || []
      const metricValues = row.metricValues || []

      return {
        city: dimensionValues[0]?.value || 'Unknown',
        country: dimensionValues[1]?.value || 'Unknown',
        sessions: parseInt(metricValues[0]?.value || '0', 10),
        users: parseInt(metricValues[1]?.value || '0', 10),
      }
    })
  }

  async getHourlyData(dateRange: { startDate: string; endDate: string }): Promise<Array<{
    hour: number
    sessions: number
    users: number
  }>> {
    const client = await this.getClient()
    
    const [response] = await client.runReport({
      property: `properties/${this.propertyId}`,
      dateRanges: [
        {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
      ],
      dimensions: [
        { name: 'hour' },
      ],
      orderBys: [
        {
          dimension: { dimensionName: 'hour' },
          desc: false,
        },
      ],
    })

    if (!response.rows || response.rows.length === 0) {
      return []
    }

    return response.rows.map((row) => {
      const dimensionValues = row.dimensionValues || []
      const metricValues = row.metricValues || []

      return {
        hour: parseInt(dimensionValues[0]?.value || '0', 10),
        sessions: parseInt(metricValues[0]?.value || '0', 10),
        users: parseInt(metricValues[1]?.value || '0', 10),
      }
    })
  }

  // Transform GA4 API data to our internal format
  transformOverviewData(
    apiData: GAOverviewMetrics,
    trafficSources: Array<{
      source: string
      medium: string
      sessions: number
      users: number
    }>,
    topPages: Array<{
      pagePath: string
      pageTitle: string
      pageViews: number
      avgTimeOnPage: number
    }>,
    date: string
  ): Omit<AnalyticsData, 'id' | 'created_at'> {
    const totalSessions = trafficSources.reduce((sum, s) => sum + s.sessions, 0)

    return {
      date,
      sessions: apiData.sessions,
      users: apiData.totalUsers,
      new_users: apiData.newUsers,
      page_views: apiData.screenPageViews,
      bounce_rate: apiData.bounceRate * 100, // Convert to percentage
      avg_session_duration: apiData.averageSessionDuration,
      traffic_sources: trafficSources.map(
        (s): TrafficSource => ({
          source: s.source,
          medium: s.medium,
          sessions: s.sessions,
          users: s.users,
          percentage: totalSessions > 0 ? (s.sessions / totalSessions) * 100 : 0,
        })
      ),
      top_pages: topPages.map(
        (p): TopPage => ({
          page_path: p.pagePath,
          page_title: p.pageTitle,
          page_views: p.pageViews,
          avg_time_on_page: p.avgTimeOnPage,
        })
      ),
    }
  }
}

// Factory function to create service instance from Supabase settings
export async function createGoogleAnalyticsServiceFromSupabase(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  onTokenRefreshed?: (tokenData: { accessToken: string; expiresAt?: Date }) => Promise<void>
): Promise<GoogleAnalyticsService | null> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('settings, connected')
    .eq('integration', 'analytics')
    .single()

  const dataTyped = data as any

  if (error || !dataTyped || !dataTyped.connected) {
    return null
  }

  const settings = dataTyped.settings as {
    access_token?: string
    refresh_token?: string
    expires_at?: string
    property_id?: string
  }

  if (!settings.access_token || !settings.property_id) {
    return null
  }

  return new GoogleAnalyticsService({
    propertyId: settings.property_id,
    accessToken: settings.access_token,
    refreshToken: settings.refresh_token,
    expiresAt: settings.expires_at,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    onTokenRefreshed,
  })
}

// Legacy factory function (for backward compatibility)
export function createGoogleAnalyticsService(): GoogleAnalyticsService | null {
  const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID
  const accessToken = process.env.GOOGLE_ACCESS_TOKEN
  
  if (!propertyId || !accessToken) return null
  
  return new GoogleAnalyticsService({
    propertyId,
    accessToken,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  })
}
