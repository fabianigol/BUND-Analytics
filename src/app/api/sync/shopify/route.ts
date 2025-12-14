import { NextRequest, NextResponse } from 'next/server'
import { createShopifyService } from '@/lib/integrations/shopify'
import { subDays } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    const shopifyService = createShopifyService()
    if (!shopifyService) {
      return NextResponse.json(
        { error: 'Shopify integration not configured. Please add SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN to environment variables.' },
        { status: 400 }
      )
    }

    // Fetch orders from the last 30 days
    const createdAtMin = subDays(new Date(), 30).toISOString()
    const ordersResponse = await shopifyService.getOrders({
      status: 'any',
      createdAtMin,
      limit: 250,
    })

    const transformedOrders = ordersResponse.orders.map(order => ({
      id: order.id.toString(),
      ...shopifyService.transformOrder(order),
    }))

    return NextResponse.json({
      success: true,
      message: `Fetched ${transformedOrders.length} Shopify orders`,
      records_synced: transformedOrders.length,
      data: transformedOrders,
    })
  } catch (error) {
    console.error('Shopify sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync Shopify data', details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Use POST to trigger Shopify sync',
    configured: !!(process.env.SHOPIFY_SHOP_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN)
  })
}
