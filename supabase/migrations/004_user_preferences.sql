-- ============================================================
-- CampusStay — User preferences column
-- Run this after 002_rls.sql
-- ============================================================

-- Add a JSONB preferences column to the existing profiles table.
-- This stores user settings like notification preferences, theme, etc.
-- Structure: { "email_notifications": true, "default_property_type": "pg" }
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';

-- Allow authenticated users to update their own preferences column.
-- The existing RLS policy (profiles_update_own_safe_columns) already ensures
-- only the row owner can UPDATE, so this GRANT just adds the column to the
-- allowed list alongside full_name, occupation, age, gender, avatar_url.
GRANT UPDATE (preferences) ON public.profiles TO authenticated;
