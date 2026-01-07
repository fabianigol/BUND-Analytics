-- Migration: Add 'tour' to calendar_layer enum
-- Description: Añadir la capa 'tour' al enum de capas del calendario
-- Date: 2026-01-07

-- Para PostgreSQL, no podemos modificar un enum directamente si ya existe
-- Primero verificamos si ya existe el valor 'tour'
DO $$ 
BEGIN
    -- Intentar agregar el valor 'tour' al enum si no existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'tour' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'calendar_layer')
    ) THEN
        ALTER TYPE calendar_layer ADD VALUE 'tour';
    END IF;
END $$;

