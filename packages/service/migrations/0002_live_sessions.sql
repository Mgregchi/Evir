-- Pairing metadata only. Scene payloads are never stored in D1.
CREATE TABLE live_sessions (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  grant_id TEXT NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL, artboard_id TEXT NOT NULL, label TEXT NOT NULL,
  permissions TEXT NOT NULL, owner_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE INDEX live_sessions_owner ON live_sessions(account_id);
CREATE INDEX live_sessions_grant ON live_sessions(grant_id);
CREATE INDEX live_sessions_expiry ON live_sessions(expires_at);
