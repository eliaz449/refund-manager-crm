-- Self-employed specific fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS vat_number TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS self_employed_business_type TEXT;  -- exempt | authorized | company
ALTER TABLE clients ADD COLUMN IF NOT EXISTS vat_frequency TEXT;                -- monthly | bimonthly
ALTER TABLE clients ADD COLUMN IF NOT EXISTS vat_next_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS advance_payment_monthly NUMERIC;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS national_insurance_ok BOOLEAN DEFAULT FALSE;
-- JSON array: [{"year":2024,"status":"submitted","amount":"5000","notes":""}]
ALTER TABLE clients ADD COLUMN IF NOT EXISTS self_employed_years TEXT;
