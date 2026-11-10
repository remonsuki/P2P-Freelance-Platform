ALTER TABLE users ADD COLUMN verified_wallet_address TEXT;
ALTER TABLE users ADD CONSTRAINT users_verified_wallet_format CHECK (verified_wallet_address IS NULL OR verified_wallet_address ~ '^0x[0-9a-f]{40}$');
CREATE UNIQUE INDEX users_verified_wallet_unique ON users(verified_wallet_address) WHERE verified_wallet_address IS NOT NULL;
CREATE TABLE wallet_challenges (
  user_id BIGINT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE chain_payments (
  payment_id TEXT PRIMARY KEY CHECK (payment_id ~ '^0x[0-9a-f]{64}$'),
  student_id BIGINT NOT NULL REFERENCES users(user_id),
  teacher_id BIGINT NOT NULL REFERENCES users(user_id),
  course_id BIGINT NOT NULL REFERENCES courses(course_id),
  class_id BIGINT NOT NULL REFERENCES classes(class_id),
  scheduled_date DATE NOT NULL,
  slot_type VARCHAR(20) NOT NULL,
  course_title TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  student_name TEXT NOT NULL,
  price NUMERIC(18,6) NOT NULL CHECK (price>0),
  chain_id BIGINT NOT NULL,
  token_address TEXT NOT NULL,
  escrow_address TEXT NOT NULL,
  quote JSONB NOT NULL,
  signature TEXT NOT NULL,
  created_block BIGINT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted','funded','disputed','released','refunded','expired')),
  last_tx_hash TEXT,
  funded_tx_hash TEXT,
  synced_block BIGINT NOT NULL DEFAULT 0,
  dispute_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (student_id<>teacher_id)
);
CREATE UNIQUE INDEX chain_teacher_slot ON chain_payments(teacher_id,scheduled_date,slot_type) WHERE status IN ('quoted','funded','disputed','released');
CREATE UNIQUE INDEX chain_student_slot ON chain_payments(student_id,scheduled_date,slot_type) WHERE status IN ('quoted','funded','disputed','released');
ALTER TABLE bookings ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'ytc' CHECK (payment_method IN ('ytc','skill'));
ALTER TABLE bookings ADD COLUMN chain_payment_id TEXT UNIQUE REFERENCES chain_payments(payment_id);
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_reference CHECK (
  (payment_method='ytc' AND chain_payment_id IS NULL) OR (payment_method='skill' AND chain_payment_id IS NOT NULL)
);

-- A late re-sync of an old refunded booking must not clear a newer pending hold.
CREATE OR REPLACE FUNCTION sync_class_booking_state() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target BIGINT;
BEGIN
  IF TG_OP='DELETE' THEN target:=OLD.class_id; ELSE target:=NEW.class_id; END IF;
  UPDATE classes c SET is_booked=(
    EXISTS(SELECT 1 FROM bookings b WHERE b.class_id=target AND b.status IN ('confirmed','disputed','completed')) OR
    EXISTS(SELECT 1 FROM chain_payments p WHERE p.class_id=target AND p.status IN ('quoted','funded','disputed','released'))
  ) WHERE c.class_id=target;
  IF TG_OP='UPDATE' AND OLD.class_id<>NEW.class_id THEN
    UPDATE classes c SET is_booked=(
      EXISTS(SELECT 1 FROM bookings b WHERE b.class_id=OLD.class_id AND b.status IN ('confirmed','disputed','completed')) OR
      EXISTS(SELECT 1 FROM chain_payments p WHERE p.class_id=OLD.class_id AND p.status IN ('quoted','funded','disputed','released'))
    ) WHERE c.class_id=OLD.class_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER chain_payments_sync_class AFTER INSERT OR UPDATE OR DELETE ON chain_payments
FOR EACH ROW EXECUTE FUNCTION sync_class_booking_state();
