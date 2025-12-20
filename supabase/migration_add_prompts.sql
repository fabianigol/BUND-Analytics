-- Migration: Add prompts table for storing AI prompts
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  emoji TEXT,
  color TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON public.prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_category ON public.prompts(category);

-- Enable Row Level Security
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own prompts
CREATE POLICY "Users can view their own prompts"
  ON public.prompts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own prompts
CREATE POLICY "Users can insert their own prompts"
  ON public.prompts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own prompts
CREATE POLICY "Users can update their own prompts"
  ON public.prompts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own prompts
CREATE POLICY "Users can delete their own prompts"
  ON public.prompts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_prompts_updated_at
  BEFORE UPDATE ON public.prompts
  FOR EACH ROW
  EXECUTE FUNCTION update_prompts_updated_at();

