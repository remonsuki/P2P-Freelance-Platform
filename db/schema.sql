-- YunBarter PostgreSQL 目前結構，包含 001 至 007 遷移。
-- 可直接匯入空白 schema。既有資料庫請執行 npm run db:migrate。
-- 快照只包含結構與遷移版本紀錄。

CREATE FUNCTION enforce_permanent_wallet_binding() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.verified_wallet_address IS NOT NULL AND NEW.verified_wallet_address IS DISTINCT FROM OLD.verified_wallet_address THEN
    RAISE EXCEPTION 'Wallet binding is immutable'
      USING ERRCODE='23514', CONSTRAINT='users_wallet_binding_immutable';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION sync_class_booking_state() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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

CREATE TABLE bookings (
    booking_id bigint NOT NULL,
    student_id bigint NOT NULL,
    class_id bigint NOT NULL,
    points_spent numeric(20,6) NOT NULL,
    status character varying(50) DEFAULT 'confirmed'::character varying NOT NULL,
    payment_status character varying(20) DEFAULT 'escrowed'::character varying NOT NULL,
    tx_hash character varying(66),
    course_title text NOT NULL,
    teacher_id bigint NOT NULL,
    teacher_name text NOT NULL,
    student_name text NOT NULL,
    scheduled_date date NOT NULL,
    slot_type character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    refunded_at timestamp with time zone,
    dispute_reason text,
    payment_method text DEFAULT 'skill'::text NOT NULL,
    chain_payment_id text,
    archived_at timestamp with time zone,
    CONSTRAINT bookings_crypto_or_archive CHECK ((((payment_method = 'skill'::text) AND (archived_at IS NULL)) OR ((payment_method = 'ytc'::text) AND (archived_at IS NOT NULL)))),
    CONSTRAINT bookings_not_self CHECK ((student_id <> teacher_id)),
    CONSTRAINT bookings_payment_method_check CHECK ((payment_method = ANY (ARRAY['ytc'::text, 'skill'::text]))),
    CONSTRAINT bookings_payment_reference CHECK ((((payment_method = 'ytc'::text) AND (chain_payment_id IS NULL)) OR ((payment_method = 'skill'::text) AND (chain_payment_id IS NOT NULL)))),
    CONSTRAINT bookings_positive_amount CHECK (((points_spent > (0)::numeric) AND (points_spent <> 'NaN'::numeric))),
    CONSTRAINT bookings_slot_values CHECK (((slot_type)::text = ANY ((ARRAY['morning'::character varying, 'afternoon'::character varying, 'evening'::character varying])::text[]))),
    CONSTRAINT bookings_state_pair CHECK (((((status)::text = ANY ((ARRAY['confirmed'::character varying, 'disputed'::character varying])::text[])) AND ((payment_status)::text = 'escrowed'::text)) OR (((status)::text = 'completed'::text) AND ((payment_status)::text = 'released'::text)) OR (((status)::text = 'cancelled'::text) AND ((payment_status)::text = 'refunded'::text))))
);

CREATE SEQUENCE bookings_booking_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE bookings_booking_id_seq OWNED BY bookings.booking_id;

CREATE TABLE chain_history_cursors (
    chain_id bigint NOT NULL,
    token_address text NOT NULL,
    wallet_address text NOT NULL,
    block_number bigint NOT NULL
);

