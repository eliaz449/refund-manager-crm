-- Portal sessions: document collection + contract signing per client
CREATE TABLE IF NOT EXISTS portal_sessions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR NOT NULL,
  token TEXT NOT NULL UNIQUE,
  commission_type TEXT NOT NULL DEFAULT 'percentage',
  commission_value NUMERIC,
  required_docs TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  contract_signed_at TIMESTAMP,
  signer_name TEXT,
  signer_ip TEXT,
  expires_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by TEXT
);

-- Documents uploaded by clients via the portal
CREATE TABLE IF NOT EXISTS portal_doc_uploads (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_session_id VARCHAR NOT NULL,
  client_id VARCHAR NOT NULL,
  doc_key TEXT NOT NULL,
  doc_label TEXT,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  uploaded_at TIMESTAMP DEFAULT NOW()
);
