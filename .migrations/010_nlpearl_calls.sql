CREATE TABLE IF NOT EXISTS nlpearl_calls (
  id SERIAL PRIMARY KEY,
  call_id TEXT UNIQUE,
  owner_phone TEXT,
  agent_id TEXT,
  to_phone TEXT,
  call_name TEXT,
  duration_sec INT,
  status TEXT,
  transcript TEXT,
  summary TEXT,
  recording_url TEXT,
  context_variables JSONB,
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  raw JSONB
);
CREATE INDEX IF NOT EXISTS idx_nlpearl_owner ON nlpearl_calls(owner_phone, initiated_at DESC);
