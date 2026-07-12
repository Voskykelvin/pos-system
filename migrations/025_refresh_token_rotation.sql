ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS "refreshTokenHash" VARCHAR(64);
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS "refreshExpiresAt" TIMESTAMPTZ;

UPDATE auth_sessions
SET "refreshExpiresAt" = "expiresAt"
WHERE "refreshExpiresAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_auth_sessions_refresh_hash
  ON auth_sessions("refreshTokenHash")
  WHERE "refreshTokenHash" IS NOT NULL;
