-- Migration: Add 'otros' to calendar_layer enum
-- Description: Añadir la capa 'otros' al enum de capas del calendario
-- Date: 2026-01-07

-- Para PostgreSQL, no podemos modificar un enum directamente si ya existe
-- Primero verificamos si ya existe el valor 'otros'
DO $$ 
BEGIN
    -- Intentar agregar el valor 'otros' al enum si no existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'otros' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'calendar_layer')
    ) THEN
        ALTER TYPE calendar_layer ADD VALUE 'otros';
    END IF;
END $$;


