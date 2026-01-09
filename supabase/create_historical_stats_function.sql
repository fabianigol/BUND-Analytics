-- Crear función para obtener estadísticas agregadas sin límite de 1000 registros
-- Esta función hace las agregaciones directamente en PostgreSQL

CREATE OR REPLACE FUNCTION get_historical_stats_by_year_month(
  p_year INTEGER,
  p_month INTEGER,
  p_store_city TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH filtered_appointments AS (
    SELECT *
    FROM historical_appointments
    WHERE year = p_year
      AND month = p_month
      AND (p_store_city IS NULL OR store_city = p_store_city)
  ),
  aggregated_stats AS (
    SELECT
      -- Separar canceladas
      COUNT(*) FILTER (WHERE is_cancelled = true) as cancelled,
      -- Citas confirmadas (NO canceladas)
      COUNT(*) FILTER (WHERE appointment_type = 'medicion' AND is_cancelled = false) as medicion,
      COUNT(*) FILTER (WHERE appointment_type = 'fitting' AND is_cancelled = false) as fitting,
      -- Total = Citas confirmadas + Canceladas
      COUNT(*) as total,
      CASE 
        WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE is_cancelled = true)::DECIMAL / COUNT(*)) * 100
        ELSE 0
      END as cancellation_rate,
      COUNT(DISTINCT DATE(datetime)) as unique_days,
      CASE
        WHEN COUNT(DISTINCT DATE(datetime)) > 0 THEN COUNT(*)::DECIMAL / COUNT(DISTINCT DATE(datetime))
        ELSE 0
      END as avg_per_day
    FROM filtered_appointments
  ),
  store_stats AS (
    SELECT
      json_agg(
        json_build_object(
          'store_city', store_city,
          'total', total,
          'medicion', medicion,
          'fitting', fitting,
          'cancelled', cancelled,
          'cancellation_rate', cancellation_rate,
          'cancelled_medicion', cancelled_medicion,
          'cancelled_fitting', cancelled_fitting,
          'cancellation_rate_medicion', cancellation_rate_medicion,
          'cancellation_rate_fitting', cancellation_rate_fitting
        ) ORDER BY total DESC
      ) as by_store
    FROM (
      SELECT
        store_city,
        -- Separar canceladas
        COUNT(*) FILTER (WHERE is_cancelled = true) as cancelled,
        COUNT(*) FILTER (WHERE appointment_type = 'medicion' AND is_cancelled = true) as cancelled_medicion,
        COUNT(*) FILTER (WHERE appointment_type = 'fitting' AND is_cancelled = true) as cancelled_fitting,
        -- Citas confirmadas (NO canceladas)
        COUNT(*) FILTER (WHERE appointment_type = 'medicion' AND is_cancelled = false) as medicion,
        COUNT(*) FILTER (WHERE appointment_type = 'fitting' AND is_cancelled = false) as fitting,
        -- Total = Citas confirmadas + Canceladas
        COUNT(*) as total,
        CASE 
          WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE is_cancelled = true)::DECIMAL / COUNT(*)) * 100
          ELSE 0
        END as cancellation_rate,
        -- Tasas de cancelación por tipo (sobre el total de cada tipo)
        CASE 
          WHEN COUNT(*) FILTER (WHERE appointment_type = 'medicion') > 0 
          THEN (COUNT(*) FILTER (WHERE appointment_type = 'medicion' AND is_cancelled = true)::DECIMAL / COUNT(*) FILTER (WHERE appointment_type = 'medicion')) * 100
          ELSE 0
        END as cancellation_rate_medicion,
        CASE 
          WHEN COUNT(*) FILTER (WHERE appointment_type = 'fitting') > 0 
          THEN (COUNT(*) FILTER (WHERE appointment_type = 'fitting' AND is_cancelled = true)::DECIMAL / COUNT(*) FILTER (WHERE appointment_type = 'fitting')) * 100
          ELSE 0
        END as cancellation_rate_fitting
      FROM filtered_appointments
      GROUP BY store_city
    ) store_data
  )
  SELECT json_build_object(
    'period', p_year || '-' || LPAD(p_month::TEXT, 2, '0'),
    'total', agg.total,
    'medicion', agg.medicion,
    'fitting', agg.fitting,
    'cancelled', agg.cancelled,
    'cancellation_rate', agg.cancellation_rate,
    'avg_per_day', agg.avg_per_day,
    'by_store', COALESCE(store.by_store, '[]'::json)
  )
  INTO result
  FROM aggregated_stats agg
  CROSS JOIN store_stats store;
  
  RETURN result;
END;
$$;

-- Dar permisos a usuarios autenticados
GRANT EXECUTE ON FUNCTION get_historical_stats_by_year_month TO authenticated;

-- Comentario
COMMENT ON FUNCTION get_historical_stats_by_year_month IS 'Obtiene estadísticas agregadas de citas históricas para un año y mes específicos, superando el límite de 1000 registros de Supabase JS';

