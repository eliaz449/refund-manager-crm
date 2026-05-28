-- Add 'partner' to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'partner';

-- Create partner enums
DO $$ BEGIN
  CREATE TYPE partner_lead_status AS ENUM ('new', 'contacted', 'interested', 'not_interested', 'in_progress', 'closed_won', 'closed_lost');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE partner_lead_source AS ENUM ('owner_shared', 'partner_added');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE partner_activity_action AS ENUM ('lead_shared', 'lead_added', 'status_changed', 'note_added', 'lead_updated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tables
CREATE TABLE IF NOT EXISTS partner_leads (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id VARCHAR NOT NULL,
  client_id VARCHAR,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  status partner_lead_status NOT NULL DEFAULT 'new',
  notes TEXT,
  source partner_lead_source NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_lead_activities (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_lead_id VARCHAR NOT NULL,
  actor_id VARCHAR NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action partner_activity_action NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_leads_partner ON partner_leads(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_activities_lead ON partner_lead_activities(partner_lead_id);
