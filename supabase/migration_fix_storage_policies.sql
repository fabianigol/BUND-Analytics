-- Migration: Fix Storage RLS policies for prompts bucket
-- Run this in your Supabase SQL Editor

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Users can upload prompt images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view prompt images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their prompt images" ON storage.objects;

-- Política para permitir que usuarios autenticados suban imágenes en su propia carpeta
CREATE POLICY "Users can upload prompt images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'prompts' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir que usuarios autenticados lean todas las imágenes del bucket prompts
CREATE POLICY "Users can view prompt images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'prompts');

-- Política para permitir que usuarios autenticados eliminen sus propias imágenes
CREATE POLICY "Users can delete their prompt images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'prompts' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Política para permitir que usuarios autenticados actualicen sus propias imágenes
CREATE POLICY "Users can update their prompt images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'prompts' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'prompts' AND
  (storage.foldername(name))[1] = auth.uid()::text
);


