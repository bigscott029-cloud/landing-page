ALTER TABLE visits ADD COLUMN session_id TEXT;
ALTER TABLE visits ADD COLUMN engagement_ms INTEGER DEFAULT 0;
ALTER TABLE visits ADD COLUMN is_bot INTEGER DEFAULT 0;
ALTER TABLE visits ADD COLUMN returning_visitor INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_visits_site_session ON visits(site_id, session_id);
