-- Migration: Add Acuity Scheduling integration tables
-- Run this in your Supabase SQL Editor

-- =============================================
-- ACUITY APPOINTMENTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.acuity_appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  acuity_id BIGINT NOT NULL UNIQUE,
  calendar_id BIGINT,
  calendar_name TEXT,
  appointment_type_id BIGINT NOT NULL,
  appointment_type_name TEXT NOT NULL,
  appointment_category TEXT NOT NULL CHECK (appointment_category IN ('medición', 'fitting')),
  datetime TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  phone TEXT,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'canceled', 'rescheduled')),
  canceled_at TIMESTAMPTZ,
  rescheduled_from_id BIGINT,
  scheduling_link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acuity_appointments_acuity_id ON public.acuity_appointments(acuity_id);
CREATE INDEX IF NOT EXISTS idx_acuity_appointments_datetime ON public.acuity_appointments(datetime);
CREATE INDEX IF NOT EXISTS idx_acuity_appointments_status ON public.acuity_appointments(status);
CREATE INDEX IF NOT EXISTS idx_acuity_appointments_calendar_id ON public.acuity_appointments(calendar_id);
CREATE INDEX IF NOT EXISTS idx_acuity_appointments_appointment_type_id ON public.acuity_appointments(appointment_type_id);
CREATE INDEX IF NOT EXISTS idx_acuity_appointments_appointment_category ON public.acuity_appointments(appointment_category);
CREATE INDEX IF NOT EXISTS idx_acuity_appointments_calendar_category ON public.acuity_appointments(calendar_name, appointment_category);

-- =============================================
-- ACUITY AVAILABILITY
-- =============================================

CREATE TABLE IF NOT EXISTS public.acuity_availability (
  id TEXT PRIMARY KEY, -- Composite: date-calendar_id-category
  date DATE NOT NULL,
  calendar_id BIGINT,
  calendar_name TEXT NOT NULL,
  appointment_category TEXT NOT NULL CHECK (appointment_category IN ('medición', 'fitting')),
  total_slots INTEGER NOT NULL DEFAULT 0,
  available_slots INTEGER NOT NULL DEFAULT 0,
  booked_slots INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acuity_availability_date ON public.acuity_availability(date);
CREATE INDEX IF NOT EXISTS idx_acuity_availability_calendar_id ON public.acuity_availability(calendar_id);
CREATE INDEX IF NOT EXISTS idx_acuity_availability_calendar_name ON public.acuity_availability(calendar_name);
CREATE INDEX IF NOT EXISTS idx_acuity_availability_category ON public.acuity_availability(appointment_category);
CREATE INDEX IF NOT EXISTS idx_acuity_availability_date_calendar_category ON public.acuity_availability(date, calendar_name, appointment_category);

-- =============================================
-- ACUITY APPOINTMENT COUNTS (Monthly Historical)
-- =============================================

CREATE TABLE IF NOT EXISTS public.acuity_appointment_counts (
  id TEXT PRIMARY KEY, -- Composite: YYYY-MM-calendar_name-category
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  calendar_name TEXT NOT NULL,
  appointment_category TEXT NOT NULL CHECK (appointment_category IN ('medición', 'fitting')),
  total_count INTEGER NOT NULL DEFAULT 0,
  scheduled_count INTEGER NOT NULL DEFAULT 0,
  canceled_count INTEGER NOT NULL DEFAULT 0,
  rescheduled_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acuity_appointment_counts_year_month ON public.acuity_appointment_counts(year, month);
CREATE INDEX IF NOT EXISTS idx_acuity_appointment_counts_year ON public.acuity_appointment_counts(year);
CREATE INDEX IF NOT EXISTS idx_acuity_appointment_counts_calendar_name ON public.acuity_appointment_counts(calendar_name);
CREATE INDEX IF NOT EXISTS idx_acuity_appointment_counts_category ON public.acuity_appointment_counts(appointment_category);
CREATE INDEX IF NOT EXISTS idx_acuity_appointment_counts_calendar_category ON public.acuity_appointment_counts(calendar_name, appointment_category);

-- =============================================
-- ACUITY CALENDARS
-- =============================================

CREATE TABLE IF NOT EXISTS public.acuity_calendars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  acuity_calendar_id BIGINT,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  appointment_category TEXT NOT NULL CHECK (appointment_category IN ('medición', 'fitting')),
  appointment_type_id BIGINT NOT NULL,
  appointment_type_name TEXT NOT NULL,
  scheduling_link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(acuity_calendar_id, appointment_type_id)
);

CREATE INDEX IF NOT EXISTS idx_acuity_calendars_acuity_calendar_id ON public.acuity_calendars(acuity_calendar_id);
CREATE INDEX IF NOT EXISTS idx_acuity_calendars_name ON public.acuity_calendars(name);
CREATE INDEX IF NOT EXISTS idx_acuity_calendars_category ON public.acuity_calendars(appointment_category);
CREATE INDEX IF NOT EXISTS idx_acuity_calendars_appointment_type_id ON public.acuity_calendars(appointment_type_id);

-- =============================================
-- UPDATE INTEGRATION SETTINGS
-- =============================================

-- Add 'acuity' to the CHECK constraint
-- Primero verificamos y eliminamos valores inválidos si existen
DO $$
BEGIN
  -- Eliminar cualquier fila con valores inválidos (por si acaso)
  DELETE FROM public.integration_settings 
  WHERE integration NOT IN ('calendly', 'shopify', 'meta', 'analytics', 'airtable', 'acuity');
END $$;

-- Eliminar el constraint existente si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'integration_settings_integration_check'
    AND conrelid = 'public.integration_settings'::regclass
  ) THEN
    ALTER TABLE public.integration_settings 
      DROP CONSTRAINT integration_settings_integration_check;
  END IF;
