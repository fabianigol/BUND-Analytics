-- Add geographic_data, city_data and hourly_data columns to analytics_data table
ALTER TABLE public.analytics_data 
ADD COLUMN IF NOT EXISTS geographic_data JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.analytics_data 
ADD COLUMN IF NOT EXISTS city_data JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.analytics_data 
ADD COLUMN IF NOT EXISTS hourly_data JSONB DEFAULT '[]'::jsonb;