CREATE TABLE chain_payments (
    payment_id text NOT NULL,
    student_id bigint NOT NULL,
    teacher_id bigint NOT NULL,
    course_id bigint NOT NULL,
    class_id bigint NOT NULL,
    scheduled_date date NOT NULL,
    slot_type character varying(20) NOT NULL,
    course_title text NOT NULL,
    teacher_name text NOT NULL,
    student_name text NOT NULL,
    price numeric(18,6) NOT NULL,
    chain_id bigint NOT NULL,
    token_address text NOT NULL,
    escrow_address text NOT NULL,
    quote jsonb NOT NULL,
    signature text NOT NULL,
    created_block bigint NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    status text DEFAULT 'quoted'::text NOT NULL,
    last_tx_hash text,
    funded_tx_hash text,
    synced_block bigint DEFAULT 0 NOT NULL,
    dispute_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chain_payments_check CHECK ((student_id <> teacher_id)),
    CONSTRAINT chain_payments_payment_id_check CHECK ((payment_id ~ '^0x[0-9a-f]{64}$'::text)),
    CONSTRAINT chain_payments_price_check CHECK ((price > (0)::numeric)),
    CONSTRAINT chain_payments_status_check CHECK ((status = ANY (ARRAY['quoted'::text, 'funded'::text, 'disputed'::text, 'released'::text, 'refunded'::text, 'expired'::text])))
);

CREATE TABLE chain_transaction_records (
    chain_id bigint NOT NULL,
    tx_hash text NOT NULL,
    block_number bigint NOT NULL,
    block_hash text NOT NULL,
    block_time timestamp with time zone NOT NULL,
    from_address text NOT NULL,
    to_address text,
    contract_address text,
    token_address text NOT NULL,
    action text NOT NULL,
    payment_id text,
    status smallint NOT NULL,
    native_value_wei numeric(78,0) NOT NULL,
    gas_used numeric(78,0) NOT NULL,
    gas_price_wei numeric(78,0) NOT NULL,
    fee_wei numeric(78,0) NOT NULL,
    token_transfers jsonb NOT NULL,
    approvals jsonb NOT NULL,
    receipt_json jsonb NOT NULL,
    transaction_json jsonb NOT NULL,
    backed_up_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chain_transaction_records_status_check CHECK ((status = ANY (ARRAY[0, 1]))),
    CONSTRAINT chain_transaction_records_tx_hash_check CHECK ((tx_hash ~ '^0x[0-9a-f]{64}$'::text))
);

CREATE TABLE classes (
    class_id bigint NOT NULL,
    teacher_id bigint NOT NULL,
    skill_id bigint NOT NULL,
    class_date date NOT NULL,
    slot_type character varying(20) NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    is_booked boolean DEFAULT false NOT NULL,
    price numeric(20,6),
    description text,
    course_id bigint NOT NULL,
    CONSTRAINT classes_positive_price CHECK (((price IS NULL) OR ((price > (0)::numeric) AND (price <> 'NaN'::numeric)))),
    CONSTRAINT classes_slot_values CHECK (((slot_type)::text = ANY ((ARRAY['morning'::character varying, 'afternoon'::character varying, 'evening'::character varying])::text[]))),
    CONSTRAINT classes_time_order CHECK ((start_time < end_time))
);

CREATE SEQUENCE classes_class_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE classes_class_id_seq OWNED BY classes.class_id;

CREATE TABLE courses (
    course_id bigint NOT NULL,
    teacher_id bigint NOT NULL,
    skill_id bigint NOT NULL,
    title character varying(200) NOT NULL,
    price numeric(20,6) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT courses_price_check CHECK (((price > (0)::numeric) AND (price <> 'NaN'::numeric))),
    CONSTRAINT courses_title_check CHECK ((length(btrim((title)::text)) > 0))
);

CREATE SEQUENCE courses_course_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE courses_course_id_seq OWNED BY courses.course_id;

CREATE TABLE entity_skills (
    entity_skill_id bigint NOT NULL,
    owner_id bigint NOT NULL,
    skill_id bigint NOT NULL,
    skill_level character varying(50)
);

CREATE SEQUENCE entity_skills_entity_skill_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE entity_skills_entity_skill_id_seq OWNED BY entity_skills.entity_skill_id;

