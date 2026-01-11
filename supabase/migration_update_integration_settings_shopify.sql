-- Migration: Update integration_settings to support shopify_es and shopify_mx
-- Date: 2026-01-11
-- Description: Permite usar shopify_es y shopify_mx como integraciones separadas

-- 1. Eliminar el constraint actual
ALTER TABLE public.integration_settings 
DROP CONSTRAINT IF EXISTS integration_settings_integration_check;

-- 2. Agregar nuevo constraint con shopify_es y shopify_mx
ALTER TABLE public.integration_settings
ADD CONSTRAINT integration_settings_integration_check 
CHECK (integration IN ('calendly', 'shopify', 'shopify_es', 'shopify_mx', 'meta', 'analytics', 'airtable', 'acuity'));

-- 3. Migrar el registro existente de 'shopify' a 'shopify_es' si existe
UPDATE public.integration_settings
SET integration = 'shopify_es'
WHERE integration = 'shopify';

-- 4. Insertar registros por defecto para shopify_es y shopify_mx si no existen
INSERT INTO public.integration_settings (integration, settings, connected) VALUES
  ('shopify_es', '{}'::jsonb, false),
  ('shopify_mx', '{}'::jsonb, false)
ON CONFLICT (integration) DO NOTHING;

-- 5. Comentario para documentación
COMMENT ON CONSTRAINT integration_settings_integration_check ON public.integration_settings IS 
'Permite integraciones: calendly, shopify (legacy), shopify_es, shopify_mx, meta, analytics, airtable, acuity';
