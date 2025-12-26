-- Migration: Add image_url field to prompts table
-- Run this in your Supabase SQL Editor

-- Añadir campo image_url a la tabla prompts
ALTER TABLE public.prompts 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Crear índice para mejorar búsquedas (opcional pero recomendado)
CREATE INDEX IF NOT EXISTS idx_prompts_image_url ON public.prompts(image_url) WHERE image_url IS NOT NULL;


