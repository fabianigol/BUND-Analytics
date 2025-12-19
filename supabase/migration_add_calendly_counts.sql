-- Tabla para almacenar conteos agregados de citas de Calendly
-- Esto permite tener datos históricos sin necesidad de guardar datos personales

CREATE TABLE IF NOT EXISTS public.calendly_appointment_counts (
  id TEXT PRIMARY KEY, -- Formato: YYYY-MM (ej: "2025-01")
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  active_count INTEGER NOT NULL DEFAULT 0,
  canceled_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month)
);

CREATE INDEX IF NOT EXISTS idx_calendly_appointment_counts_year_month ON public.calendly_appointment_counts(year, month);
CREATE INDEX IF NOT EXISTS idx_calendly_appointment_counts_year ON public.calendly_appointment_counts(year);

-- Habilitar RLS
ALTER TABLE public.calendly_appointment_counts ENABLE ROW LEVEL SECURITY;

-- Política: todos los usuarios autenticados pueden leer
CREATE POLICY "Authenticated users can view appointment counts" ON public.calendly_appointment_counts
  FOR SELECT TO authenticated USING (true);

-- Nota: Las operaciones de escritura se hacen con service role key,
-- que bypassa RLS automáticamente, por lo que no necesitamos políticas de escritura

