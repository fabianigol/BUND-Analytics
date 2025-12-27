-- Migration: Add job-specific roles (CEO, CBDO, CFO, etc.)
-- Run this in your Supabase SQL Editor

-- Insert new job roles
INSERT INTO public.roles (name, permissions) VALUES
  ('CEO', '{"can_view_dashboard": true, "can_view_reports": true, "can_export_data": true, "can_manage_users": true, "can_manage_integrations": true}'::jsonb),
  ('CBDO', '{"can_view_dashboard": true, "can_view_reports": true, "can_export_data": true, "can_manage_users": false, "can_manage_integrations": true}'::jsonb),
  ('CFO', '{"can_view_dashboard": true, "can_view_reports": true, "can_export_data": true, "can_manage_users": false, "can_manage_integrations": false}'::jsonb),
  ('art_director', '{"can_view_dashboard": true, "can_view_reports": true, "can_export_data": true, "can_manage_users": false, "can_manage_integrations": false}'::jsonb),
  ('content', '{"can_view_dashboard": true, "can_view_reports": true, "can_export_data": false, "can_manage_users": false, "can_manage_integrations": false}'::jsonb),
  ('support', '{"can_view_dashboard": true, "can_view_reports": true, "can_export_data": false, "can_manage_users": false, "can_manage_integrations": false}'::jsonb),
  ('agency', '{"can_view_dashboard": true, "can_view_reports": true, "can_export_data": true, "can_manage_users": false, "can_manage_integrations": false}'::jsonb)
ON CONFLICT (name) DO NOTHING;

