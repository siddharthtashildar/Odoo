-- Add missing columns to offboarding_processes if they don't exist
ALTER TABLE offboarding_processes 
  ADD COLUMN IF NOT EXISTS access_revoked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assets_returned BOOLEAN NOT NULL DEFAULT false;

-- Add assigned_hr and buddy columns to onboarding_processes if they don't exist
ALTER TABLE onboarding_processes
  ADD COLUMN IF NOT EXISTS assigned_hr TEXT,
  ADD COLUMN IF NOT EXISTS buddy TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;
