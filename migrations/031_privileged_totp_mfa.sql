ALTER TABLE users ADD COLUMN IF NOT EXISTS "mfaEnabled" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "mfaSecretEncrypted" TEXT;
ALTER TABLE users ADD CONSTRAINT users_mfa_secret_check
  CHECK ("mfaEnabled" = FALSE OR "mfaSecretEncrypted" IS NOT NULL);
