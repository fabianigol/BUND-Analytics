interface BusinessProfileConfig {
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  clientId?: string
  clientSecret?: string
}

export interface BusinessProfileLocation {
  name: string
  locationId: string
  title: string
  address?: string
  phoneNumber?: string
  websiteUri?: string
}

export interface BusinessProfileReview {
  reviewId: string
  reviewer: {
    displayName: string
    profilePhotoUrl?: string
    isAnonymous: boolean
  }
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE'
  comment?: string
  createTime: string
  updateTime: string
  reply?: {
    comment: string
    updateTime: string
  }
  locationName: string
  locationId: string
}

export interface ReviewMetrics {
  averageRating: number
  totalReviews: number
  newReviews: number
  responseRate: number
  distribution: {
    one: number
    two: number
    three: number
    four: number
    five: number
  }
  ratingByLocation: Array<{
    locationId: string
    locationName: string
    averageRating: number
    totalReviews: number
  }>
}

export class GoogleBusinessProfileService {
  private accessToken: string
  private refreshToken?: string
  private expiresAt?: Date
  private clientId?: string
  private clientSecret?: string

  constructor(config: BusinessProfileConfig) {
    this.accessToken = config.accessToken
    this.refreshToken = config.refreshToken
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
    
    if (config.expiresAt) {
      this.expiresAt = new Date(config.expiresAt)
    }
  }

  // Refresh access token if needed
  private async ensureValidToken(): Promise<string> {
    // Check if token is expired or will expire in the next 5 minutes
    if (this.expiresAt && new Date() >= new Date(this.expiresAt.getTime() - 5 * 60 * 1000)) {
      if (!this.refreshToken || !this.clientId || !this.clientSecret) {
        throw new Error('Token expired and no refresh token available')
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
        const errorData = await response.text()
        throw new Error(`Failed to refresh token: ${errorData}`)
      }

      const tokenData = await response.json()
      this.accessToken = tokenData.access_token
      
      if (tokenData.expires_in) {
        this.expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)
      }
    }

