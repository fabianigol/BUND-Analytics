import { createClient } from '@/lib/supabase/server'

export interface SearchQuery {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface SearchQueryGroup {
  mainQuery: string
  relatedQueries: string[]
  totalClicks: number
  totalImpressions: number
  avgCtr: number
  avgPosition: number
  trend: number // Percentage change compared to previous period
}

interface SearchConsoleConfig {
  siteUrl: string
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  clientId?: string
  clientSecret?: string
  onTokenRefreshed?: (tokenData: { accessToken: string; expiresAt?: Date }) => Promise<void>
}

export class GoogleSearchConsoleService {
  private siteUrl: string
  private accessToken: string
  private refreshToken?: string
  private expiresAt?: Date
  private clientId?: string
  private clientSecret?: string
  private onTokenRefreshed?: (tokenData: { accessToken: string; expiresAt?: Date }) => Promise<void>

  constructor(config: SearchConsoleConfig) {
    this.siteUrl = config.siteUrl
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
          console.log('[Search Console Service] Refreshed token saved to database')
        } catch (error) {
          console.error('[Search Console Service] Error saving refreshed token:', error)
        }
      }
    }

    return this.accessToken
  }

  // Get search queries for a date range
  async getSearchQueries(dateRange: { startDate: string; endDate: string }): Promise<SearchQuery[]> {
    const token = await this.ensureValidToken()
    
    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(this.siteUrl)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          dimensions: ['query'],
          rowLimit: 100,
          startRow: 0,
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Search Console] API error:', errorText)
      throw new Error(`Search Console API error: ${errorText}`)
    }

    const data = await response.json()
    
    return (data.rows || []).map((row: any) => ({
      query: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: (row.ctr || 0) * 100, // Convert to percentage
      position: row.position || 0,
    }))
  }

  // Group similar queries together
  groupSimilarQueries(
    currentQueries: SearchQuery[],
    previousQueries: SearchQuery[]
  ): SearchQueryGroup[] {
    // Create a map of previous queries for comparison
    const previousMap = new Map<string, SearchQuery>()
    previousQueries.forEach(q => previousMap.set(q.query.toLowerCase(), q))

    // Group queries by finding common patterns
    const groups = new Map<string, SearchQuery[]>()
    
    currentQueries.forEach(query => {
      // Find the main keyword (most significant word)
      const words = query.query.toLowerCase().split(/\s+/)
      const mainKeyword = this.findMainKeyword(words, currentQueries)
      
      if (!groups.has(mainKeyword)) {
        groups.set(mainKeyword, [])
      }
      groups.get(mainKeyword)!.push(query)
    })

    // Convert groups to SearchQueryGroup format
    const result: SearchQueryGroup[] = []
    
    groups.forEach((queries, mainKeyword) => {
      // Sort queries by clicks descending
      queries.sort((a, b) => b.clicks - a.clicks)
      
      const mainQuery = queries[0].query
      const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0)
      const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0)
      const avgCtr = queries.reduce((sum, q) => sum + q.ctr, 0) / queries.length
      const avgPosition = queries.reduce((sum, q) => sum + q.position, 0) / queries.length
      
      // Calculate trend by comparing with previous period
      const previousClicks = queries.reduce((sum, q) => {
        const prev = previousMap.get(q.query.toLowerCase())
        return sum + (prev?.clicks || 0)
      }, 0)
      
      const trend = previousClicks > 0 
        ? ((totalClicks - previousClicks) / previousClicks) * 100
        : totalClicks > 0 ? 100 : 0
      
      result.push({
        mainQuery,
        relatedQueries: queries.slice(1).map(q => q.query),
        totalClicks,
        totalImpressions,
        avgCtr,
        avgPosition,
        trend,
      })
    })

    // Sort by clicks descending
    result.sort((a, b) => b.totalClicks - a.totalClicks)
    
    return result
  }

  // Find the most significant keyword for grouping
  private findMainKeyword(words: string[], allQueries: SearchQuery[]): string {
    // Common stop words to ignore
    const stopWords = new Set(['a', 'de', 'en', 'el', 'la', 'los', 'las', 'un', 'una', 'y', 'o', 'the', 'of', 'to', 'and', 'in'])
    
    // Find the word that appears most frequently across all queries
    const wordFrequency = new Map<string, number>()
    
    allQueries.forEach(q => {
      const queryWords = q.query.toLowerCase().split(/\s+/)
      queryWords.forEach(w => {
        if (!stopWords.has(w) && w.length > 2) {
          wordFrequency.set(w, (wordFrequency.get(w) || 0) + q.clicks)
        }
      })
    })

    // Find the main keyword from the current query words
    let mainKeyword = words[0]
    let maxScore = 0
    
    words.forEach(word => {
      if (!stopWords.has(word) && word.length > 2) {
        const score = wordFrequency.get(word) || 0
        if (score > maxScore) {
          maxScore = score
          mainKeyword = word
        }
      }
    })

    return mainKeyword
  }
}

// Factory function to create service instance from Supabase settings
export async function createSearchConsoleServiceFromSupabase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  onTokenRefreshed?: (tokenData: { accessToken: string; expiresAt?: Date }) => Promise<void>
): Promise<GoogleSearchConsoleService | null> {
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
    site_url?: string
  }

  if (!settings.access_token) {
    return null
  }

  // Use site_url if configured, otherwise use a default based on the domain
  const siteUrl = settings.site_url || 'sc-domain:bundcompany.com'

  return new GoogleSearchConsoleService({
    siteUrl,
    accessToken: settings.access_token,
    refreshToken: settings.refresh_token,
    expiresAt: settings.expires_at,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    onTokenRefreshed,
  })
}
