-- Migration: Add calendar events table
-- Description: Crear tabla para eventos de calendario con capas (Marketing, Operaciones, PR, Retail, Producto, Personal)
-- Date: 2026-01-07

-- Create enum for calendar layers
CREATE TYPE calendar_layer AS ENUM (
  'marketing',
  'operations',
  'pr',
  'retail',
  'product',
  'personal',
  'otros'
);

-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  layer calendar_layer NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: end_date must be >= start_date
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create indexes for efficient queries
CREATE INDEX idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_layer ON calendar_events(layer);
CREATE INDEX idx_calendar_events_start_date ON calendar_events(start_date);
CREATE INDEX idx_calendar_events_end_date ON calendar_events(end_date);
CREATE INDEX idx_calendar_events_date_range ON calendar_events(start_date, end_date);

-- Enable Row Level Security
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view all events EXCEPT personal events from other users
CREATE POLICY "Users can view all non-personal events"
  ON calendar_events
  FOR SELECT
  USING (
    layer != 'personal' OR user_id = auth.uid()
  );

-- RLS Policy: Users can view their own personal events
CREATE POLICY "Users can view their own personal events"
  ON calendar_events
  FOR SELECT
  USING (
    layer = 'personal' AND user_id = auth.uid()
  );

-- RLS Policy: Users can insert events in any layer
CREATE POLICY "Users can create events"
  ON calendar_events
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

-- RLS Policy: Users can only update their own events
CREATE POLICY "Users can update their own events"
  ON calendar_events
  FOR UPDATE
  USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
  );

-- RLS Policy: Users can only delete their own events
CREATE POLICY "Users can delete their own events"
  ON calendar_events
  FOR DELETE
  USING (
    user_id = auth.uid()
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_calendar_events_updated_at_trigger
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_events_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON calendar_events TO authenticated;
GRANT USAGE ON TYPE calendar_layer TO authenticated;

