-- Migration: Add country column to support multi-country operations
-- Description: Adds 'country' field to shopify_orders, sales_targets, and meta_campaigns tables
-- Date: 2026-01-11

-- =============================================
-- SHOPIFY ORDERS - Add country column
-- =============================================

ALTER TABLE public.shopify_orders 
ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'ES';

CREATE INDEX IF NOT EXISTS idx_shopify_orders_country 
ON public.shopify_orders(country);

COMMENT ON COLUMN public.shopify_orders.country IS 'Country code: ES for España, MX for México';

-- =============================================
-- SALES TARGETS - Add country column
-- =============================================

ALTER TABLE public.sales_targets 
ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'ES';

CREATE INDEX IF NOT EXISTS idx_sales_targets_country 
ON public.sales_targets(country);

COMMENT ON COLUMN public.sales_targets.country IS 'Country code: ES for España, MX for México';

-- =============================================
-- META CAMPAIGNS - Add country column
-- =============================================

ALTER TABLE public.meta_campaigns 
ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'ES';

CREATE INDEX IF NOT EXISTS idx_meta_campaigns_country 
ON public.meta_campaigns(country);

COMMENT ON COLUMN public.meta_campaigns.country IS 'Country code: ES for España, MX for México. Auto-detected from campaign name.';

-- =============================================
-- UPDATE HISTORICAL DATA
-- =============================================

-- Mark all existing Shopify orders as Spain
UPDATE public.shopify_orders 
SET country = 'ES' 
WHERE country IS NULL;

-- Mark all existing sales targets as Spain
UPDATE public.sales_targets 
SET country = 'ES' 
WHERE country IS NULL;

-- Detect and update country for existing Meta campaigns
UPDATE public.meta_campaigns 
SET country = CASE
  WHEN campaign_name ILIKE '%CDMX%' 
    OR campaign_name ILIKE '%Mexico%' 
    OR campaign_name ILIKE '%México%'
    OR campaign_name ILIKE '%_MX%'
    OR campaign_name ILIKE '%MX_%'
    THEN 'MX'
  ELSE 'ES'
END
WHERE country IS NULL OR country = 'ES';

-- =============================================
-- VERIFICATION QUERIES (commented out)
-- =============================================

-- Verify shopify_orders country distribution
-- SELECT country, COUNT(*) as count FROM public.shopify_orders GROUP BY country;

-- Verify sales_targets country distribution
-- SELECT country, COUNT(*) as count FROM public.sales_targets GROUP BY country;

-- Verify meta_campaigns country distribution
-- SELECT country, COUNT(*) as count FROM public.meta_campaigns GROUP BY country;

-- Sample Meta campaigns by country
-- SELECT country, campaign_name FROM public.meta_campaigns LIMIT 20;
