-- Create landmarks table for user-submitted hidden gems
CREATE TABLE IF NOT EXISTS landmarks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  image_url TEXT,
  category TEXT DEFAULT 'historical',
  type TEXT DEFAULT 'unique',
  created_by TEXT NOT NULL,
  created_by_name TEXT DEFAULT 'Anonymous',
  created_by_avatar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  upvotes INTEGER DEFAULT 0,
  upvoted_by TEXT[] DEFAULT '{}',
  reviews JSONB DEFAULT '[]',
  user_note TEXT,
  user_images TEXT[] DEFAULT '{}'
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_landmarks_location ON landmarks (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_landmarks_created_by ON landmarks (created_by);
CREATE INDEX IF NOT EXISTS idx_landmarks_type ON landmarks (type);
CREATE INDEX IF NOT EXISTS idx_landmarks_created_at ON landmarks (created_at DESC);

-- Enable Row Level Security
ALTER TABLE landmarks ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read landmarks
CREATE POLICY "Anyone can view landmarks" ON landmarks
  FOR SELECT USING (true);

-- Policy: Anyone can create landmarks (no auth required for now)
CREATE POLICY "Anyone can create landmarks" ON landmarks
  FOR INSERT WITH CHECK (true);

-- Policy: Anyone can update landmarks (for upvotes/reviews)
CREATE POLICY "Anyone can update landmarks" ON landmarks
  FOR UPDATE USING (true);

-- Policy: Creator can delete their own landmarks
CREATE POLICY "Creator can delete own landmarks" ON landmarks
  FOR DELETE USING (true);


