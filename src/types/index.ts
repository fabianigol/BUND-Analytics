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
  country: string;
  created_at: string;
  processed_at: string;
  tags?: string[];
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

export interface ShopifyCustomer {
  email: string;
  name: string;
  totalSpent: number; // LTV (Lifetime Value)
  orderCount: number;
  lastOrderDate: string;
  status: 'active' | 'inactive';
  isVip: boolean;
  isNew: boolean; // Primer pedido en período
  isRecurring: boolean; // Más de 1 pedido
  city?: string | null; // Ciudad/ubicación del cliente
}

export interface ShopifyCustomerMetrics {
  totalCustomers: number;
  totalCustomersChange?: number;
  totalCustomersChangeHistorical?: number;
  previousTotalCustomers?: number | null;
  historicalTotalCustomers?: number | null;
  newCustomers: number;
  newCustomersChange?: number;
  previousNewCustomers?: number | null;
  recurringCustomers: number;
  recurringCustomersChange?: number;
  previousRecurringCustomers?: number | null;
  retentionRate: number; // Porcentaje
  retentionRateChange?: number;
  previousRetentionRate?: number | null;
  averageCustomerValue: number;
  averageCustomerValueChange?: number;
  previousAverageCustomerValue?: number | null;
  vipCustomersCount: number;
}

export interface ShopifyLocationMetrics {
  location: string;
  revenue: number;
  revenueInEUR?: number; // Para ordenar correctamente (México en EUR)
  orders: number;
  averageOrderValue: number;
  averageOrderValueInEUR?: number; // Para tooltip (México en EUR)
  percentageOfTotal: number;
  roas?: number; // ROAS para esta ubicación
  topCustomers?: Array<{
    name: string;
    email: string;
    revenue: number;
  }>;
  topComplements?: Array<{
    name: string;
    revenue: number;
    sales: number;
  }>;
  monthlyRevenue?: Array<{
    date: string;
    value: number;
  }>;
  dailyRevenue?: Array<{
    date: string;
    value: number;
  }>;
  employees?: ShopifyEmployeeMetrics[];
}

export interface ShopifyEmployeeMetrics {
  employee: string;
  location: string;
  revenue: number;
  orders: number;
  percentageOfTotal: number;
}

export interface ShopifyAnalytics {
  conversionRate: number; // Porcentaje
  checkoutAbandonmentRate: number; // Porcentaje
  averageCheckoutTime: number; // Minutos
  conversionRateByPeriod?: Array<{
    date: string;
    conversionRate: number;
  }>;
}

export interface ShopifyAnalyticsFunnel {
  visitors: number;
  addedToCart: number;
  reachedCheckout: number;
  completedCheckout: number;
  stages: Array<{
    stage: string;
    count: number;
    percentage: number;
  }>;
}

export interface ShopifyHeatmapData {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
  value: number;
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

// Tipo para comparación de campañas (usado en pestaña Comparativas)
export interface CampaignComparison {
  campaign_id: string;
  campaign_name: string;
  current: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cost_per_result: number;
    results: number;
  };
  comparative: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cost_per_result: number;
    results: number;
  };
  change: {
    spend: { value: number; percent: number; isBetter: boolean };
    ctr: { value: number; percent: number; isBetter: boolean };
    cost_per_result: { value: number; percent: number; isBetter: boolean };
    results: { value: number; percent: number; isBetter: boolean };
  };
  hasData: boolean;
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

// Sales Targets Types
export interface SalesTarget {
  id: string;
  location: string;
  year: number;
  month: number;
  targetRevenue: number;
  targetAov: number;
  conversionRate: number;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocationTargetProgress {
  location: string;
  targetRevenue: number;
  currentRevenue: number;
  currentRevenueInEUR?: number; // Para México: facturación en EUR (para ordenar y totales)
  progressPercentage: number;
  targetAov: number;
  currentAov: number;
  conversionRate: number;

  // Cálculos de citas
  targetOrders: number; // targetRevenue / targetAov
  currentOrders: number;
  targetAppointments: number; // targetOrders / (conversionRate / 100)
  currentAppointments: number; // Del mes actual (solo medición)

  // Desglose semanal
  weeklyBreakdown: WeeklyProgress[];

  // Datos mensuales
  monthlyRevenue: Array<{ date: string; value: number }>;
  dailyRevenue: Array<{ date: string; value: number }>;
}

export interface WeeklyProgress {
  weekNumber: number; // 1-5
  weekLabel: string; // "Semana 1 (1-7 Ene)"
  startDate: string;
  endDate: string;
  
  // Revenue
  targetRevenue: number; // targetRevenue / numWeeks
  currentRevenue: number;
  revenueProgress: number; // %
  
  // Appointments
  targetAppointments: number; // targetAppointments / numWeeks
  currentAppointments: number; // Solo medición
  appointmentsProgress: number; // %
  
  // Orders
  targetOrders: number;
  currentOrders: number;
  ordersProgress: number; // %
}

export interface MonthlyTargetData {
  month: number; // 1-12
  monthLabel: string; // "Ene", "Feb", etc.
  targetRevenue: number;
  currentRevenue: number;
  achievementPercentage: number; // (currentRevenue / targetRevenue) * 100
}

export interface YearlyTargetTrend {
  year: number;
  totalTargetRevenue: number; // Suma de todos los objetivos del año
  totalCurrentRevenue: number; // Suma de toda la facturación del año
  totalAchievementPercentage: number; // % total de consecución
  monthlyData: MonthlyTargetData[]; // Datos mes a mes
}

export interface StoreYearlyTrend {
  location: string;
  year: number;
  monthlyData: MonthlyTargetData[]; // Datos mes a mes de esta tienda
}
