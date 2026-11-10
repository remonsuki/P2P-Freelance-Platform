-- Preserve historical point transactions, but remove the database balance entirely.
ALTER TABLE point_transactions RENAME TO legacy_point_transactions;
ALTER TABLE users DROP COLUMN cached_points;
ALTER TABLE bookings ADD COLUMN archived_at TIMESTAMPTZ;
UPDATE bookings SET archived_at=NOW() WHERE payment_method='ytc';
ALTER TABLE bookings ALTER COLUMN payment_method SET DEFAULT 'skill';
ALTER TABLE bookings ADD CONSTRAINT bookings_crypto_or_archive CHECK (
  (payment_method='skill' AND archived_at IS NULL) OR (payment_method='ytc' AND archived_at IS NOT NULL)
);
DROP INDEX idx_bookings_one_active_class;
DROP INDEX idx_bookings_student_slot;
DROP INDEX idx_bookings_teacher_slot;
CREATE UNIQUE INDEX idx_bookings_one_active_class ON bookings(class_id)
  WHERE archived_at IS NULL AND status IN ('confirmed','disputed','completed');
CREATE UNIQUE INDEX idx_bookings_student_slot ON bookings(student_id,scheduled_date,slot_type)
  WHERE archived_at IS NULL AND status IN ('confirmed','disputed','completed');
CREATE UNIQUE INDEX idx_bookings_teacher_slot ON bookings(teacher_id,scheduled_date,slot_type)
  WHERE archived_at IS NULL AND status IN ('confirmed','disputed','completed');
CREATE OR REPLACE FUNCTION sync_class_booking_state() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target BIGINT;
BEGIN
  IF TG_OP='DELETE' THEN target:=OLD.class_id; ELSE target:=NEW.class_id; END IF;
  UPDATE classes c SET is_booked=(
    EXISTS(SELECT 1 FROM bookings b WHERE b.class_id=target AND b.archived_at IS NULL AND b.status IN ('confirmed','disputed','completed')) OR
    EXISTS(SELECT 1 FROM chain_payments p WHERE p.class_id=target AND p.status IN ('quoted','funded','disputed','released'))
  ) WHERE c.class_id=target;
  IF TG_OP='UPDATE' AND OLD.class_id<>NEW.class_id THEN
    UPDATE classes c SET is_booked=(
      EXISTS(SELECT 1 FROM bookings b WHERE b.class_id=OLD.class_id AND b.archived_at IS NULL AND b.status IN ('confirmed','disputed','completed')) OR
      EXISTS(SELECT 1 FROM chain_payments p WHERE p.class_id=OLD.class_id AND p.status IN ('quoted','funded','disputed','released'))
    ) WHERE c.class_id=OLD.class_id;
  END IF;
  RETURN NULL;
END $$;
UPDATE classes c SET is_booked=(
  EXISTS(SELECT 1 FROM bookings b WHERE b.class_id=c.class_id AND b.archived_at IS NULL AND b.status IN ('confirmed','disputed','completed')) OR
  EXISTS(SELECT 1 FROM chain_payments p WHERE p.class_id=c.class_id AND p.status IN ('quoted','funded','disputed','released'))
);

-- Transaction amounts and receipts are backups, never account balances.
CREATE TABLE chain_transaction_records (
  chain_id BIGINT NOT NULL,
  tx_hash TEXT NOT NULL CHECK (tx_hash ~ '^0x[0-9a-f]{64}$'),
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  block_time TIMESTAMPTZ NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT,
  contract_address TEXT,
  token_address TEXT NOT NULL,
  action TEXT NOT NULL,
  payment_id TEXT REFERENCES chain_payments(payment_id),
  status SMALLINT NOT NULL CHECK (status IN (0,1)),
  native_value_wei NUMERIC(78,0) NOT NULL,
  gas_used NUMERIC(78,0) NOT NULL,
  gas_price_wei NUMERIC(78,0) NOT NULL,
  fee_wei NUMERIC(78,0) NOT NULL,
  token_transfers JSONB NOT NULL,
  approvals JSONB NOT NULL,
  receipt_json JSONB NOT NULL,
  transaction_json JSONB NOT NULL,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id,tx_hash)
);
CREATE INDEX chain_transaction_payment ON chain_transaction_records(payment_id,block_number);
CREATE INDEX chain_transaction_sender ON chain_transaction_records(chain_id,from_address,block_number DESC);
CREATE TABLE chain_history_cursors (
  chain_id BIGINT NOT NULL,
  token_address TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  PRIMARY KEY (chain_id,token_address,wallet_address)
);
