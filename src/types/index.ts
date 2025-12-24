// User & Auth Types
export type UserRole = 'admin' | 'marketing_manager' | 'viewer';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface UserWithRole extends User {
  role: UserRole;
}

export interface Role {
  id: number;
  name: UserRole;
  permissions: RolePermissions;
}

export interface RolePermissions {
  can_view_dashboard: boolean;
  can_view_reports: boolean;
  can_export_data: boolean;
  can_manage_users: boolean;
  can_manage_integrations: boolean;
}

// Shopify Types
export interface ShopifyOrder {
  id: string;
  order_number: string;
  total_price: number;
  subtotal_price: number;
  total_tax: number;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer_email: string;
  customer_name: string;
  line_items: ShopifyLineItem[];
  created_at: string;
  processed_at: string;
}

export interface ShopifyLineItem {
  id: string;
  title: string;
  quantity: number;
  price: number;
  sku: string;
  product_id: string;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  product_type: string;
  variants_count: number;
  total_inventory: number;
  created_at: string;
}

// Meta Ads Types
export interface MetaCampaign {
  id: string;
  campaign_id: string;
  campaign_name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpm: number;
  cpc: number;
  ctr: number;
  roas: number;
  date: string;
  created_at: string;
  // Nuevos campos de Meta
  reach?: number;
  link_clicks?: number;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_result?: number;
  budget?: string;
  attribution_setting?: string;
  ends?: string;
}

export interface MetaAdSet {
  id: string;
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  status: string;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  date: string;
}

export interface MetaAd {
  id: string;
  ad_id: string;
  ad_name: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpm: number;
  cpc: number;
  ctr: number;
  roas: number;
  date: string;
  created_at: string;
  reach?: number;
  link_clicks?: number;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_result?: number;
  thumbnail_url?: string;
}

// Google Analytics Types
export interface AnalyticsData {
  id: string;
  date: string;
  sessions: number;
  users: number;
  new_users: number;
  page_views: number;
  bounce_rate: number;
  avg_session_duration: number;
  traffic_sources: TrafficSource[];
  top_pages: TopPage[];
  created_at: string;
}

export interface TrafficSource {
  source: string;
  medium: string;
  sessions: number;
  users: number;
  percentage: number;
}

export interface TopPage {
  page_path: string;
  page_title: string;
  page_views: number;
  avg_time_on_page: number;
}

// Airtable Types
export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  created_at: string;
}

// Sync Types
export interface SyncLog {
  id: string;
  integration: 'shopify' | 'meta' | 'analytics' | 'airtable';
  status: 'success' | 'error' | 'running';
  records_synced: number;
  started_at: string;
  completed_at?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

// Dashboard Metrics
export interface DashboardMetrics {
  // Shopify
  totalRevenue: number;
  revenueChange: number;
  totalOrders: number;
  ordersChange: number;
  averageOrderValue: number;
  aovChange: number;

  // Meta Ads
  totalAdSpend: number;
  adSpendChange: number;
  totalImpressions: number;
  impressionsChange: number;
  totalClicks: number;
  clicksChange: number;
  overallRoas: number;
  roasChange: number;

  // Analytics
  totalSessions: number;
  sessionsChange: number;
  totalUsers: number;
  usersChange: number;
  bounceRate: number;
  bounceRateChange: number;
}

// Chart Data Types
export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
  [key: string]: string | number | undefined;
}

export interface MultiSeriesChartData {
  date: string;
  [key: string]: string | number;
}

// Report Types
export interface Report {
  id: string;
  name: string;
  description?: string;
  type: 'scheduled' | 'manual';
  frequency?: 'daily' | 'weekly' | 'monthly';
  metrics: string[];
  filters?: ReportFilter[];
  created_by: string;
  created_at: string;
  last_run_at?: string;
}

export interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
  value: string | number | [number, number];
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

// Settings Types
export interface IntegrationSettings {
  shopify: {
    shop_domain?: string;
    access_token?: string;
    connected: boolean;
    last_sync?: string;
  };
  meta: {
    access_token?: string;
    ad_account_id?: string;
    connected: boolean;
    last_sync?: string;
  };
  analytics: {
    property_id?: string;
    credentials?: string;
    connected: boolean;
    last_sync?: string;
  };
  airtable: {
    api_key?: string;
    base_id?: string;
    connected: boolean;
    last_sync?: string;
  };
}

