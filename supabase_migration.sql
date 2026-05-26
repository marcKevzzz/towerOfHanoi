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

-- 2. Create index for fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_query 
ON public.leaderboard (disk_count, moves ASC, time ASC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- 4. Set up Policies
-- Policy A: Allow everyone to read scores
CREATE POLICY "Allow public read access" 
ON public.leaderboard 
FOR SELECT 
USING (true);

-- Policy B: Allow everyone to submit new high scores
CREATE POLICY "Allow public insert access" 
ON public.leaderboard 
FOR INSERT 
WITH CHECK (true);

-- Policy C: Allow everyone to update their existing records (personal best updates)
CREATE POLICY "Allow public update access" 
ON public.leaderboard 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Policy D: Allow everyone to clean up duplicate records if necessary
CREATE POLICY "Allow public delete access" 
ON public.leaderboard 
FOR DELETE 
USING (true);
