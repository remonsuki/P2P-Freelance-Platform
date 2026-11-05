-- Defaults do not prohibit NULL, and CHECK expressions accept UNKNOWN/NULL.
-- Keep truly optional fields nullable, but require all accounting and state fields.
ALTER TABLE users ALTER COLUMN role SET NOT NULL;
ALTER TABLE users ALTER COLUMN cached_points SET NOT NULL;
ALTER TABLE users ALTER COLUMN student_rating SET NOT NULL;
ALTER TABLE users ALTER COLUMN teacher_rating SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_nonempty_identity CHECK (LENGTH(BTRIM(username))>0 AND LENGTH(BTRIM(email))>0);
ALTER TABLE users ADD CONSTRAINT users_wallet_format CHECK (wallet_address IS NULL OR wallet_address ~ '^0x[0-9a-fA-F]{40}$');
ALTER TABLE skills ADD CONSTRAINT skills_nonempty CHECK (LENGTH(BTRIM(name))>0 AND LENGTH(BTRIM(category))>0);
ALTER TABLE classes ALTER COLUMN is_booked SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN status SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN payment_status SET NOT NULL;
ALTER TABLE bookings ADD CONSTRAINT bookings_slot_values CHECK (slot_type IN ('morning','afternoon','evening'));
ALTER TABLE point_transactions ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE point_transactions ALTER COLUMN tx_status SET NOT NULL;
ALTER TABLE reviews ALTER COLUMN created_at SET NOT NULL;
