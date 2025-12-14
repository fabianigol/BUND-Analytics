export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          created_at?: string
        }
      }
      roles: {
        Row: {
          id: number
          name: string
          permissions: Json
        }
        Insert: {
          id?: number
          name: string
          permissions: Json
        }
        Update: {
          id?: number
          name?: string
          permissions?: Json
        }
      }
      user_roles: {
        Row: {
          user_id: string
          role_id: number
          created_at: string
        }
        Insert: {
          user_id: string
          role_id: number
          created_at?: string
        }
        Update: {
          user_id?: string
          role_id?: number
          created_at?: string
        }
      }
      calendly_events: {
        Row: {
          id: string
          event_type: string
          event_type_name: string
          start_time: string
          end_time: string
          invitee_email: string
          invitee_name: string
          status: string
          canceled_at: string | null
          cancellation_reason: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_type: string
          event_type_name: string
          start_time: string
          end_time: string
          invitee_email: string
          invitee_name: string
          status: string
          canceled_at?: string | null
          cancellation_reason?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          event_type_name?: string
          start_time?: string
          end_time?: string
          invitee_email?: string
          invitee_name?: string
          status?: string
          canceled_at?: string | null
          cancellation_reason?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      shopify_orders: {
        Row: {
          id: string
          order_number: string
          total_price: number
          subtotal_price: number
          total_tax: number
          currency: string
          financial_status: string
          fulfillment_status: string | null
          customer_email: string
          customer_name: string
          line_items: Json
          created_at: string
          processed_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number: string
          total_price: number
          subtotal_price: number
          total_tax: number
          currency: string
          financial_status: string
          fulfillment_status?: string | null
          customer_email: string
          customer_name: string
          line_items: Json
          created_at?: string
          processed_at: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_number?: string
          total_price?: number
          subtotal_price?: number
          total_tax?: number
          currency?: string
          financial_status?: string
          fulfillment_status?: string | null
          customer_email?: string
          customer_name?: string
          line_items?: Json
          created_at?: string
          processed_at?: string
          updated_at?: string
        }
      }
      meta_campaigns: {
        Row: {
          id: string
          campaign_id: string
          campaign_name: string
          status: string
          objective: string
          spend: number
          impressions: number
          clicks: number
          conversions: number
          cpm: number
          cpc: number
          ctr: number
          roas: number
          date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          campaign_name: string
          status: string
          objective: string
          spend: number
          impressions: number
          clicks: number
          conversions: number
          cpm: number
          cpc: number
          ctr: number
          roas: number
          date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          campaign_name?: string
          status?: string
          objective?: string
          spend?: number
          impressions?: number
          clicks?: number
          conversions?: number
          cpm?: number
          cpc?: number
          ctr?: number
          roas?: number
          date?: string
          created_at?: string
          updated_at?: string
        }
      }
      analytics_data: {
        Row: {
          id: string
          date: string
          sessions: number
          users: number
          new_users: number
          page_views: number
          bounce_rate: number
          avg_session_duration: number
          traffic_sources: Json
          top_pages: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          sessions: number
          users: number
          new_users: number
          page_views: number
          bounce_rate: number
          avg_session_duration: number
          traffic_sources?: Json
          top_pages?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          sessions?: number
          users?: number
          new_users?: number
          page_views?: number
          bounce_rate?: number
          avg_session_duration?: number
          traffic_sources?: Json
          top_pages?: Json
          created_at?: string
          updated_at?: string
        }
      }
      sync_logs: {
        Row: {
          id: string
          integration: string
          status: string
          records_synced: number
          started_at: string
          completed_at: string | null
          error_message: string | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          integration: string
          status: string
          records_synced?: number
          started_at?: string
          completed_at?: string | null
          error_message?: string | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          integration?: string
          status?: string
          records_synced?: number
          started_at?: string
          completed_at?: string | null
          error_message?: string | null
          metadata?: Json | null
        }
      }
      integration_settings: {
        Row: {
          id: string
          integration: string
          settings: Json
          connected: boolean
          last_sync: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          integration: string
          settings: Json
          connected?: boolean
          last_sync?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          integration?: string
          settings?: Json
          connected?: boolean
          last_sync?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

