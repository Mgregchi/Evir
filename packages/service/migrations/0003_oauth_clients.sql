-- Registered connector identities are immutable. Never expire client credentials
-- on a deploy; user grants/tokens keep their independent expiry and revocation.
CREATE TABLE oauth_clients (
  id TEXT PRIMARY KEY,
  metadata TEXT NOT NULL,
  secret_hash TEXT,
  created_at INTEGER NOT NULL
);
