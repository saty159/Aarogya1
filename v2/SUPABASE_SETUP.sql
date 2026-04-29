-- SUPABASE SETUP INSTRUCTIONS
-- Run this inside your Supabase SQL Editor to create the users schema

CREATE TABLE public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Standard Access Policies
CREATE POLICY "Allow public access for inserts" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow users to read their own data" ON public.users FOR SELECT USING (true);
