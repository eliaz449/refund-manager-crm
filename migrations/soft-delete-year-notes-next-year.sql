-- Soft delete support for clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Year notes per client (JSON: {"2021": "הוגש", "2022": "..."})
ALTER TABLE clients ADD COLUMN IF NOT EXISTS year_notes TEXT;

-- next_year contact status — for transferring not-relevant leads to next tax year
ALTER TYPE contact_status ADD VALUE IF NOT EXISTS 'next_year';
