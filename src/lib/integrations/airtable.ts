interface AirtableConfig {
  apiKey: string
  baseId: string
}

interface AirtableRecord {
  id: string
  fields: Record<string, unknown>
  createdTime: string
}

interface AirtableResponse<T> {
  records: Array<{
    id: string
    fields: T
    createdTime: string
  }>
  offset?: string
}

export class AirtableService {
  private apiKey: string
  private baseId: string
  private baseUrl = 'https://api.airtable.com/v0'

  constructor(config: AirtableConfig) {
    this.apiKey = config.apiKey
    this.baseId = config.baseId
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${this.baseId}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Airtable API error: ${error.error?.message || response.statusText}`)
    }

    return response.json()
  }

  async listRecords<T>(
    tableName: string,
    params?: {
      view?: string
      maxRecords?: number
      pageSize?: number
      sort?: Array<{ field: string; direction: 'asc' | 'desc' }>
      filterByFormula?: string
      fields?: string[]
    }
  ): Promise<AirtableResponse<T>> {
    const searchParams = new URLSearchParams()

    if (params?.view) searchParams.set('view', params.view)
    if (params?.maxRecords) searchParams.set('maxRecords', params.maxRecords.toString())
    if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString())
    if (params?.filterByFormula) searchParams.set('filterByFormula', params.filterByFormula)
    if (params?.fields) {
      params.fields.forEach((field) => searchParams.append('fields[]', field))
    }
    if (params?.sort) {
      params.sort.forEach((s, i) => {
        searchParams.set(`sort[${i}][field]`, s.field)
        searchParams.set(`sort[${i}][direction]`, s.direction)
      })
    }

    const query = searchParams.toString() ? `?${searchParams}` : ''
    return this.request<AirtableResponse<T>>(`/${encodeURIComponent(tableName)}${query}`)
  }

  async getRecord<T>(tableName: string, recordId: string): Promise<{ id: string; fields: T; createdTime: string }> {
    return this.request<{ id: string; fields: T; createdTime: string }>(
      `/${encodeURIComponent(tableName)}/${recordId}`
    )
  }

  async createRecords<T>(
    tableName: string,
    records: Array<{ fields: Partial<T> }>
  ): Promise<AirtableResponse<T>> {
    return this.request<AirtableResponse<T>>(`/${encodeURIComponent(tableName)}`, {
      method: 'POST',
      body: JSON.stringify({ records }),
    })
  }

  async updateRecords<T>(
    tableName: string,
    records: Array<{ id: string; fields: Partial<T> }>
  ): Promise<AirtableResponse<T>> {
    return this.request<AirtableResponse<T>>(`/${encodeURIComponent(tableName)}`, {
      method: 'PATCH',
      body: JSON.stringify({ records }),
    })
  }

  async deleteRecords(tableName: string, recordIds: string[]): Promise<{ records: Array<{ id: string; deleted: boolean }> }> {
    const searchParams = new URLSearchParams()
    recordIds.forEach((id) => searchParams.append('records[]', id))

    return this.request<{ records: Array<{ id: string; deleted: boolean }> }>(
      `/${encodeURIComponent(tableName)}?${searchParams}`,
      { method: 'DELETE' }
    )
  }

  // Get all records (handles pagination)
  async getAllRecords<T>(
    tableName: string,
    params?: {
      view?: string
      filterByFormula?: string
      fields?: string[]
    }
  ): Promise<Array<{ id: string; fields: T; createdTime: string }>> {
    const allRecords: Array<{ id: string; fields: T; createdTime: string }> = []
    let offset: string | undefined

    do {
      const searchParams = new URLSearchParams()
      if (params?.view) searchParams.set('view', params.view)
      if (params?.filterByFormula) searchParams.set('filterByFormula', params.filterByFormula)
      if (params?.fields) {
        params.fields.forEach((field) => searchParams.append('fields[]', field))
      }
      if (offset) searchParams.set('offset', offset)

      const query = searchParams.toString() ? `?${searchParams}` : ''
      const response = await this.request<AirtableResponse<T>>(
        `/${encodeURIComponent(tableName)}${query}`
      )

      allRecords.push(...response.records)
      offset = response.offset
    } while (offset)

    return allRecords
  }

  // Transform Airtable record to internal format
  transformRecord(record: AirtableRecord) {
    return {
      id: record.id,
      fields: record.fields,
      created_at: record.createdTime,
    }
  }
}

// Factory function to create service instance
export function createAirtableService(): AirtableService | null {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) return null
  return new AirtableService({ apiKey, baseId })
}

