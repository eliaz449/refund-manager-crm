-- Gmail accounts (per-user, multiple accounts per phone)
CREATE TABLE IF NOT EXISTS gmail_accounts (
  id SERIAL PRIMARY KEY,
  owner_phone TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  refresh_token TEXT NOT NULL,
  scopes TEXT[],
  purpose TEXT DEFAULT 'general',   -- 'business' | 'personal' | 'spouse'
  active BOOLEAN DEFAULT TRUE,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_phone, email)
);
CREATE INDEX IF NOT EXISTS idx_gmail_accounts_owner ON gmail_accounts(owner_phone) WHERE active = TRUE;

-- OAuth state tokens (temporary, for OAuth callback)
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  owner_phone TEXT NOT NULL,
  purpose TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '15 minutes')
);

-- Bank transactions (parsed from bank emails)
CREATE TABLE IF NOT EXISTS bank_transactions (
  id SERIAL PRIMARY KEY,
  owner_phone TEXT NOT NULL,
  gmail_account_id INT REFERENCES gmail_accounts(id) ON DELETE SET NULL,
  bank_name TEXT NOT NULL,               -- 'mizrahi_tefahot', 'hapoalim', 'chase', etc.
  account_last4 TEXT,
  transaction_date DATE NOT NULL,
  posted_date DATE,
  amount NUMERIC(15,2) NOT NULL,          -- negative = outgoing, positive = incoming
  currency TEXT DEFAULT 'ILS',
  description TEXT,
  merchant TEXT,
  category TEXT,                          -- 'food', 'transport', 'housing', 'income', 'transfer', etc.
  raw_line TEXT,                          -- original line from statement
  source_email_id TEXT,                   -- gmail message id
  source_email_subject TEXT,
  source_statement_period TEXT,           -- '2026-05' or '2026-05-15_to_2026-06-14'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_phone, bank_name, transaction_date, amount, description)
);
CREATE INDEX IF NOT EXISTS idx_bank_tx_owner ON bank_transactions(owner_phone, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_tx_source ON bank_transactions(source_email_id);

-- Bank email tracking (which emails have been processed)
CREATE TABLE IF NOT EXISTS bank_emails_processed (
  gmail_id TEXT PRIMARY KEY,
  owner_phone TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  transaction_count INT DEFAULT 0,
  total_debits NUMERIC(15,2),
  total_credits NUMERIC(15,2),
  currency TEXT,
  status TEXT DEFAULT 'success',
  error_message TEXT
);

-- Bank summary snapshots (monthly rollups)
CREATE TABLE IF NOT EXISTS bank_monthly_summary (
  id SERIAL PRIMARY KEY,
  owner_phone TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  period TEXT NOT NULL,                   -- '2026-05'
  total_income NUMERIC(15,2),
  total_expenses NUMERIC(15,2),
  net_change NUMERIC(15,2),
  transaction_count INT,
  top_categories JSONB,
  currency TEXT DEFAULT 'ILS',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_phone, bank_name, period)
);
