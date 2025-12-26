-- Migration: Add Acuity Availability by Store tables
-- Run this in your Supabase SQL Editor
-- 
-- NOTA: Esta migración es SEGURA. Los comandos DROP IF EXISTS son seguros porque:
-- 1. Solo eliminan políticas/triggers si existen (IF EXISTS)
-- 2. Inmediatamente después se recrean con CREATE
-- 3. Es la práctica estándar en migraciones SQL para evitar duplicados
-- 
-- Si ves un warning, puedes ejecutarla con confianza. No afecta datos existentes.

-- =============================================
-- ACUITY AVAILABILITY BY STORE
-- =============================================

CREATE TABLE IF NOT EXISTS public.acuity_availability_by_store (
  id TEXT PRIMARY KEY, -- Composite: date-store_name-category
  date DATE NOT NULL,
  store_name TEXT NOT NULL, -- Nombre normalizado de tienda
  appointment_type_id BIGINT NOT NULL,
  appointment_category TEXT NOT NULL CHECK (appointment_category IN ('medición', 'fitting')),
  total_slots INTEGER NOT NULL DEFAULT 0, -- Total de slots disponibles
  booked_slots INTEGER NOT NULL DEFAULT 0, -- Slots reservados
  available_slots INTEGER NOT NULL DEFAULT 0, -- Slots libres (total - booked)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acuity_availability_by_store_date ON public.acuity_availability_by_store(date);
CREATE INDEX IF NOT EXISTS idx_acuity_availability_by_store_store_name ON public.acuity_availability_by_store(store_name);
CREATE INDEX IF NOT EXISTS idx_acuity_availability_by_store_category ON public.acuity_availability_by_store(appointment_category);
CREATE INDEX IF NOT EXISTS idx_acuity_availability_by_store_appointment_type_id ON public.acuity_availability_by_store(appointment_type_id);
CREATE INDEX IF NOT EXISTS idx_acuity_availability_by_store_date_store_category ON public.acuity_availability_by_store(date, store_name, appointment_category);

-- =============================================
-- ACUITY AVAILABILITY HISTORY (para comparativas)
-- =============================================

CREATE TABLE IF NOT EXISTS public.acuity_availability_history (
  id TEXT PRIMARY KEY, -- Composite: snapshot_date-store_name-category-period_type
  snapshot_date DATE NOT NULL, -- Fecha del snapshot
  store_name TEXT NOT NULL,
  appointment_category TEXT NOT NULL CHECK (appointment_category IN ('medición', 'fitting')),
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_slots INTEGER NOT NULL DEFAULT 0,
  booked_slots INTEGER NOT NULL DEFAULT 0,
  available_slots INTEGER NOT NULL DEFAULT 0,
  occupation_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acuity_availability_history_snapshot_date ON public.acuity_availability_history(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_acuity_availability_history_store_name ON public.acuity_availability_history(store_name);
CREATE INDEX IF NOT EXISTS idx_acuity_availability_history_category ON public.acuity_availability_history(appointment_category);
CREATE INDEX IF NOT EXISTS idx_acuity_availability_history_period_type ON public.acuity_availability_history(period_type);
CREATE INDEX IF NOT EXISTS idx_acuity_availability_history_period ON public.acuity_availability_history(period_start, period_end);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE public.acuity_availability_by_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acuity_availability_history ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen y recrearlas (es seguro, solo afecta políticas, no datos)
DROP POLICY IF EXISTS "Authenticated users can view acuity availability by store" ON public.acuity_availability_by_store;
DROP POLICY IF EXISTS "Authenticated users can manage acuity availability by store" ON public.acuity_availability_by_store;
DROP POLICY IF EXISTS "Authenticated users can view acuity availability history" ON public.acuity_availability_history;
DROP POLICY IF EXISTS "Authenticated users can manage acuity availability history" ON public.acuity_availability_history;

-- Crear las políticas
CREATE POLICY "Authenticated users can view acuity availability by store" 
  ON public.acuity_availability_by_store
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage acuity availability by store" 
  ON public.acuity_availability_by_store
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view acuity availability history" 
  ON public.acuity_availability_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage acuity availability history" 
  ON public.acuity_availability_history
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_acuity_availability_by_store_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe y recrearlo (es seguro, solo afecta triggers, no datos)
DROP TRIGGER IF EXISTS update_acuity_availability_by_store_updated_at ON public.acuity_availability_by_store;

CREATE TRIGGER update_acuity_availability_by_store_updated_at
  BEFORE UPDATE ON public.acuity_availability_by_store
  FOR EACH ROW EXECUTE FUNCTION update_acuity_availability_by_store_updated_at();