END $$;

-- Agregar el nuevo constraint con 'acuity' incluido
ALTER TABLE public.integration_settings 
  ADD CONSTRAINT integration_settings_integration_check 
  CHECK (integration IN ('calendly', 'shopify', 'meta', 'analytics', 'airtable', 'acuity'));

-- Insert default Acuity integration setting (solo si no existe)
INSERT INTO public.integration_settings (integration, settings, connected) 
SELECT 'acuity', '{}'::jsonb, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.integration_settings WHERE integration = 'acuity'
);

-- =============================================
-- UPDATE SYNC_LOGS CONSTRAINT
-- =============================================

-- Update sync_logs CHECK constraint to include 'acuity'
-- NOTA: También incluimos 'instagram' que ya existe en la base de datos
-- Esto solo AGREGA valores a la lista permitida, NO afecta a las integraciones existentes

-- Paso 1: Eliminar el constraint existente (si existe)
ALTER TABLE public.sync_logs 
  DROP CONSTRAINT IF EXISTS sync_logs_integration_check;

-- Paso 2: Limpiar cualquier fila que tenga valores NULL o completamente inválidos
-- Esto es una precaución - solo eliminaría filas con NULL o valores realmente inválidos
-- Las integraciones existentes (calendly, shopify, meta, analytics, airtable, instagram, acuity) NO se verán afectadas
DELETE FROM public.sync_logs 
WHERE integration IS NULL 
   OR integration NOT IN ('calendly', 'shopify', 'meta', 'analytics', 'airtable', 'instagram', 'acuity');

-- Paso 3: Agregar el nuevo constraint con 'acuity' e 'instagram' incluidos
ALTER TABLE public.sync_logs 
  ADD CONSTRAINT sync_logs_integration_check 
  CHECK (integration IN ('calendly', 'shopify', 'meta', 'analytics', 'airtable', 'instagram', 'acuity'));

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE public.acuity_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acuity_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acuity_appointment_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acuity_calendars ENABLE ROW LEVEL SECURITY;

-- Policies: Authenticated users can view all data
-- Eliminar políticas existentes si existen y recrearlas
DROP POLICY IF EXISTS "Authenticated users can view acuity appointments" ON public.acuity_appointments;
DROP POLICY IF EXISTS "Authenticated users can manage acuity appointments" ON public.acuity_appointments;
DROP POLICY IF EXISTS "Authenticated users can view acuity availability" ON public.acuity_availability;
DROP POLICY IF EXISTS "Authenticated users can manage acuity availability" ON public.acuity_availability;
DROP POLICY IF EXISTS "Authenticated users can view acuity appointment counts" ON public.acuity_appointment_counts;
DROP POLICY IF EXISTS "Authenticated users can manage acuity appointment counts" ON public.acuity_appointment_counts;
DROP POLICY IF EXISTS "Authenticated users can view acuity calendars" ON public.acuity_calendars;
DROP POLICY IF EXISTS "Authenticated users can manage acuity calendars" ON public.acuity_calendars;

-- Crear las políticas
CREATE POLICY "Authenticated users can view acuity appointments" 
  ON public.acuity_appointments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage acuity appointments" 
  ON public.acuity_appointments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view acuity availability" 
  ON public.acuity_availability
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage acuity availability" 
  ON public.acuity_availability
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view acuity appointment counts" 
  ON public.acuity_appointment_counts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage acuity appointment counts" 
  ON public.acuity_appointment_counts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view acuity calendars" 
  ON public.acuity_calendars
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage acuity calendars" 
  ON public.acuity_calendars
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_acuity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
-- Eliminar triggers existentes si existen y recrearlos
DROP TRIGGER IF EXISTS update_acuity_appointments_updated_at ON public.acuity_appointments;
DROP TRIGGER IF EXISTS update_acuity_availability_updated_at ON public.acuity_availability;
DROP TRIGGER IF EXISTS update_acuity_appointment_counts_updated_at ON public.acuity_appointment_counts;
DROP TRIGGER IF EXISTS update_acuity_calendars_updated_at ON public.acuity_calendars;

-- Crear los triggers
CREATE TRIGGER update_acuity_appointments_updated_at
  BEFORE UPDATE ON public.acuity_appointments
  FOR EACH ROW EXECUTE FUNCTION update_acuity_updated_at();

CREATE TRIGGER update_acuity_availability_updated_at
  BEFORE UPDATE ON public.acuity_availability
  FOR EACH ROW EXECUTE FUNCTION update_acuity_updated_at();

CREATE TRIGGER update_acuity_appointment_counts_updated_at
  BEFORE UPDATE ON public.acuity_appointment_counts
  FOR EACH ROW EXECUTE FUNCTION update_acuity_updated_at();

CREATE TRIGGER update_acuity_calendars_updated_at
  BEFORE UPDATE ON public.acuity_calendars
  FOR EACH ROW EXECUTE FUNCTION update_acuity_updated_at();

