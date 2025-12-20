-- Migration: Add passwords table for storing credentials
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.passwords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_platform_username UNIQUE (user_id, platform, username)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_passwords_user_id ON public.passwords(user_id);
CREATE INDEX IF NOT EXISTS idx_passwords_platform ON public.passwords(platform);

-- Enable Row Level Security
ALTER TABLE public.passwords ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own passwords
CREATE POLICY "Users can view their own passwords"
  ON public.passwords
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own passwords
CREATE POLICY "Users can insert their own passwords"
  ON public.passwords
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own passwords
CREATE POLICY "Users can update their own passwords"
  ON public.passwords
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own passwords
CREATE POLICY "Users can delete their own passwords"
  ON public.passwords
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_passwords_updated_at
  BEFORE UPDATE ON public.passwords
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

