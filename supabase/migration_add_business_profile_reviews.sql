-- Migration: Add reviews table for caching Google Business Profile reviews
-- This table allows efficient detection of new reviews and better performance

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL,
  review_id TEXT NOT NULL UNIQUE,
  author_name TEXT,
  author_photo_url TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  create_time TIMESTAMP NOT NULL,
  update_time TIMESTAMP NOT NULL,
  reply_text TEXT,
  reply_time TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_location_id ON reviews(location_id);
CREATE INDEX IF NOT EXISTS idx_reviews_review_id ON reviews(review_id);
CREATE INDEX IF NOT EXISTS idx_reviews_create_time ON reviews(create_time);
CREATE INDEX IF NOT EXISTS idx_reviews_synced_at ON reviews(synced_at);

-- RLS (Row Level Security) policies
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own reviews
CREATE POLICY "Users can view their own reviews"
  ON reviews FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own reviews
CREATE POLICY "Users can insert their own reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own reviews
CREATE POLICY "Users can update their own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own reviews
CREATE POLICY "Users can delete their own reviews"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_reviews_updated_at();

-- Comments for documentation
COMMENT ON TABLE reviews IS 'Cache table for Google Business Profile reviews to enable efficient new review detection';
COMMENT ON COLUMN reviews.review_id IS 'Unique identifier from Google Business Profile API';
COMMENT ON COLUMN reviews.location_id IS 'Location ID from Google Business Profile';
COMMENT ON COLUMN reviews.rating IS 'Rating from 1 to 5 stars';
COMMENT ON COLUMN reviews.synced_at IS 'When this review was last synced from the API';

