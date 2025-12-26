import { ShopifyOrder, ShopifyLineItem } from '@/types'

interface ShopifyConfig {
  shopDomain: string
  accessToken: string
  apiVersion?: string
}

interface ShopifyResponse<T> {
  data: T
  link?: string
}

export class ShopifyService {
  private shopDomain: string
  private accessToken: string
  private apiVersion: string
  private readonly rateLimitDelay = 500 // 500ms entre requests (2 req/s)

  constructor(config: ShopifyConfig) {
    this.shopDomain = config.shopDomain
    this.accessToken = config.accessToken
    this.apiVersion = config.apiVersion || '2024-01'
  }

  private get baseUrl(): string {
    return `https://${this.shopDomain}/admin/api/${this.apiVersion}`
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit,
    retries = 3
  ): Promise<{ data: T; headers: Headers }> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
            'Content-Type': 'application/json',
            ...options?.headers,
          },
        })

        // Rate limiting - retry with exponential backoff
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000
          console.warn(`Rate limited, waiting ${delay}ms before retry ${attempt + 1}/${retries}`)
          await this.sleep(delay)
          continue
        }

        if (!response.ok) {
          const errorText = await response.text()
          let errorMessage = `Shopify API error: ${response.status} ${response.statusText}`
          try {
            const errorJson = JSON.parse(errorText)
            // Manejar diferentes formatos de error de Shopify
            if (errorJson.errors) {
              if (typeof errorJson.errors === 'string') {
                errorMessage = errorJson.errors
              } else if (Array.isArray(errorJson.errors)) {
                errorMessage = errorJson.errors.join(', ')
              } else if (typeof errorJson.errors === 'object') {
                errorMessage = JSON.stringify(errorJson.errors)
              } else {
                errorMessage = String(errorJson.errors)
              }
            } else if (errorJson.error) {
              errorMessage = typeof errorJson.error === 'string' ? errorJson.error : JSON.stringify(errorJson.error)
            }
          } catch (e) {
            // Si no se puede parsear, usar el texto tal cual
            errorMessage = errorText || errorMessage
          }
          throw new Error(errorMessage)
        }

        const data = await response.json()
        
        // Rate limiting: wait before next request
        await this.sleep(this.rateLimitDelay)
        
        return { data, headers: response.headers }
      } catch (error: any) {
        if (attempt === retries - 1) {
          throw error
        }
        // Exponential backoff for other errors
        const delay = Math.pow(2, attempt) * 1000
        console.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`)
        await this.sleep(delay)
      }
    }
    throw new Error('Max retries exceeded')
  }

  async getOrders(params?: {
    status?: 'open' | 'closed' | 'cancelled' | 'any'
    financialStatus?: string
    fulfillmentStatus?: string
    createdAtMin?: string
    createdAtMax?: string
    limit?: number
    pageInfo?: string
  }) {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.financialStatus) searchParams.set('financial_status', params.financialStatus)
    if (params?.fulfillmentStatus) searchParams.set('fulfillment_status', params.fulfillmentStatus)
    if (params?.createdAtMin) searchParams.set('created_at_min', params.createdAtMin)
    if (params?.createdAtMax) searchParams.set('created_at_max', params.createdAtMax)
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.pageInfo) searchParams.set('page_info', params.pageInfo)

    const query = searchParams.toString() ? `?${searchParams}` : ''
    const result = await this.request<{
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
    return result.data
  }

  /**
   * Obtiene todos los pedidos con paginación automática
   */
  async getAllOrders(params?: {
    status?: 'open' | 'closed' | 'cancelled' | 'any'
    financialStatus?: string
    fulfillmentStatus?: string
    createdAtMin?: string
    createdAtMax?: string
  }): Promise<Array<{
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
  }>> {
    const allOrders: Array<{
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
    }> = []

    let pageInfo: string | undefined = undefined
    const limit = 250 // Máximo permitido por Shopify
    let pageCount = 0
    const maxPages = 100 // Límite de seguridad para evitar loops infinitos

    do {
      try {
        const searchParams = new URLSearchParams()
        
        // IMPORTANTE: Cuando usamos page_info, NO podemos pasar otros parámetros
        // El page_info ya contiene toda la información de filtros codificada
        if (pageInfo) {
          // Solo pasar page_info y limit cuando hay paginación
          searchParams.set('page_info', pageInfo)
          searchParams.set('limit', limit.toString())
          console.log(`[Shopify] Fetching page ${pageCount + 1} with page_info: ${pageInfo.substring(0, 50)}...`)
        } else {
          // Primera página: pasar todos los parámetros de filtro
          if (params?.status) searchParams.set('status', params.status)
          if (params?.financialStatus) searchParams.set('financial_status', params.financialStatus)
          if (params?.fulfillmentStatus) searchParams.set('fulfillment_status', params.fulfillmentStatus)
          if (params?.createdAtMin) searchParams.set('created_at_min', params.createdAtMin)
          if (params?.createdAtMax) searchParams.set('created_at_max', params.createdAtMax)
          searchParams.set('limit', limit.toString())
          console.log(`[Shopify] Fetching page ${pageCount + 1} (first page)`)
        }

        const query = searchParams.toString()
        const result = await this.request<{
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
      }>(`/orders.json?${query}`)

      const response = result.data
      const headers = result.headers

      allOrders.push(...response.orders)
      pageCount++

      console.log(`[Shopify] Fetched page ${pageCount}: ${response.orders.length} orders (total so far: ${allOrders.length})`)

      // Extraer page_info del header Link para paginación
      const linkHeader = headers.get('Link')
      if (linkHeader && response.orders.length === limit) {
        // Parsear el header Link para obtener el siguiente page_info
        // Formato: <https://shop.myshopify.com/admin/api/2024-01/orders.json?page_info=...>; rel="next"
        try {
          const nextMatch = linkHeader.match(/<[^>]+page_info=([^&>]+)[^>]*>;\s*rel="next"/)
          if (nextMatch && nextMatch[1]) {
            pageInfo = decodeURIComponent(nextMatch[1])
            console.log(`[Shopify] Found next page_info, continuing pagination...`)
          } else {
            console.log(`[Shopify] No next page found in Link header, stopping pagination`)
            console.log(`[Shopify] Link header: ${linkHeader}`)
            pageInfo = undefined
          }
        } catch (error) {
          console.error(`[Shopify] Error parsing Link header:`, error)
          console.log(`[Shopify] Link header: ${linkHeader}`)
          pageInfo = undefined
        }
      } else {
        // Si hay menos de 250 resultados o no hay header Link, no hay más páginas
        console.log(`[Shopify] No more pages (orders: ${response.orders.length}, limit: ${limit})`)
        if (linkHeader) {
          console.log(`[Shopify] Link header present but orders < limit: ${linkHeader}`)
        }
        pageInfo = undefined
      }

        // Límite de seguridad
        if (pageCount >= maxPages) {
          console.warn(`[Shopify] Reached max pages limit (${maxPages}), stopping pagination`)
          break
        }
      } catch (error: any) {
        console.error(`[Shopify] Error fetching page ${pageCount + 1}:`, error)
        // Si es el primer error y ya tenemos algunos pedidos, retornar lo que tenemos
        if (pageCount > 0 && allOrders.length > 0) {
          console.warn(`[Shopify] Returning ${allOrders.length} orders fetched before error`)
          return allOrders
        }
        // Si es la primera página o no hay pedidos, lanzar el error
        throw new Error(`Error fetching Shopify orders: ${error?.message || String(error)}`)
      }
    } while (pageInfo)

    console.log(`[Shopify] Total orders fetched: ${allOrders.length} across ${pageCount} pages`)
    return allOrders
  }

  async getOrder(orderId: string) {
    const result = await this.request<{
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
    return result.data
  }

  async getProducts(params?: { 
    limit?: number
    status?: string
    pageInfo?: string
  }) {
    const searchParams = new URLSearchParams()
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.status) searchParams.set('status', params.status)
    if (params?.pageInfo) searchParams.set('page_info', params.pageInfo)

    const query = searchParams.toString() ? `?${searchParams}` : ''
    const result = await this.request<{
      products: Array<{
        id: number
        title: string
        handle: string
        status: string
        vendor: string
        product_type: string
        variants: Array<{
          id: number
          title: string
          price: string
          sku: string
          inventory_quantity: number
          product_id: number
        }>
        created_at: string
        updated_at: string
      }>
    }>(`/products.json${query}`)
    return result.data
  }

  /**
   * Obtiene todos los productos con paginación automática
   */
  async getAllProducts(params?: { status?: string }): Promise<Array<{
    id: number
    title: string
    handle: string
    status: string
    vendor: string
    product_type: string
    variants: Array<{
      id: number
      title: string
      price: string
      sku: string
      inventory_quantity: number
      product_id: number
    }>
    created_at: string
    updated_at: string
  }>> {
    const allProducts: Array<{
      id: number
      title: string
      handle: string
      status: string
      vendor: string
      product_type: string
      variants: Array<{
        id: number
        title: string
        price: string
        sku: string
        inventory_quantity: number
        product_id: number
      }>
      created_at: string
      updated_at: string
    }> = []

    let pageInfo: string | undefined = undefined
    const limit = 250

    do {
      const response = await this.getProducts({
        limit,
        status: params?.status,
        pageInfo,
      })

      allProducts.push(...response.products)

      if (response.products.length < limit) {
        break
      }

      // Similar a getAllOrders, necesitaríamos parsear el header Link
      pageInfo = undefined
      break
    } while (pageInfo)

    return allProducts
  }

  async getOrdersCount(params?: { status?: string; financialStatus?: string }) {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.set('status', params.status)
    if (params?.financialStatus) searchParams.set('financial_status', params.financialStatus)

    const query = searchParams.toString() ? `?${searchParams}` : ''
    const result = await this.request<{ count: number }>(`/orders/count.json${query}`)
    return result.data
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

// Factory function to create service instance from environment variables
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

// Factory function to create service instance from config object
export function createShopifyServiceFromConfig(config: {
  shopDomain: string
  accessToken: string
  apiVersion?: string
}): ShopifyService {
  return new ShopifyService(config)
}

