-- Bank authorization fields on portal_sessions
ALTER TABLE portal_sessions
  ADD COLUMN IF NOT EXISTS bank_holder_name     TEXT,
  ADD COLUMN IF NOT EXISTS bank_holder_id       TEXT,
  ADD COLUMN IF NOT EXISTS bank_name            TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch          TEXT,
  ADD COLUMN IF NOT EXISTS bank_account         TEXT,
  ADD COLUMN IF NOT EXISTS bank_auth_signed_at  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS bank_auth_signer_ip  TEXT;
