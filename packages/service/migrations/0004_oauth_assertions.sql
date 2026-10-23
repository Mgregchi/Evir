CREATE TABLE oauth_assertions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX oauth_assertions_expiry ON oauth_assertions(expires_at);
