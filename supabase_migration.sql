-- Supabase Migration File for Tower of Hanoi Leaderboard
-- Run this in your Supabase SQL Editor to set up the database schema!

-- 1. Create the leaderboard table
CREATE TABLE IF NOT EXISTS public.leaderboard (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    username VARCHAR(50) NOT NULL,
    disk_count INTEGER NOT NULL CHECK (disk_count >= 3 AND disk_count <= 7),
    moves INTEGER NOT NULL,
    time INTEGER NOT NULL -- Duration in seconds
);

-- 2. Create index for fast leaderboard queries and database deduplication
CREATE INDEX IF NOT EXISTS idx_leaderboard_dedup 
ON public.leaderboard (disk_count, username, moves ASC, time ASC);

-- 3. Create the deduplicated Leaderboard View
-- This view filters out all duplicate scores internally in the database,
-- extracting only the single best record (fewest moves, fastest time) per player.
CREATE OR REPLACE VIEW public.leaderboard_view AS
SELECT DISTINCT ON (username, disk_count)
    id,
    created_at,
    username,
    disk_count,
    moves,
    time
FROM public.leaderboard
ORDER BY username, disk_count, moves ASC, time ASC;

-- 4. Grant SELECT permission on the view to public API roles (anon and authenticated)
GRANT SELECT ON public.leaderboard_view TO anon, authenticated, service_role;

-- 5. Enable Row Level Security (RLS) on raw table
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- 6. Set up Policies on raw table
-- Policy A: Allow everyone (including anonymous users) to read raw scores if needed
CREATE POLICY "Allow public read access" 
ON public.leaderboard 
FOR SELECT 
USING (true);

-- Policy B: Allow everyone to submit their high scores
CREATE POLICY "Allow public insert access" 
ON public.leaderboard 
FOR INSERT 
WITH CHECK (true);
