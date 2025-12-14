import { ShopifyOrder, ShopifyLineItem } from '@/types'

interface ShopifyConfig {
  shopDomain: string
  accessToken: string
  apiVersion?: string
}

export class ShopifyService {
  private shopDomain: string
  private accessToken: string
  private apiVersion: string

  constructor(config: ShopifyConfig) {
    this.shopDomain = config.shopDomain
    this.accessToken = config.accessToken
    this.apiVersion = config.apiVersion || '2024-01'
  }

  private get baseUrl(): string {
    return `https://${this.shopDomain}/admin/api/${this.apiVersion}`
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`)
    }

    return response.json()
  }

  async getOrders(params?: {
    status?: 'open' | 'closed' | 'cancelled' | 'any'
    financialStatus?: string
    fulfillmentStatus?: string
    createdAtMin?: string
    createdAtMax?: string
    limit?: number
  }) {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.financialStatus) searchParams.set('financial_status', params.financialStatus)
    if (params?.fulfillmentStatus) searchParams.set('fulfillment_status', params.fulfillmentStatus)
    if (params?.createdAtMin) searchParams.set('created_at_min', params.createdAtMin)
    if (params?.createdAtMax) searchParams.set('created_at_max', params.createdAtMax)
    if (params?.limit) searchParams.set('limit', params.limit.toString())

    const query = searchParams.toString() ? `?${searchParams}` : ''
    return this.request<{
      orders: Array<{
        id: number
        order_number: number
        total_price: string
        subtotal_price: string
        total_tax: string
        currency: string
        financial_status: string
        fulfillment_status: string | null
        customer: { email: string; first_name: string; last_name: string }
        line_items: Array<{
          id: number
          title: string
          quantity: number
          price: string
          sku: string
          product_id: number
        }>
        created_at: string
        processed_at: string
      }>
    }>(`/orders.json${query}`)
  }

  async getOrder(orderId: string) {
    return this.request<{
      order: {
        id: number
        order_number: number
        total_price: string
        subtotal_price: string
        total_tax: string
        currency: string
        financial_status: string
        fulfillment_status: string | null
        customer: { email: string; first_name: string; last_name: string }
        line_items: Array<{
          id: number
          title: string
          quantity: number
          price: string
          sku: string
          product_id: number
        }>
        created_at: string
        processed_at: string
      }
    }>(`/orders/${orderId}.json`)
  }

  async getProducts(params?: { limit?: number; status?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.status) searchParams.set('status', params.status)

    const query = searchParams.toString() ? `?${searchParams}` : ''
    return this.request<{
      products: Array<{
        id: number
        title: string
        handle: string
        status: string
        vendor: string
        product_type: string
        variants: Array<{ inventory_quantity: number }>
        created_at: string
      }>
    }>(`/products.json${query}`)
  }

  async getOrdersCount(params?: { status?: string; financialStatus?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.financialStatus) searchParams.set('financial_status', params.financialStatus)

    const query = searchParams.toString() ? `?${searchParams}` : ''
    return this.request<{ count: number }>(`/orders/count.json${query}`)
  }

  // Transform Shopify API data to our internal format
  transformOrder(apiOrder: {
    id: number
    order_number: number
    total_price: string
    subtotal_price: string
    total_tax: string
    currency: string
    financial_status: string
    fulfillment_status: string | null
    customer: { email: string; first_name: string; last_name: string }
    line_items: Array<{
      id: number
      title: string
      quantity: number
      price: string
      sku: string
      product_id: number
    }>
    created_at: string
    processed_at: string
  }): Omit<ShopifyOrder, 'id'> {
    return {
      order_number: `#${apiOrder.order_number}`,
      total_price: parseFloat(apiOrder.total_price),
      subtotal_price: parseFloat(apiOrder.subtotal_price),
      total_tax: parseFloat(apiOrder.total_tax),
      currency: apiOrder.currency,
      financial_status: apiOrder.financial_status,
      fulfillment_status: apiOrder.fulfillment_status,
      customer_email: apiOrder.customer?.email || '',
      customer_name: `${apiOrder.customer?.first_name || ''} ${apiOrder.customer?.last_name || ''}`.trim(),
      line_items: apiOrder.line_items.map((item): ShopifyLineItem => ({
        id: item.id.toString(),
        title: item.title,
        quantity: item.quantity,
        price: parseFloat(item.price),
        sku: item.sku,
        product_id: item.product_id.toString(),
      })),
      created_at: apiOrder.created_at,
      processed_at: apiOrder.processed_at,
    }
  }
}

// Factory function to create service instance
export function createShopifyService(): ShopifyService | null {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN
  if (!shopDomain || !accessToken) return null
  return new ShopifyService({
    shopDomain,
    accessToken,
    apiVersion: process.env.SHOPIFY_API_VERSION,
  })
}

