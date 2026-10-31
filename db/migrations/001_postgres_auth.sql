-- Additive migration: existing users, courses, bookings and transactions are retained.
-- Stop atomically if legacy accounts collide after email/address normalization.
UPDATE users SET email = LOWER(BTRIM(email)), wallet_address = LOWER(wallet_address);
CREATE UNIQUE INDEX idx_users_email_lower ON users(LOWER(email));
CREATE UNIQUE INDEX idx_users_wallet_lower ON users(LOWER(wallet_address));

CREATE TABLE user_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

ALTER TABLE users ADD COLUMN department TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ALTER COLUMN hourly_points TYPE NUMERIC(20, 6);
ALTER TABLE users ALTER COLUMN cached_points TYPE NUMERIC(20, 6);
ALTER TABLE point_transactions ALTER COLUMN amount TYPE NUMERIC(20, 6);
ALTER TABLE bookings ALTER COLUMN points_spent TYPE NUMERIC(20, 6);
ALTER TABLE bookings ADD COLUMN tx_hash VARCHAR(66);

-- Prices belong to individual offerings. Editing one teacher cannot change another.
ALTER TABLE classes ADD COLUMN price NUMERIC(20, 6);
ALTER TABLE classes ADD COLUMN description TEXT;
UPDATE classes c SET price = u.hourly_points FROM users u WHERE c.teacher_id = u.user_id;
