-- Crear tabla para citas históricas importadas desde Excel
-- Basado en análisis real: 58,011 registros desde 2020-2025

CREATE TABLE IF NOT EXISTS historical_appointments (
  id BIGSERIAL PRIMARY KEY,
  
  -- Datos básicos
  datetime TIMESTAMPTZ NOT NULL, -- Fecha y hora combinadas (columna D del Excel)
  client_name TEXT, -- Columna B del Excel
  client_email TEXT, -- Columna C del Excel
  
  -- Datos parseados
  store_city TEXT NOT NULL, -- Extraído de Event Type Name
  appointment_type TEXT NOT NULL, -- 'medicion' | 'fitting'
  event_category TEXT NOT NULL DEFAULT 'regular', -- 'regular' | 'tour' | 'videoconsulta' | 'ponte_traje'
  
  -- Datos originales para referencia
  event_type_name_original TEXT NOT NULL, -- Columna A del Excel sin modificar
  
  -- Estado
  is_cancelled BOOLEAN DEFAULT false, -- Columna E del Excel (Canceled)
  
  -- Campos pre-calculados para optimizar consultas (calculados en el script de importación)
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0=Domingo, 6=Sábado
  hour INTEGER NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar consultas comunes
CREATE INDEX IF NOT EXISTS idx_historical_appointments_datetime 
  ON historical_appointments(datetime);

CREATE INDEX IF NOT EXISTS idx_historical_appointments_store_city 
  ON historical_appointments(store_city);

CREATE INDEX IF NOT EXISTS idx_historical_appointments_year_month 
  ON historical_appointments(year, month);

CREATE INDEX IF NOT EXISTS idx_historical_appointments_appointment_type 
  ON historical_appointments(appointment_type);

CREATE INDEX IF NOT EXISTS idx_historical_appointments_event_category 
  ON historical_appointments(event_category);

CREATE INDEX IF NOT EXISTS idx_historical_appointments_is_cancelled 
  ON historical_appointments(is_cancelled);

-- Índice compuesto para consultas de comparativas por ciudad y período
CREATE INDEX IF NOT EXISTS idx_historical_appointments_city_year_month 
  ON historical_appointments(store_city, year, month);

-- Índice para consultas de patrones horarios
CREATE INDEX IF NOT EXISTS idx_historical_appointments_day_hour 
  ON historical_appointments(day_of_week, hour);

-- Comentarios para documentación
COMMENT ON TABLE historical_appointments IS 
  'Citas históricas importadas desde Calendly (Excel). 58,011 registros 2020-2025. Importado el 2025-01-09.';

COMMENT ON COLUMN historical_appointments.datetime IS 
  'Fecha y hora de la cita. Formato original: YYYY-MM-DD HH:MM';

COMMENT ON COLUMN historical_appointments.store_city IS 
  'Ciudad/tienda extraída del Event Type Name. Normalizada: Madrid, Barcelona, Sevilla, Málaga, Bilbao, Valencia, Murcia, Zaragoza, CDMX';

COMMENT ON COLUMN historical_appointments.appointment_type IS 
  'Tipo de cita: medicion (60.9%) o fitting (39.1%). Detectado automáticamente desde Event Type Name';

COMMENT ON COLUMN historical_appointments.event_category IS 
  'Categoría del evento: regular (97.2%), tour (2.8%), videoconsulta (0.01%), ponte_traje';

COMMENT ON COLUMN historical_appointments.event_type_name_original IS 
  'Nombre original del evento sin modificar. 73 variaciones únicas. Ejemplos: "Madrid [Medición I]", "The Bundtour Sevilla", "Ponte traje, Madrid."';

COMMENT ON COLUMN historical_appointments.year IS 
  'Año extraído de datetime. Calculado durante la importación para optimizar consultas.';

COMMENT ON COLUMN historical_appointments.month IS 
  'Mes (1-12) extraído de datetime. Calculado durante la importación para optimizar consultas.';

COMMENT ON COLUMN historical_appointments.day_of_week IS 
  'Día de la semana (0=Domingo, 6=Sábado) extraído de datetime. Calculado durante la importación para optimizar consultas.';

COMMENT ON COLUMN historical_appointments.hour IS 
  'Hora (0-23) extraída de datetime. Calculada durante la importación para optimizar consultas.';

-- Políticas RLS (Row Level Security)
ALTER TABLE historical_appointments ENABLE ROW LEVEL SECURITY;

-- Política: Solo usuarios autenticados pueden leer
CREATE POLICY "Allow authenticated users to read historical appointments" 
  ON historical_appointments
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Solo admins pueden insertar/actualizar/eliminar
CREATE POLICY "Allow admins to manage historical appointments" 
  ON historical_appointments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.name IN ('admin', 'superadmin')
    )
  );

-- Verificar que la tabla se creó correctamente
DO $$
BEGIN
  RAISE NOTICE 'Tabla historical_appointments creada exitosamente';
  RAISE NOTICE 'Índices creados: 8 índices para optimizar consultas';
  RAISE NOTICE 'RLS habilitado: Solo usuarios autenticados pueden leer';
END $$;

