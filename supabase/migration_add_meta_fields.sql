-- Migration: Add new fields to meta_campaigns table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.meta_campaigns 
ADD COLUMN IF NOT EXISTS reach INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS link_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cost_per_result DECIMAL(10, 4) DEFAULT 0;

-- Update existing rows to have default values
UPDATE public.meta_campaigns 
SET 
  reach = COALESCE(reach, 0),
  link_clicks = COALESCE(link_clicks, 0),
  actions = COALESCE(actions, '[]'::jsonb),
  cost_per_result = COALESCE(cost_per_result, 0)
WHERE reach IS NULL OR link_clicks IS NULL OR actions IS NULL OR cost_per_result IS NULL;

