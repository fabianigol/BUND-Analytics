-- Migration: Add tags column to shopify_orders table
-- This migration adds support for storing order tags to extract location and employee information

-- Añadir columna tags para almacenar etiquetas del pedido
ALTER TABLE public.shopify_orders 
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Índice para búsquedas por tags (usando GIN para arrays)
CREATE INDEX IF NOT EXISTS idx_shopify_orders_tags ON public.shopify_orders USING GIN(tags);

-- Comentario descriptivo
COMMENT ON COLUMN public.shopify_orders.tags IS 'Array de etiquetas del pedido de Shopify. Usado para extraer información de tienda y vendedor.';

