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
      calendly_appointment_counts: {
        Row: {
          id: string
          year: number
          month: number
          total_count: number
          active_count: number
          canceled_count: number
          completed_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          year: number
          month: number
          total_count?: number
          active_count?: number
          canceled_count?: number
          completed_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          year?: number
          month?: number
          total_count?: number
          active_count?: number
          canceled_count?: number
          completed_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      calendly_historical_stats: {
        Row: {
          id: string
          user_name: string
          user_store: string | null
          event_type_category: 'Medición' | 'Fitting' | null
          room: 'I' | 'II' | null
          year: number
          month: number
          status: 'active' | 'canceled' | 'rescheduled'
          count: number
          has_utm: boolean
          utm_params: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          user_name: string
          user_store?: string | null
          event_type_category?: 'Medición' | 'Fitting' | null
          room?: 'I' | 'II' | null
          year: number
          month: number
          status: 'active' | 'canceled' | 'rescheduled'
          count?: number
          has_utm?: boolean
          utm_params?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_name?: string
          user_store?: string | null
          event_type_category?: 'Medición' | 'Fitting' | null
          room?: 'I' | 'II' | null
          year?: number
          month?: number
          status?: 'active' | 'canceled' | 'rescheduled'
          count?: number
          has_utm?: boolean
          utm_params?: Json
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
          device_breakdown?: Json | null
          geographic_data?: Json | null
          city_data?: Json | null
          hourly_data?: Json | null
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
          device_breakdown?: Json | null
          geographic_data?: Json | null
          city_data?: Json | null
          hourly_data?: Json | null
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
          device_breakdown?: Json | null
          geographic_data?: Json | null
          city_data?: Json | null
          hourly_data?: Json | null
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
      passwords: {
        Row: {
          id: string
          user_id: string
          platform: string
          username: string
          password: string
          notes: string | null
          is_shared: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          platform: string
          username: string
          password: string
          notes?: string | null
          is_shared?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          platform?: string
          username?: string
          password?: string
          notes?: string | null
          is_shared?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      prompts: {
        Row: {
          id: string
          user_id: string
          title: string
          prompt_text: string
          emoji: string | null
          color: string | null
          category: string | null
          is_shared: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          prompt_text: string
          emoji?: string | null
          color?: string | null
          category?: string | null
          is_shared?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          prompt_text?: string
          emoji?: string | null
          color?: string | null
          category?: string | null
          is_shared?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      acuity_appointments: {
        Row: {
          id: string
          acuity_id: number
          calendar_id: number | null
          calendar_name: string | null
          appointment_type_id: number
          appointment_type_name: string
          appointment_category: 'medición' | 'fitting'
          datetime: string
          end_time: string
          customer_name: string | null
          customer_email: string | null
          phone: string | null
          notes: string | null
          status: 'scheduled' | 'canceled' | 'rescheduled'
          canceled_at: string | null
          rescheduled_from_id: number | null
          scheduling_link: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          acuity_id: number
          calendar_id?: number | null
          calendar_name?: string | null
          appointment_type_id: number
          appointment_type_name: string
          appointment_category: 'medición' | 'fitting'
          datetime: string
          end_time: string
          customer_name?: string | null
          customer_email?: string | null
          phone?: string | null
          notes?: string | null
          status: 'scheduled' | 'canceled' | 'rescheduled'
          canceled_at?: string | null
          rescheduled_from_id?: number | null
          scheduling_link?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          acuity_id?: number
          calendar_id?: number | null
          calendar_name?: string | null
          appointment_type_id?: number
          appointment_type_name?: string
          appointment_category?: 'medición' | 'fitting'
          datetime?: string
          end_time?: string
          customer_name?: string | null
          customer_email?: string | null
          phone?: string | null
          notes?: string | null
          status?: 'scheduled' | 'canceled' | 'rescheduled'
          canceled_at?: string | null
          rescheduled_from_id?: number | null
          scheduling_link?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      acuity_availability: {
        Row: {
          id: string
          date: string
          calendar_id: number | null
          calendar_name: string
          appointment_category: 'medición' | 'fitting'
          total_slots: number
          available_slots: number
          booked_slots: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          date: string
          calendar_id?: number | null
          calendar_name: string
          appointment_category: 'medición' | 'fitting'
          total_slots?: number
          available_slots?: number
          booked_slots?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          calendar_id?: number | null
          calendar_name?: string
          appointment_category?: 'medición' | 'fitting'
          total_slots?: number
          available_slots?: number
          booked_slots?: number
          created_at?: string
          updated_at?: string
        }
      }
      acuity_appointment_counts: {
        Row: {
          id: string
          year: number
          month: number
          calendar_name: string
          appointment_category: 'medición' | 'fitting'
          total_count: number
          scheduled_count: number
          canceled_count: number
          rescheduled_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          year: number
          month: number
          calendar_name: string
          appointment_category: 'medición' | 'fitting'
          total_count?: number
          scheduled_count?: number
          canceled_count?: number
          rescheduled_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          year?: number
          month?: number
          calendar_name?: string
          appointment_category?: 'medición' | 'fitting'
          total_count?: number
          scheduled_count?: number
          canceled_count?: number
          rescheduled_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      acuity_calendars: {
        Row: {
          id: string
          acuity_calendar_id: number | null
          name: string
          display_name: string
          appointment_category: 'medición' | 'fitting'
          appointment_type_id: number
          appointment_type_name: string
          scheduling_link: string | null
          is_active: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          acuity_calendar_id?: number | null
          name: string
          display_name: string
          appointment_category: 'medición' | 'fitting'
          appointment_type_id: number
          appointment_type_name: string
          scheduling_link?: string | null
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          acuity_calendar_id?: number | null
          name?: string
          display_name?: string
          appointment_category?: 'medición' | 'fitting'
          appointment_type_id?: number
          appointment_type_name?: string
          scheduling_link?: string | null
          is_active?: boolean
          metadata?: Json
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

