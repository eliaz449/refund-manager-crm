-- Lead follow-up bot state per client
-- Tracks the Gmail Agent's autonomous engagement with each lead

-- Extend contact_status enum with the new bot-driven statuses
ALTER TYPE contact_status ADD VALUE IF NOT EXISTS 'waiting_for_docs';
ALTER TYPE contact_status ADD VALUE IF NOT EXISTS 'missing_docs';
ALTER TYPE contact_status ADD VALUE IF NOT EXISTS 'closed_won';

CREATE TABLE IF NOT EXISTS lead_bot_state (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      varchar NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  flow           text NOT NULL,               -- 'waiting_for_docs' | 'no_answer_callback' | 'in_treatment' | 'closed_won_feedback'
  reminder_count int NOT NULL DEFAULT 0,
  next_reminder_at timestamptz,
  last_msg_sent_at timestamptz,
  taker_phone    text,                        -- who took ownership after "לא ענה" callback
  missing_items  text,                        -- comma-separated list, set when Eliaz says "חסר X"
  meta           jsonb NOT NULL DEFAULT '{}'::jsonb,
  paused         boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_bot_state_next_reminder_idx
  ON lead_bot_state (next_reminder_at)
  WHERE paused = false AND next_reminder_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS lead_bot_state_flow_idx
  ON lead_bot_state (flow);
