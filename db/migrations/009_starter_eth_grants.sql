CREATE TABLE starter_eth_grants (
    user_id BIGINT PRIMARY KEY REFERENCES starter_skill_grants(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signed_transaction TEXT,
    transaction_hash TEXT UNIQUE CHECK (transaction_hash ~ '^0x[0-9a-f]{64}$'),
    confirmed_at TIMESTAMPTZ,
    CONSTRAINT starter_eth_grants_signed_pair CHECK (
        (signed_transaction IS NULL) = (transaction_hash IS NULL)
    ),
    CONSTRAINT starter_eth_grants_confirmation CHECK (
        confirmed_at IS NULL OR transaction_hash IS NOT NULL
    )
);

CREATE INDEX starter_eth_grants_pending ON starter_eth_grants(user_id)
    WHERE confirmed_at IS NULL;
