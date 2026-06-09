-- New free-text status + per-client financial tracking + pensions checklist
ALTER TABLE clients ADD COLUMN IF NOT EXISTS custom_status TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS refund_estimate_amount NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS submission_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS commission_amount NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS receipt_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pension_years_checked TEXT;
