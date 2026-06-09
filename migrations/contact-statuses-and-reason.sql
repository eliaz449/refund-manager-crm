-- New contact_status values for the quick-action menu
ALTER TYPE contact_status ADD VALUE IF NOT EXISTS 'not_interested';
ALTER TYPE contact_status ADD VALUE IF NOT EXISTS 'wrong_info';

-- Free-text reason captured when marking a lead as not_relevant
ALTER TABLE clients ADD COLUMN IF NOT EXISTS not_relevant_reason TEXT;
