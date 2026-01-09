-- Funciones RPC adicionales para comparativas históricas mejoradas

-- 1. Función para obtener totales anuales de múltiples años
CREATE OR REPLACE FUNCTION get_historical_stats_annual(
  p_years INTEGER[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_object_agg(
    year::TEXT,
    json_build_object(
      'year', year,
      'total', total,
      'medicion', medicion,
      'fitting', fitting,
      'cancelled', cancelled,
      'cancellation_rate', cancellation_rate,
      'avg_per_day', avg_per_day
    )
  )
  INTO result
  FROM (
    SELECT
      year,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE appointment_type = 'medicion' AND is_cancelled = false) as medicion,
      COUNT(*) FILTER (WHERE appointment_type = 'fitting' AND is_cancelled = false) as fitting,
      COUNT(*) FILTER (WHERE is_cancelled = true) as cancelled,
      CASE 
        WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE is_cancelled = true)::DECIMAL / COUNT(*)) * 100
        ELSE 0
      END as cancellation_rate,
      CASE
        WHEN COUNT(DISTINCT DATE(datetime)) > 0 THEN COUNT(*)::DECIMAL / COUNT(DISTINCT DATE(datetime))
        ELSE 0
      END as avg_per_day
    FROM historical_appointments
    WHERE year = ANY(p_years)
    GROUP BY year
    ORDER BY year DESC
  ) yearly_data;
  
  RETURN COALESCE(result, '{}'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_historical_stats_annual TO authenticated;
COMMENT ON FUNCTION get_historical_stats_annual IS 'Obtiene estadísticas anuales agregadas para múltiples años';


-- 2. Función para obtener desglose mensual de uno o más años
CREATE OR REPLACE FUNCTION get_historical_stats_monthly_breakdown(
  p_years INTEGER[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_object_agg(
    year::TEXT,
    monthly_data
  )
  INTO result
  FROM (
    SELECT
      year,
      json_agg(
        json_build_object(
          'month', month,
          'total', total,
          'medicion', medicion,
          'fitting', fitting,
          'cancelled', cancelled,
          'cancellation_rate', cancellation_rate,
          'avg_per_day', avg_per_day
        ) ORDER BY month
      ) as monthly_data
    FROM (
      SELECT
        year,
        month,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE appointment_type = 'medicion' AND is_cancelled = false) as medicion,
        COUNT(*) FILTER (WHERE appointment_type = 'fitting' AND is_cancelled = false) as fitting,
        COUNT(*) FILTER (WHERE is_cancelled = true) as cancelled,
        CASE 
          WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE is_cancelled = true)::DECIMAL / COUNT(*)) * 100
          ELSE 0
        END as cancellation_rate,
        CASE
          WHEN COUNT(DISTINCT DATE(datetime)) > 0 THEN COUNT(*)::DECIMAL / COUNT(DISTINCT DATE(datetime))
          ELSE 0
        END as avg_per_day
      FROM historical_appointments
      WHERE year = ANY(p_years)
      GROUP BY year, month
      ORDER BY year, month
    ) monthly_stats
    GROUP BY year
  ) yearly_breakdown;
  
  RETURN COALESCE(result, '{}'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_historical_stats_monthly_breakdown TO authenticated;
COMMENT ON FUNCTION get_historical_stats_monthly_breakdown IS 'Obtiene desglose mensual de estadísticas para uno o más años';


-- 3. Función para obtener datos por tienda (mensual o anual)
CREATE OR REPLACE FUNCTION get_historical_stats_by_store(
  p_years INTEGER[],
  p_months INTEGER[] DEFAULT NULL,
  p_grouping TEXT DEFAULT 'monthly' -- 'monthly' o 'annual'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  IF p_grouping = 'monthly' THEN
    -- Agrupar por tienda, año y mes
    SELECT json_object_agg(
      store_city,
      store_data
    )
    INTO result
    FROM (
      SELECT
        store_city,
        json_agg(
          json_build_object(
            'year', year,
            'month', month,
            'period', year || '-' || LPAD(month::TEXT, 2, '0'),
            'total', total,
            'medicion', medicion,
            'fitting', fitting,
            'cancelled', cancelled
          ) ORDER BY year, month
        ) as store_data
      FROM (
        SELECT
          store_city,
          year,
          month,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE appointment_type = 'medicion' AND is_cancelled = false) as medicion,
          COUNT(*) FILTER (WHERE appointment_type = 'fitting' AND is_cancelled = false) as fitting,
          COUNT(*) FILTER (WHERE is_cancelled = true) as cancelled
        FROM historical_appointments
        WHERE year = ANY(p_years)
          AND (p_months IS NULL OR month = ANY(p_months))
        GROUP BY store_city, year, month
      ) monthly_store_data
      GROUP BY store_city
    ) store_monthly;
  ELSE
    -- Agrupar por tienda y año solamente (totales anuales)
    SELECT json_object_agg(
      store_city,
      store_data
    )
    INTO result
    FROM (
      SELECT
        store_city,
        json_agg(
          json_build_object(
            'year', year,
            'total', total,
            'medicion', medicion,
            'fitting', fitting,
            'cancelled', cancelled
          ) ORDER BY year
        ) as store_data
      FROM (
        SELECT
          store_city,
          year,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE appointment_type = 'medicion' AND is_cancelled = false) as medicion,
          COUNT(*) FILTER (WHERE appointment_type = 'fitting' AND is_cancelled = false) as fitting,
          COUNT(*) FILTER (WHERE is_cancelled = true) as cancelled
        FROM historical_appointments
        WHERE year = ANY(p_years)
          AND (p_months IS NULL OR month = ANY(p_months))
        GROUP BY store_city, year
      ) annual_store_data
      GROUP BY store_city
    ) store_annual;
  END IF;
  
  RETURN COALESCE(result, '{}'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION get_historical_stats_by_store TO authenticated;
COMMENT ON FUNCTION get_historical_stats_by_store IS 'Obtiene datos agrupados por tienda, con opción de agrupación mensual o anual';
