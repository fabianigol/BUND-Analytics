-- Verificar pedidos sincronizados de México
-- Ejecuta estos queries en Supabase SQL Editor para verificar

-- 1. Contar pedidos por país
SELECT 
  country,
  COUNT(*) as total_pedidos,
  SUM(CAST(total_price AS NUMERIC)) as revenue_total
FROM shopify_orders
GROUP BY country
ORDER BY country;

-- 2. Ver primeros 5 pedidos de México
SELECT 
  id,
  order_number,
  country,
  total_price,
  currency,
  created_at,
  financial_status
FROM shopify_orders
WHERE country = 'MX'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Ver primeros 5 pedidos de España
SELECT 
  id,
  order_number,
  country,
  total_price,
  currency,
  created_at,
  financial_status
FROM shopify_orders
WHERE country = 'ES'
ORDER BY created_at DESC
LIMIT 5;

-- 4. Si NO hay pedidos con country='MX', buscar sin filtro
-- (esto significa que no se guardó el country correctamente)
SELECT 
  id,
  order_number,
  country,
  total_price,
  currency,
  shop_domain,
  created_at
FROM shopify_orders
ORDER BY created_at DESC
LIMIT 10;