    return this.accessToken
  }

  // Make authenticated API request
  private async makeRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = await this.ensureValidToken()
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.text()
      throw new Error(`API request failed: ${response.status} ${errorData}`)
    }

    return response.json()
  }

  // Get all accounts
  async getAccounts(): Promise<Array<{ name: string; accountName: string }>> {
    const data = await this.makeRequest<{ accounts?: Array<{ name: string; accountName: string }> }>(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
    )
    return data.accounts || []
  }

  // Get locations for an account
  async getLocations(accountName: string): Promise<BusinessProfileLocation[]> {
    try {
      const data = await this.makeRequest<{ locations?: Array<{
        name: string
        title: string
        storefrontAddress?: {
          addressLines?: string[]
          locality?: string
          administrativeArea?: string
          postalCode?: string
          regionCode?: string
        }
        primaryPhone?: string
        websiteUri?: string
      }> }>(
        `https://mybusinessaccountmanagement.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,primaryPhone,websiteUri`
      )

      if (!data.locations) {
        return []
      }

      return data.locations.map((location) => {
        const addressParts = location.storefrontAddress?.addressLines || []
        const address = addressParts.length > 0 
          ? `${addressParts.join(', ')}, ${location.storefrontAddress?.locality || ''}, ${location.storefrontAddress?.postalCode || ''}`
          : undefined

        return {
          name: location.name,
          locationId: location.name.split('/').pop() || '',
          title: location.title,
          address,
          phoneNumber: location.primaryPhone,
          websiteUri: location.websiteUri,
        }
      })
    } catch (error) {
      console.error('Error fetching locations:', error)
      // Try alternative API endpoint
      return this.getLocationsAlternative(accountName)
    }
  }

  // Alternative method to get locations (using different API version)
  private async getLocationsAlternative(accountName: string): Promise<BusinessProfileLocation[]> {
    try {
      // Try using the mybusiness API v4
      const data = await this.makeRequest<{ locations?: Array<{
        name: string
        locationName: string
        storefrontAddress?: {
          addressLines?: string[]
          locality?: string
          administrativeArea?: string
          postalCode?: string
        }
        primaryPhone?: string
        websiteUri?: string
      }> }>(
        `https://mybusiness.googleapis.com/v4/${accountName}/locations`
      )

      if (!data.locations) {
        return []
      }

      return data.locations.map((location) => {
        const addressParts = location.storefrontAddress?.addressLines || []
        const address = addressParts.length > 0 
          ? `${addressParts.join(', ')}, ${location.storefrontAddress?.locality || ''}, ${location.storefrontAddress?.postalCode || ''}`
          : undefined

        return {
          name: location.name || location.locationName,
          locationId: (location.name || location.locationName).split('/').pop() || '',
          title: location.locationName || '',
          address,
          phoneNumber: location.primaryPhone,
          websiteUri: location.websiteUri,
        }
      })
    } catch (error) {
      console.error('Error in alternative location fetch:', error)
      return []
    }
  }

  // Get reviews for a specific location
  async getReviews(accountName: string, locationId: string): Promise<BusinessProfileReview[]> {
    try {
      const locationName = `${accountName}/locations/${locationId}`
      const data = await this.makeRequest<{ reviews?: Array<{
        reviewId: string
        reviewer: {
          displayName: string
          profilePhotoUrl?: string
          isAnonymous: boolean
        }
        starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE'
        comment?: string
        createTime: string
        updateTime: string
        reply?: {
          comment: string
          updateTime: string
        }
      }> }>(
        `https://mybusiness.googleapis.com/v4/${locationName}/reviews`
      )

      if (!data.reviews) {
        return []
      }

      return data.reviews.map((review) => ({
        reviewId: review.reviewId,
        reviewer: review.reviewer,
        starRating: review.starRating,
        comment: review.comment,
        createTime: review.createTime,
        updateTime: review.updateTime,
        reply: review.reply,
        locationName: locationName,
        locationId,
      }))
    } catch (error) {
      console.error(`Error fetching reviews for location ${locationId}:`, error)
      return []
    }
  }

  // Get all reviews from all locations
  async getAllReviews(accountName: string): Promise<BusinessProfileReview[]> {
    const locations = await this.getLocations(accountName)
    const allReviews: BusinessProfileReview[] = []

    for (const location of locations) {
      const reviews = await this.getReviews(accountName, location.locationId)
      allReviews.push(...reviews)
    }

    return allReviews
  }

  // Calculate review metrics
  calculateMetrics(
    reviews: BusinessProfileReview[],
    lastSyncTime?: string
  ): ReviewMetrics {
    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        newReviews: 0,
        responseRate: 0,
        distribution: {
          one: 0,
          two: 0,
          three: 0,
          four: 0,
          five: 0,
        },
        ratingByLocation: [],
      }
    }

    // Calculate distribution
    const distribution = {
      one: 0,
      two: 0,
      three: 0,
      four: 0,
      five: 0,
    }

    let totalRating = 0
    let respondedCount = 0
    let newReviewsCount = 0

    const lastSync = lastSyncTime ? new Date(lastSyncTime) : null

    reviews.forEach((review) => {
      const rating = this.starRatingToNumber(review.starRating)
      totalRating += rating

      switch (rating) {
        case 1:
          distribution.one++
          break
        case 2:
          distribution.two++
          break
        case 3:
          distribution.three++
          break
        case 4:
          distribution.four++
          break
        case 5:
          distribution.five++
          break
      }

      if (review.reply) {
        respondedCount++
      }

      if (lastSync && new Date(review.createTime) > lastSync) {
        newReviewsCount++
      }
    })

    const averageRating = totalRating / reviews.length
    const responseRate = (respondedCount / reviews.length) * 100

    // Calculate rating by location
    const locationMap = new Map<string, { reviews: BusinessProfileReview[]; name: string }>()
    reviews.forEach((review) => {
      const existing = locationMap.get(review.locationId) || { reviews: [], name: review.locationName }
      existing.reviews.push(review)
      locationMap.set(review.locationId, existing)
    })

    const ratingByLocation = Array.from(locationMap.entries()).map(([locationId, data]) => {
      const locationTotal = data.reviews.reduce((sum, r) => sum + this.starRatingToNumber(r.starRating), 0)
      return {
        locationId,
        locationName: data.name.split('/').pop() || locationId,
        averageRating: locationTotal / data.reviews.length,
        totalReviews: data.reviews.length,
      }
    })

    return {
      averageRating,
      totalReviews: reviews.length,
      newReviews: newReviewsCount,
      responseRate,
      distribution,
      ratingByLocation,
    }
  }

  // Convert star rating enum to number
  private starRatingToNumber(rating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE'): number {
    const map: Record<string, number> = {
      ONE: 1,
      TWO: 2,
      THREE: 3,
      FOUR: 4,
      FIVE: 5,
    }
    return map[rating] || 0
  }

  // Get review metrics for a specific location
  async getReviewMetrics(
    accountName: string,
    locationId: string,
    lastSyncTime?: string
  ): Promise<ReviewMetrics> {
    const reviews = await this.getReviews(accountName, locationId)
    return this.calculateMetrics(reviews, lastSyncTime)
  }
}

// Factory function to create service instance from Supabase settings
export async function createGoogleBusinessProfileServiceFromSupabase(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>
): Promise<GoogleBusinessProfileService | null> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('settings, connected')
    .eq('integration', 'business-profile')
    .single()

  const dataTyped = data as any

  if (error || !dataTyped || !dataTyped.connected) {
    return null
  }

  const settings = dataTyped.settings as {
    access_token?: string
    refresh_token?: string
    expires_at?: string
    account_name?: string
  }

  if (!settings.access_token) {
    return null
  }

  return new GoogleBusinessProfileService({
    accessToken: settings.access_token,
    refreshToken: settings.refresh_token,
    expiresAt: settings.expires_at,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  })
}

