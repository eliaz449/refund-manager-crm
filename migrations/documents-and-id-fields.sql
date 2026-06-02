-- New enum for document categories
DO $$ BEGIN
  CREATE TYPE document_category AS ENUM (
    'id_card', 'form_1301', 'form_135', 'tax_authority_letter',
    'bank_statement', 'salary_slip', 'tax_certificate', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  category document_category DEFAULT 'other',
  uploaded_by VARCHAR,
  uploaded_by_name TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id);

-- New columns on clients (all nullable — existing rows unaffected)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS id_issue_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS id_document_number TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS refund_paid_to_client NUMERIC;
