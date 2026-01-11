-- =====================================================
-- CREAR OBJETIVO PARA MÉXICO - ENERO 2026
-- =====================================================
-- IMPORTANTE: Los objetivos se introducen en EUR
-- La aplicación los convertirá automáticamente a MXN para mostrarlos
-- Tipo de cambio usado: 1 EUR = ~21.28 MXN

INSERT INTO sales_targets (
  location,
  year,
  month,
  target_revenue,
  target_aov,
  conversion_rate,
  country,
  created_at,
  updated_at
)
VALUES (
  'México',                    -- Nombre de la ubicación
  2026,                        -- Año
  1,                           -- Mes (1 = Enero)
  50000.00,                    -- Objetivo de facturación en EUR (se mostrará como ~1,064,000 MXN)
  950.00,                      -- AOV objetivo en EUR (se mostrará como ~20,216 MXN)
  50.0,                        -- Tasa de conversión (50%)
  'MX',                        -- País
  NOW(),                       -- Fecha de creación
  NOW()                        -- Fecha de actualización
)
ON CONFLICT (location, year, month) 
DO UPDATE SET
  target_revenue = EXCLUDED.target_revenue,
  target_aov = EXCLUDED.target_aov,
  conversion_rate = EXCLUDED.conversion_rate,
  country = EXCLUDED.country,
  updated_at = NOW();

-- =====================================================
-- NOTAS IMPORTANTES:
-- =====================================================
-- 1. Los valores se introducen en EUR (moneda base)
-- 2. La aplicación convierte automáticamente a MXN para México
-- 3. Conversión: 1 EUR = ~21.28 MXN (1 MXN = 0.047 EUR)
-- 4. Ejemplo: 50,000 EUR → ~1,064,000 MXN
-- 5. Ajusta los valores según tus objetivos reales en EUR

-- Para crear objetivos para otros meses:
-- Duplica el INSERT y cambia el valor de 'month' (1-12)
