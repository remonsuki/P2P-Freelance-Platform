-- 1. 使用者資料表 (users)
CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    username VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(20) DEFAULT 'student',
    category VARCHAR(50),
    hourly_points INT,
    student_rating NUMERIC(3, 2) DEFAULT 5.0,
    teacher_rating NUMERIC(3, 2) DEFAULT 5.0,
    wallet_address VARCHAR(42) UNIQUE,
    cached_points INT DEFAULT 0
);

-- 2. 技能清單 (skills)
CREATE TABLE skills (
    skill_id BIGSERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL
);

-- 3. 點數/鏈上交易紀錄 (point_transactions)
CREATE TABLE point_transactions (
    transaction_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount INT NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tx_hash VARCHAR(66) UNIQUE,
    tx_status VARCHAR(20) DEFAULT 'pending'
);

-- 4. 使用者技能關聯 (entity_skills)
CREATE TABLE entity_skills (
    entity_skill_id BIGSERIAL PRIMARY KEY,
    owner_type VARCHAR(20) NOT NULL,
    owner_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    skill_id BIGINT NOT NULL REFERENCES skills(skill_id) ON DELETE RESTRICT,
    skill_level VARCHAR(50)
);

-- 5. 課程時段 (classes)
CREATE TABLE classes (
    class_id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    skill_id BIGINT NOT NULL REFERENCES skills(skill_id) ON DELETE RESTRICT,
    class_date DATE NOT NULL,
    slot_type VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_booked BOOLEAN DEFAULT FALSE
);

-- 6. 預約紀錄 (bookings)
CREATE TABLE bookings (
    booking_id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    class_id BIGINT NOT NULL REFERENCES classes(class_id) ON DELETE RESTRICT,
    points_spent INT NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed',
    payment_status VARCHAR(20) DEFAULT 'escrowed'
);

-- 7. 雙向信用評價 (reviews)
CREATE TABLE reviews (
    review_id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    sender_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    receiver_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    reviewer_role VARCHAR(20) NOT NULL,
    rating_stars INT NOT NULL CHECK (rating_stars >= 1 AND rating_stars <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 常用查詢索引建立 (優化查詢效能)
CREATE INDEX idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX idx_classes_teacher_date ON classes(teacher_id, class_date);
CREATE INDEX idx_bookings_student_id ON bookings(student_id);
CREATE INDEX idx_bookings_class_id ON bookings(class_id);
CREATE INDEX idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX idx_reviews_receiver_id ON reviews(receiver_id);