-- Append-only migrations. Never edit an applied migration or drop account data on deploy.
CREATE TABLE accounts (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
CREATE TABLE credentials (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL, counter INTEGER NOT NULL, transports TEXT NOT NULL,
  label TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX credentials_account ON credentials(account_id);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE challenges (
  token_hash TEXT PRIMARY KEY, challenge TEXT NOT NULL, kind TEXT NOT NULL,
  account_id TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE grants (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL, client_name TEXT NOT NULL, scope TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER
);
CREATE INDEX grants_account ON grants(account_id);
CREATE TABLE codes (
  token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL, client_name TEXT NOT NULL, redirect_uri TEXT NOT NULL,
  resource TEXT NOT NULL, scope TEXT NOT NULL, challenge TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE tokens (
  token_hash TEXT PRIMARY KEY, grant_id TEXT NOT NULL REFERENCES grants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX tokens_grant ON tokens(grant_id);
CREATE TABLE recovery_codes (
  token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE TABLE rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
