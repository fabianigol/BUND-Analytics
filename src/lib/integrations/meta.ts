import { MetaCampaign } from '@/types'

const META_API_URL = 'https://graph.facebook.com/v18.0'

interface MetaConfig {
  accessToken: string
  adAccountId: string
}

export class MetaService {
  private accessToken: string
  private adAccountId: string

  constructor(config: MetaConfig) {
    this.accessToken = config.accessToken
    this.adAccountId = config.adAccountId
  }

  private async request<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const searchParams = new URLSearchParams({
      access_token: this.accessToken,
      ...params,
    })

    const response = await fetch(`${META_API_URL}${endpoint}?${searchParams}`)

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Meta API error: ${error.error?.message || response.statusText}`)
    }

    return response.json()
  }

  async getCampaigns() {
    return this.request<{
      data: Array<{
        id: string
        name: string
        status: string
        objective: string
        created_time: string
        updated_time: string
      }>
    }>(`/${this.adAccountId}/campaigns`, {
      fields: 'id,name,status,objective,created_time,updated_time',
    })
  }

  async getCampaignInsights(
    campaignId: string,
    params?: {
      datePreset?: string
      timeRange?: { since: string; until: string }
    }
  ) {
    const fields = 'spend,impressions,clicks,conversions,cpm,cpc,ctr'
    const insightParams: Record<string, string> = { fields }

    if (params?.datePreset) {
      insightParams.date_preset = params.datePreset
    } else if (params?.timeRange) {
      insightParams.time_range = JSON.stringify(params.timeRange)
    }

    return this.request<{
      data: Array<{
        spend: string
        impressions: string
        clicks: string
        conversions?: string
        cpm: string
        cpc: string
        ctr: string
        date_start: string
        date_stop: string
      }>
    }>(`/${campaignId}/insights`, insightParams)
  }

  async getAdAccountInsights(params?: {
    datePreset?: string
    timeRange?: { since: string; until: string }
    level?: 'account' | 'campaign' | 'adset' | 'ad'
  }) {
    const fields = 'spend,impressions,clicks,actions,cpm,cpc,ctr,reach,frequency'
    const insightParams: Record<string, string> = {
      fields,
      level: params?.level || 'account',
    }

    if (params?.datePreset) {
      insightParams.date_preset = params.datePreset
    } else if (params?.timeRange) {
      insightParams.time_range = JSON.stringify(params.timeRange)
    }

    return this.request<{
      data: Array<{
        spend: string
        impressions: string
        clicks: string
        actions?: Array<{ action_type: string; value: string }>
        cpm: string
        cpc: string
        ctr: string
        reach: string
        frequency: string
        date_start: string
        date_stop: string
      }>
    }>(`/${this.adAccountId}/insights`, insightParams)
  }

  async getAdSets(campaignId?: string) {
    const endpoint = campaignId
      ? `/${campaignId}/adsets`
      : `/${this.adAccountId}/adsets`

    return this.request<{
      data: Array<{
        id: string
        name: string
        status: string
        daily_budget?: string
        lifetime_budget?: string
        campaign_id: string
      }>
    }>(endpoint, {
      fields: 'id,name,status,daily_budget,lifetime_budget,campaign_id',
    })
  }

  // Transform Meta API data to our internal format
  transformCampaign(
    campaign: { id: string; name: string; status: string; objective: string; created_time: string },
    insights?: {
      spend: string
      impressions: string
      clicks: string
      conversions?: string
      cpm: string
      cpc: string
      ctr: string
      date_start: string
    }
  ): Omit<MetaCampaign, 'id'> {
    const conversions = insights?.conversions ? parseInt(insights.conversions) : 0
    const spend = insights ? parseFloat(insights.spend) : 0

    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      status: campaign.status as 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED',
      objective: campaign.objective,
      spend,
      impressions: insights ? parseInt(insights.impressions) : 0,
      clicks: insights ? parseInt(insights.clicks) : 0,
      conversions,
      cpm: insights ? parseFloat(insights.cpm) : 0,
      cpc: insights ? parseFloat(insights.cpc) : 0,
      ctr: insights ? parseFloat(insights.ctr) : 0,
      roas: spend > 0 && conversions > 0 ? (conversions * 50) / spend : 0, // Approximate ROAS
      date: insights?.date_start || new Date().toISOString().split('T')[0],
      created_at: campaign.created_time,
    }
  }
}

// Factory function to create service instance
export function createMetaService(): MetaService | null {
  const accessToken = process.env.META_ACCESS_TOKEN
  const adAccountId = process.env.META_AD_ACCOUNT_ID
  if (!accessToken || !adAccountId) return null
  return new MetaService({ accessToken, adAccountId })
}

