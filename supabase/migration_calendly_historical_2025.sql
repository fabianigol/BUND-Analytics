-- Verificación y ajustes para tabla calendly_historical_stats
-- Esta tabla ya debería existir, pero verificamos y ajustamos si es necesario

-- Verificar que la tabla existe (si no, crearla)
CREATE TABLE IF NOT EXISTS public.calendly_historical_stats (
  id TEXT PRIMARY KEY, -- Clave compuesta: user_name|year|month|event_type_category|status|has_utm
  user_name TEXT NOT NULL, -- Nombre completo del usuario (ej: "The Bundclub Madrid [Medición I]")
  user_store TEXT, -- Tienda extraída (ej: "Madrid", "Barcelona", etc.)
  event_type_category TEXT CHECK (event_type_category IN ('Medición', 'Fitting')), -- Tipo de cita
  room TEXT CHECK (room IN ('I', 'II')), -- Sala (I, II o null)
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'rescheduled')),
  count INTEGER NOT NULL DEFAULT 0, -- Número de citas en esta categoría
  has_utm BOOLEAN NOT NULL DEFAULT FALSE, -- Indica si tiene parámetros UTM
  utm_params JSONB DEFAULT '{}'::jsonb, -- Parámetros UTM completos (utm_source, utm_medium, utm_campaign, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas eficientes (crear solo si no existen)
CREATE INDEX IF NOT EXISTS idx_calendly_historical_stats_user_name ON public.calendly_historical_stats(user_name);
CREATE INDEX IF NOT EXISTS idx_calendly_historical_stats_user_store ON public.calendly_historical_stats(user_store);
CREATE INDEX IF NOT EXISTS idx_calendly_historical_stats_year_month ON public.calendly_historical_stats(year, month);
CREATE INDEX IF NOT EXISTS idx_calendly_historical_stats_event_type ON public.calendly_historical_stats(event_type_category);
CREATE INDEX IF NOT EXISTS idx_calendly_historical_stats_status ON public.calendly_historical_stats(status);
CREATE INDEX IF NOT EXISTS idx_calendly_historical_stats_has_utm ON public.calendly_historical_stats(has_utm);
CREATE INDEX IF NOT EXISTS idx_calendly_historical_stats_composite ON public.calendly_historical_stats(user_name, year, month, event_type_category, status);

-- Índice adicional para búsquedas por año y mes
CREATE INDEX IF NOT EXISTS idx_calendly_historical_stats_year_month_composite ON public.calendly_historical_stats(year, month);

-- Habilitar RLS si no está habilitado
ALTER TABLE public.calendly_historical_stats ENABLE ROW LEVEL SECURITY;

-- Política: todos los usuarios autenticados pueden leer (crear solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'calendly_historical_stats'
    AND policyname = 'Authenticated users can view historical stats'
  ) THEN
    CREATE POLICY "Authenticated users can view historical stats" ON public.calendly_historical_stats
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Nota: Las operaciones de escritura se hacen con service role key,
-- que bypassa RLS automáticamente, por lo que no necesitamos políticas de escritura

