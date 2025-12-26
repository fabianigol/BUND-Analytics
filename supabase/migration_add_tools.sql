-- Migration: Add tools table for storing custom tools
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  emoji TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_tools_user_id ON public.tools(user_id);

-- Enable Row Level Security
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own tools
CREATE POLICY "Users can view their own tools"
  ON public.tools
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own tools
CREATE POLICY "Users can insert their own tools"
  ON public.tools
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own tools
CREATE POLICY "Users can update their own tools"
  ON public.tools
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own tools
CREATE POLICY "Users can delete their own tools"
  ON public.tools
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_tools_updated_at
  BEFORE UPDATE ON public.tools
  FOR EACH ROW
  EXECUTE FUNCTION update_tools_updated_at();