CREATE TABLE legacy_point_transactions (
    transaction_id bigint NOT NULL,
    user_id bigint NOT NULL,
    amount numeric(20,6) NOT NULL,
    transaction_type character varying(50) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tx_hash character varying(66),
    tx_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    booking_id bigint,
    CONSTRAINT point_transactions_amount_sign CHECK (((((transaction_type)::text = ANY ((ARRAY['consume'::character varying, 'withdraw'::character varying])::text[])) AND (amount < (0)::numeric)) OR (((transaction_type)::text = ANY ((ARRAY['charge'::character varying, 'refund'::character varying, 'release'::character varying])::text[])) AND (amount > (0)::numeric)) OR ((transaction_type)::text = 'adjustment'::text))),
    CONSTRAINT point_transactions_nonzero CHECK (((amount <> (0)::numeric) AND (amount <> 'NaN'::numeric))),
    CONSTRAINT point_transactions_status CHECK (((tx_status)::text = ANY ((ARRAY['pending'::character varying, 'success'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT point_transactions_type CHECK (((transaction_type)::text = ANY ((ARRAY['charge'::character varying, 'consume'::character varying, 'refund'::character varying, 'withdraw'::character varying, 'release'::character varying, 'adjustment'::character varying])::text[])))
);

CREATE SEQUENCE point_transactions_transaction_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE point_transactions_transaction_id_seq OWNED BY legacy_point_transactions.transaction_id;

CREATE TABLE registration_wallet_challenges (
    challenge_id text NOT NULL,
    browser_hash text NOT NULL,
    email text NOT NULL,
    wallet_address text NOT NULL,
    origin text NOT NULL,
    message text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT registration_wallet_challenges_challenge_id_check CHECK ((challenge_id ~ '^[0-9a-f]{64}$'::text)),
    CONSTRAINT registration_wallet_challenges_wallet_address_check CHECK ((wallet_address ~ '^0x[0-9a-f]{40}$'::text))
);

CREATE TABLE reviews (
    review_id bigint NOT NULL,
    booking_id bigint NOT NULL,
    sender_id bigint NOT NULL,
    receiver_id bigint NOT NULL,
    reviewer_role character varying(20) NOT NULL,
    rating_stars integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_different_users CHECK ((sender_id <> receiver_id)),
    CONSTRAINT reviews_direction CHECK (((reviewer_role)::text = ANY ((ARRAY['student_to_teacher'::character varying, 'teacher_to_student'::character varying])::text[]))),
    CONSTRAINT reviews_rating_stars_check CHECK (((rating_stars >= 1) AND (rating_stars <= 5)))
);

CREATE SEQUENCE reviews_review_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE reviews_review_id_seq OWNED BY reviews.review_id;

CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE skills (
    skill_id bigint NOT NULL,
    category character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    CONSTRAINT skills_nonempty CHECK (((length(btrim((name)::text)) > 0) AND (length(btrim((category)::text)) > 0)))
);

CREATE SEQUENCE skills_skill_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE skills_skill_id_seq OWNED BY skills.skill_id;

CREATE TABLE teacher_availability (
    teacher_id bigint NOT NULL,
    available_date date NOT NULL,
    slot_type character varying(20) NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    CONSTRAINT teacher_availability_check CHECK ((end_time > start_time)),
    CONSTRAINT teacher_availability_slot_type_check CHECK (((slot_type)::text = ANY ((ARRAY['morning'::character varying, 'afternoon'::character varying, 'evening'::character varying])::text[])))
);

CREATE TABLE user_sessions (
    token_hash character(64) NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);

CREATE TABLE users (
    user_id bigint NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    username character varying(100) NOT NULL,
    avatar_url text,
    role character varying(20) DEFAULT 'student'::character varying NOT NULL,
    category character varying(50),
    hourly_points numeric(20,6),
    department text,
    bio text,
    schedule_configured boolean DEFAULT false NOT NULL,
    verified_wallet_address text,
    CONSTRAINT users_nonempty_identity CHECK (((length(btrim((username)::text)) > 0) AND (length(btrim((email)::text)) > 0))),
    CONSTRAINT users_role_values CHECK (((role)::text = ANY ((ARRAY['student'::character varying, 'teacher'::character varying])::text[]))),
    CONSTRAINT users_verified_wallet_format CHECK (((verified_wallet_address IS NULL) OR (verified_wallet_address ~ '^0x[0-9a-f]{40}$'::text)))
);

CREATE SEQUENCE users_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE users_user_id_seq OWNED BY users.user_id;

CREATE TABLE wallet_challenges (
    user_id bigint NOT NULL,
    wallet_address text NOT NULL,
    session_hash text NOT NULL,
    message text NOT NULL,
    expires_at timestamp with time zone NOT NULL
);

ALTER TABLE ONLY bookings ALTER COLUMN booking_id SET DEFAULT nextval('bookings_booking_id_seq'::regclass);

ALTER TABLE ONLY classes ALTER COLUMN class_id SET DEFAULT nextval('classes_class_id_seq'::regclass);

ALTER TABLE ONLY courses ALTER COLUMN course_id SET DEFAULT nextval('courses_course_id_seq'::regclass);

ALTER TABLE ONLY entity_skills ALTER COLUMN entity_skill_id SET DEFAULT nextval('entity_skills_entity_skill_id_seq'::regclass);

ALTER TABLE ONLY legacy_point_transactions ALTER COLUMN transaction_id SET DEFAULT nextval('point_transactions_transaction_id_seq'::regclass);

ALTER TABLE ONLY reviews ALTER COLUMN review_id SET DEFAULT nextval('reviews_review_id_seq'::regclass);

ALTER TABLE ONLY skills ALTER COLUMN skill_id SET DEFAULT nextval('skills_skill_id_seq'::regclass);

ALTER TABLE ONLY users ALTER COLUMN user_id SET DEFAULT nextval('users_user_id_seq'::regclass);

ALTER TABLE ONLY bookings
    ADD CONSTRAINT bookings_chain_payment_id_key UNIQUE (chain_payment_id);

ALTER TABLE ONLY bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (booking_id);

ALTER TABLE ONLY chain_history_cursors
    ADD CONSTRAINT chain_history_cursors_pkey PRIMARY KEY (chain_id, token_address, wallet_address);

ALTER TABLE ONLY chain_payments
    ADD CONSTRAINT chain_payments_pkey PRIMARY KEY (payment_id);

ALTER TABLE ONLY chain_transaction_records
    ADD CONSTRAINT chain_transaction_records_pkey PRIMARY KEY (chain_id, tx_hash);

ALTER TABLE ONLY classes
    ADD CONSTRAINT classes_course_slot_unique UNIQUE (course_id, class_date, slot_type);

ALTER TABLE ONLY classes
    ADD CONSTRAINT classes_id_teacher_unique UNIQUE (class_id, teacher_id);

ALTER TABLE ONLY classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (class_id);

ALTER TABLE ONLY courses
    ADD CONSTRAINT courses_course_id_teacher_id_skill_id_key UNIQUE (course_id, teacher_id, skill_id);

ALTER TABLE ONLY courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (course_id);

ALTER TABLE ONLY entity_skills
    ADD CONSTRAINT entity_skills_pkey PRIMARY KEY (entity_skill_id);

ALTER TABLE ONLY entity_skills
    ADD CONSTRAINT entity_skills_unique UNIQUE (owner_id, skill_id);

ALTER TABLE ONLY legacy_point_transactions
    ADD CONSTRAINT point_transactions_pkey PRIMARY KEY (transaction_id);

ALTER TABLE ONLY legacy_point_transactions
    ADD CONSTRAINT point_transactions_tx_hash_key UNIQUE (tx_hash);

ALTER TABLE ONLY registration_wallet_challenges
    ADD CONSTRAINT registration_wallet_challenges_pkey PRIMARY KEY (challenge_id);

ALTER TABLE ONLY reviews
    ADD CONSTRAINT reviews_one_per_sender UNIQUE (booking_id, sender_id);

ALTER TABLE ONLY reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (review_id);

ALTER TABLE ONLY skills
    ADD CONSTRAINT skills_pkey PRIMARY KEY (skill_id);

ALTER TABLE ONLY teacher_availability
    ADD CONSTRAINT teacher_availability_pkey PRIMARY KEY (teacher_id, available_date, slot_type);

ALTER TABLE ONLY user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (token_hash);

ALTER TABLE ONLY users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY wallet_challenges
    ADD CONSTRAINT wallet_challenges_pkey PRIMARY KEY (user_id);

CREATE UNIQUE INDEX chain_student_slot ON chain_payments USING btree (student_id, scheduled_date, slot_type) WHERE (status = ANY (ARRAY['quoted'::text, 'funded'::text, 'disputed'::text, 'released'::text]));

CREATE UNIQUE INDEX chain_teacher_slot ON chain_payments USING btree (teacher_id, scheduled_date, slot_type) WHERE (status = ANY (ARRAY['quoted'::text, 'funded'::text, 'disputed'::text, 'released'::text]));

CREATE INDEX chain_transaction_payment ON chain_transaction_records USING btree (payment_id, block_number);

CREATE INDEX chain_transaction_sender ON chain_transaction_records USING btree (chain_id, from_address, block_number DESC);

CREATE INDEX idx_bookings_class_id ON bookings USING btree (class_id);

CREATE UNIQUE INDEX idx_bookings_one_active_class ON bookings USING btree (class_id) WHERE ((archived_at IS NULL) AND ((status)::text = ANY ((ARRAY['confirmed'::character varying, 'disputed'::character varying, 'completed'::character varying])::text[])));

CREATE INDEX idx_bookings_student_created ON bookings USING btree (student_id, created_at DESC);

CREATE INDEX idx_bookings_student_id ON bookings USING btree (student_id);

CREATE UNIQUE INDEX idx_bookings_student_slot ON bookings USING btree (student_id, scheduled_date, slot_type) WHERE ((archived_at IS NULL) AND ((status)::text = ANY ((ARRAY['confirmed'::character varying, 'disputed'::character varying, 'completed'::character varying])::text[])));

CREATE INDEX idx_bookings_teacher_created ON bookings USING btree (teacher_id, created_at DESC);

CREATE UNIQUE INDEX idx_bookings_teacher_slot ON bookings USING btree (teacher_id, scheduled_date, slot_type) WHERE ((archived_at IS NULL) AND ((status)::text = ANY ((ARRAY['confirmed'::character varying, 'disputed'::character varying, 'completed'::character varying])::text[])));

CREATE INDEX idx_bookings_updated ON bookings USING btree (updated_at DESC);

CREATE INDEX idx_classes_course_date ON classes USING btree (course_id, class_date);

CREATE INDEX idx_classes_teacher_date ON classes USING btree (teacher_id, class_date);

CREATE UNIQUE INDEX idx_classes_teacher_reserved_slot ON classes USING btree (teacher_id, class_date, slot_type) WHERE is_booked;

CREATE INDEX idx_courses_teacher ON courses USING btree (teacher_id);

CREATE UNIQUE INDEX idx_point_transactions_booking_type ON legacy_point_transactions USING btree (booking_id, transaction_type) WHERE (booking_id IS NOT NULL);

CREATE INDEX idx_point_transactions_user_created ON legacy_point_transactions USING btree (user_id, created_at DESC, transaction_id DESC);

CREATE INDEX idx_point_transactions_user_id ON legacy_point_transactions USING btree (user_id);

CREATE INDEX idx_reviews_booking_id ON reviews USING btree (booking_id);

CREATE INDEX idx_reviews_receiver_id ON reviews USING btree (receiver_id);

CREATE INDEX idx_user_sessions_expires_at ON user_sessions USING btree (expires_at);

CREATE INDEX idx_user_sessions_user_id ON user_sessions USING btree (user_id);

CREATE UNIQUE INDEX idx_users_email_lower ON users USING btree (lower((email)::text));

CREATE INDEX registration_wallet_challenges_expiry ON registration_wallet_challenges USING btree (expires_at);

CREATE UNIQUE INDEX users_verified_wallet_unique ON users USING btree (verified_wallet_address) WHERE (verified_wallet_address IS NOT NULL);

CREATE TRIGGER bookings_sync_class AFTER INSERT OR DELETE OR UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION sync_class_booking_state();

CREATE TRIGGER chain_payments_sync_class AFTER INSERT OR DELETE OR UPDATE ON chain_payments FOR EACH ROW EXECUTE FUNCTION sync_class_booking_state();

CREATE TRIGGER users_permanent_wallet_binding BEFORE UPDATE OF verified_wallet_address ON users FOR EACH ROW EXECUTE FUNCTION enforce_permanent_wallet_binding();

ALTER TABLE ONLY bookings
    ADD CONSTRAINT bookings_chain_payment_id_fkey FOREIGN KEY (chain_payment_id) REFERENCES chain_payments(payment_id);

ALTER TABLE ONLY bookings
    ADD CONSTRAINT bookings_class_teacher_fk FOREIGN KEY (class_id, teacher_id) REFERENCES classes(class_id, teacher_id) ON DELETE RESTRICT;

ALTER TABLE ONLY bookings
    ADD CONSTRAINT bookings_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE RESTRICT;

ALTER TABLE ONLY chain_payments
    ADD CONSTRAINT chain_payments_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(class_id);

ALTER TABLE ONLY chain_payments
    ADD CONSTRAINT chain_payments_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(course_id);

ALTER TABLE ONLY chain_payments
    ADD CONSTRAINT chain_payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(user_id);

ALTER TABLE ONLY chain_payments
    ADD CONSTRAINT chain_payments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(user_id);

ALTER TABLE ONLY chain_transaction_records
    ADD CONSTRAINT chain_transaction_records_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES chain_payments(payment_id);

ALTER TABLE ONLY classes
    ADD CONSTRAINT classes_course_owner_fk FOREIGN KEY (course_id, teacher_id, skill_id) REFERENCES courses(course_id, teacher_id, skill_id) ON DELETE RESTRICT;

ALTER TABLE ONLY classes
    ADD CONSTRAINT classes_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE RESTRICT;

ALTER TABLE ONLY classes
    ADD CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY courses
    ADD CONSTRAINT courses_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE RESTRICT;

ALTER TABLE ONLY courses
    ADD CONSTRAINT courses_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(user_id) ON DELETE RESTRICT;

ALTER TABLE ONLY entity_skills
    ADD CONSTRAINT entity_skills_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY entity_skills
    ADD CONSTRAINT entity_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE RESTRICT;

ALTER TABLE ONLY legacy_point_transactions
    ADD CONSTRAINT point_transactions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE RESTRICT;

ALTER TABLE ONLY legacy_point_transactions
    ADD CONSTRAINT point_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT;

ALTER TABLE ONLY reviews
    ADD CONSTRAINT reviews_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE;

ALTER TABLE ONLY reviews
    ADD CONSTRAINT reviews_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE RESTRICT;

ALTER TABLE ONLY reviews
    ADD CONSTRAINT reviews_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE RESTRICT;

ALTER TABLE ONLY teacher_availability
    ADD CONSTRAINT teacher_availability_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE ONLY wallet_challenges
    ADD CONSTRAINT wallet_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- 記錄已包含在此結構中的版本，後續遷移仍由遷移程式套用。
INSERT INTO schema_migrations (name) VALUES
    ('001_postgres_auth.sql'),
    ('002_courses_bookings_schedule.sql'),
    ('003_storage_required_fields.sql'),
    ('004_skill_escrow.sql'),
    ('005_registration_wallet_binding.sql'),
    ('006_chain_only_transactions.sql'),
    ('007_remove_redundant_structures.sql')
ON CONFLICT (name) DO NOTHING;
