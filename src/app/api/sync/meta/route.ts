import { NextRequest, NextResponse } from 'next/server'
import { createMetaService } from '@/lib/integrations/meta'

export async function POST(request: NextRequest) {
  try {
    const metaService = createMetaService()
    if (!metaService) {
      return NextResponse.json(
        { error: 'Meta integration not configured. Please add META_ACCESS_TOKEN and META_AD_ACCOUNT_ID to environment variables.' },
        { status: 400 }
      )
    }

    // Fetch campaigns
    const campaignsResponse = await metaService.getCampaigns()
    const transformedCampaigns = []

    // Process each campaign
    for (const campaign of campaignsResponse.data) {
      // Get insights for the campaign (last 30 days)
      const insightsResponse = await metaService.getCampaignInsights(campaign.id, {
        datePreset: 'last_30d',
      })

      const insights = insightsResponse.data[0]
      const transformedCampaign = metaService.transformCampaign(campaign, insights)

      transformedCampaigns.push({
        id: `${campaign.id}_${transformedCampaign.date}`,
        ...transformedCampaign,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Fetched ${transformedCampaigns.length} Meta campaigns`,
      records_synced: transformedCampaigns.length,
      data: transformedCampaigns,
    })
  } catch (error) {
    console.error('Meta sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync Meta data', details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Use POST to trigger Meta sync',
    configured: !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID)
  })
}
