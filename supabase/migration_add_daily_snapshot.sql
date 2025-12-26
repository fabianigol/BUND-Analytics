-- Migration: Add 'daily' period type to acuity_availability_history
-- Run this in your Supabase SQL Editor
-- 
-- Esta migración agrega el tipo 'daily' al constraint CHECK de period_type
-- para permitir snapshots diarios de ocupación

-- Eliminar el constraint existente
ALTER TABLE public.acuity_availability_history 
DROP CONSTRAINT IF EXISTS acuity_availability_history_period_type_check;

-- Agregar el nuevo constraint que incluye 'daily'
ALTER TABLE public.acuity_availability_history 
ADD CONSTRAINT acuity_availability_history_period_type_check 
CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly'));

-- Verificar que se aplicó correctamente
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.acuity_availability_history'::regclass
  AND conname = 'acuity_availability_history_period_type_check';

