-- BUND Marketing Dashboard - Database Schema
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS AND ROLES
-- =============================================

-- Users profile table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
INSERT INTO public.roles (name, permissions) VALUES
  ('admin', '{"can_view_dashboard": true, "can_view_reports": true, "can_export_data": true, "can_manage_users": true, "can_manage_integrations": true}'::jsonb),
  ('marketing_manager', '{"can_view_dashboard": true, "can_view_reports": true, "can_export_data": true, "can_manage_users": false, "can_manage_integrations": false}'::jsonb),
  ('viewer', '{"can_view_dashboard": true, "can_view_reports": true, "can_export_data": false, "can_manage_users": false, "can_manage_integrations": false}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- User roles junction table
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

-- =============================================
-- CALENDLY EVENTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.calendly_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_type_name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  invitee_email TEXT NOT NULL,
  invitee_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'completed')),
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendly_events_start_time ON public.calendly_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendly_events_status ON public.calendly_events(status);

-- =============================================
-- SHOPIFY ORDERS
-- =============================================

CREATE TABLE IF NOT EXISTS public.shopify_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  subtotal_price DECIMAL(10, 2) NOT NULL,
  total_tax DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  financial_status TEXT NOT NULL,
  fulfillment_status TEXT,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_created_at ON public.shopify_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_shopify_orders_financial_status ON public.shopify_orders(financial_status);

-- =============================================
-- META CAMPAIGNS
-- =============================================

CREATE TABLE IF NOT EXISTS public.meta_campaigns (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED')),
  objective TEXT NOT NULL,
  spend DECIMAL(10, 2) NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  cpm DECIMAL(10, 4) NOT NULL DEFAULT 0,
  cpc DECIMAL(10, 4) NOT NULL DEFAULT 0,
  ctr DECIMAL(10, 4) NOT NULL DEFAULT 0,
  roas DECIMAL(10, 4) NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_campaigns_date ON public.meta_campaigns(date);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_campaign_id ON public.meta_campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_status ON public.meta_campaigns(status);

-- =============================================
-- ANALYTICS DATA
-- =============================================

CREATE TABLE IF NOT EXISTS public.analytics_data (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  sessions INTEGER NOT NULL DEFAULT 0,
  users INTEGER NOT NULL DEFAULT 0,
  new_users INTEGER NOT NULL DEFAULT 0,
  page_views INTEGER NOT NULL DEFAULT 0,
  bounce_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  avg_session_duration DECIMAL(10, 2) NOT NULL DEFAULT 0,
  traffic_sources JSONB DEFAULT '[]'::jsonb,
  top_pages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_data_date ON public.analytics_data(date);

-- =============================================
-- SYNC LOGS
-- =============================================

CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration TEXT NOT NULL CHECK (integration IN ('calendly', 'shopify', 'meta', 'analytics', 'airtable')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running')),
  records_synced INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_integration ON public.sync_logs(integration);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON public.sync_logs(started_at);

-- =============================================
-- INTEGRATION SETTINGS
-- =============================================

CREATE TABLE IF NOT EXISTS public.integration_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration TEXT NOT NULL UNIQUE CHECK (integration IN ('calendly', 'shopify', 'meta', 'analytics', 'airtable')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected BOOLEAN NOT NULL DEFAULT FALSE,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default integration settings
INSERT INTO public.integration_settings (integration, settings, connected) VALUES
  ('calendly', '{}'::jsonb, false),
  ('shopify', '{}'::jsonb, false),
  ('meta', '{}'::jsonb, false),
  ('analytics', '{}'::jsonb, false),
  ('airtable', '{}'::jsonb, false)
ON CONFLICT (integration) DO NOTHING;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendly_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Roles policies (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view roles" ON public.roles
  FOR SELECT TO authenticated USING (true);

-- User roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Data tables policies (all authenticated users can read)
CREATE POLICY "Authenticated users can view calendly events" ON public.calendly_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage calendly events" ON public.calendly_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view shopify orders" ON public.shopify_orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage shopify orders" ON public.shopify_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view meta campaigns" ON public.meta_campaigns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage meta campaigns" ON public.meta_campaigns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view analytics data" ON public.analytics_data
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage analytics data" ON public.analytics_data
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view sync logs" ON public.sync_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage sync logs" ON public.sync_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view integration settings" ON public.integration_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage integration settings" ON public.integration_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendly_events_updated_at
  BEFORE UPDATE ON public.calendly_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopify_orders_updated_at
  BEFORE UPDATE ON public.shopify_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meta_campaigns_updated_at
  BEFORE UPDATE ON public.meta_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analytics_data_updated_at
  BEFORE UPDATE ON public.analytics_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integration_settings_updated_at
  BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Assign default viewer role
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT NEW.id, id FROM public.roles WHERE name = 'viewer';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- VIEWS
-- =============================================

-- View for users with their roles
CREATE OR REPLACE VIEW public.users_with_roles AS
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.avatar_url,
  u.created_at,
  r.name as role_name,
  r.permissions
FROM public.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id;

-- View for dashboard overview metrics
CREATE OR REPLACE VIEW public.dashboard_metrics AS
SELECT
  (SELECT COALESCE(SUM(total_price), 0) FROM public.shopify_orders WHERE created_at >= NOW() - INTERVAL '30 days') as total_revenue_30d,
  (SELECT COUNT(*) FROM public.shopify_orders WHERE created_at >= NOW() - INTERVAL '30 days') as total_orders_30d,
  (SELECT COUNT(*) FROM public.calendly_events WHERE start_time >= NOW() - INTERVAL '30 days') as total_appointments_30d,
  (SELECT COALESCE(SUM(spend), 0) FROM public.meta_campaigns WHERE date >= CURRENT_DATE - INTERVAL '30 days') as total_ad_spend_30d,
  (SELECT COALESCE(SUM(sessions), 0) FROM public.analytics_data WHERE date >= CURRENT_DATE - INTERVAL '30 days') as total_sessions_30d;

