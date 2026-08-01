CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id TEXT NOT NULL DEFAULT 'default',
  visitor_id TEXT,
  session_id TEXT,
  returning INTEGER DEFAULT 0,
  event TEXT NOT NULL,
  engagement_ms INTEGER DEFAULT 0,
  is_bot INTEGER DEFAULT 0,
  page TEXT,
  page_url TEXT,
  label TEXT,
  destination TEXT,
  country TEXT,
  city TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  language TEXT,
  timezone TEXT,
  screen TEXT,
  referrer TEXT,
  user_agent TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visits_site_created ON visits(site_id, created_at);
CREATE INDEX IF NOT EXISTS idx_visits_site_event ON visits(site_id, event);
CREATE INDEX IF NOT EXISTS idx_visits_site_visitor ON visits(site_id, visitor_id);
CREATE INDEX IF NOT EXISTS idx_visits_site_session ON visits(site_id, session_id);
