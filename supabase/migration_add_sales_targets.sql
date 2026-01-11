-- Migration: Add sales_targets table for revenue target tracking
-- Description: Stores monthly revenue targets by location with AOV and conversion rate

-- =============================================
-- SALES TARGETS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.sales_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location TEXT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  target_revenue DECIMAL(10,2) NOT NULL CHECK (target_revenue > 0),
  target_aov DECIMAL(10,2) NOT NULL CHECK (target_aov > 0),
  conversion_rate DECIMAL(5,2) NOT NULL DEFAULT 50.00 CHECK (conversion_rate >= 0.01 AND conversion_rate <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(location, year, month)
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_sales_targets_location ON public.sales_targets(location);
CREATE INDEX IF NOT EXISTS idx_sales_targets_year_month ON public.sales_targets(year, month);
CREATE INDEX IF NOT EXISTS idx_sales_targets_year ON public.sales_targets(year);
CREATE INDEX IF NOT EXISTS idx_sales_targets_location_year ON public.sales_targets(location, year);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view all sales targets
CREATE POLICY "Authenticated users can view sales targets" ON public.sales_targets
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Policy: Only admin and marketing_manager can insert/update/delete sales targets
CREATE POLICY "Admin and marketing managers can manage sales targets" ON public.sales_targets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'marketing_manager')
    )
  );

-- =============================================
-- TRIGGER FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_sales_targets_updated_at
  BEFORE UPDATE ON public.sales_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE public.sales_targets IS 'Monthly revenue targets by location with AOV and conversion rate for tracking goal achievement';
COMMENT ON COLUMN public.sales_targets.location IS 'Store location (Madrid, Sevilla, Málaga, Barcelona, etc.)';
COMMENT ON COLUMN public.sales_targets.year IS 'Target year';
COMMENT ON COLUMN public.sales_targets.month IS 'Target month (1-12)';
COMMENT ON COLUMN public.sales_targets.target_revenue IS 'Monthly revenue target in euros';
COMMENT ON COLUMN public.sales_targets.target_aov IS 'Expected Average Order Value in euros';
COMMENT ON COLUMN public.sales_targets.conversion_rate IS 'Expected conversion rate from appointments to purchases (percentage)';
