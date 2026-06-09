-- Track whether a scheduled reminder has been sent by email already
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS email_notified BOOLEAN DEFAULT FALSE;
