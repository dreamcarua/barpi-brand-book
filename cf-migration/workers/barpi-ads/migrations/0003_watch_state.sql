-- Watchdog state for the worker cron (14.10.2026). Applied via Cloudflare MCP.
CREATE TABLE IF NOT EXISTS ad_watch_state (k TEXT PRIMARY KEY, v TEXT, at TEXT NOT NULL);
