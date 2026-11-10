CREATE TABLE registration_wallet_challenges (
  challenge_id TEXT PRIMARY KEY CHECK (challenge_id ~ '^[0-9a-f]{64}$'),
  browser_hash TEXT NOT NULL,
  email TEXT NOT NULL,
  wallet_address TEXT NOT NULL CHECK (wallet_address ~ '^0x[0-9a-f]{40}$'),
  origin TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX registration_wallet_challenges_expiry ON registration_wallet_challenges(expires_at);

-- Existing accounts may bind once. Verified bindings cannot be changed or cleared.
CREATE FUNCTION enforce_permanent_wallet_binding() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.verified_wallet_address IS NOT NULL AND NEW.verified_wallet_address IS DISTINCT FROM OLD.verified_wallet_address THEN
    RAISE EXCEPTION 'Wallet binding is immutable'
      USING ERRCODE='23514', CONSTRAINT='users_wallet_binding_immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER users_permanent_wallet_binding BEFORE UPDATE OF verified_wallet_address ON users
FOR EACH ROW EXECUTE FUNCTION enforce_permanent_wallet_binding();
