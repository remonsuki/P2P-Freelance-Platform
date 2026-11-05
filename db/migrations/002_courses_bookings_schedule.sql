-- Separate course content from scheduled sessions, preserving all existing IDs/history.
CREATE TABLE courses (
    course_id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    skill_id BIGINT NOT NULL REFERENCES skills(skill_id) ON DELETE RESTRICT,
    title VARCHAR(200) NOT NULL CHECK (LENGTH(BTRIM(title)) > 0),
    price NUMERIC(20,6) NOT NULL CHECK (price > 0 AND price <> 'NaN'::numeric),
    description TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, teacher_id, skill_id)
);

DO $$ BEGIN
  ALTER TABLE users ADD COLUMN schedule_configured BOOLEAN NOT NULL DEFAULT FALSE;
  UPDATE users SET schedule_configured=TRUE WHERE EXISTS (SELECT 1 FROM classes c WHERE c.teacher_id=users.user_id);
  IF EXISTS (SELECT 1 FROM classes c JOIN users u ON u.user_id=c.teacher_id
      GROUP BY c.teacher_id,c.skill_id HAVING COUNT(DISTINCT COALESCE(c.price,u.hourly_points)) > 1) THEN
    RAISE EXCEPTION '同一老師技能存在不同時段定價，請先拆分課程後再遷移';
  END IF;
END $$;

INSERT INTO courses (teacher_id,skill_id,title,price,description)
SELECT DISTINCT ON (c.teacher_id,c.skill_id) c.teacher_id,c.skill_id,s.name,
       COALESCE(c.price,u.hourly_points),COALESCE(c.description,'')
FROM classes c JOIN users u ON u.user_id=c.teacher_id JOIN skills s ON s.skill_id=c.skill_id
ORDER BY c.teacher_id,c.skill_id,c.class_id DESC;

ALTER TABLE classes ADD COLUMN course_id BIGINT;
UPDATE classes c SET course_id=o.course_id FROM courses o
WHERE o.teacher_id=c.teacher_id AND o.skill_id=c.skill_id;
ALTER TABLE classes ALTER COLUMN course_id SET NOT NULL;
ALTER TABLE classes ADD CONSTRAINT classes_course_owner_fk
  FOREIGN KEY (course_id,teacher_id,skill_id) REFERENCES courses(course_id,teacher_id,skill_id) ON DELETE RESTRICT;
ALTER TABLE classes ADD CONSTRAINT classes_time_order CHECK (start_time < end_time);
ALTER TABLE classes ADD CONSTRAINT classes_slot_values CHECK (slot_type IN ('morning','afternoon','evening'));
ALTER TABLE classes ADD CONSTRAINT classes_positive_price CHECK (price IS NULL OR (price > 0 AND price <> 'NaN'::numeric));
ALTER TABLE classes ADD CONSTRAINT classes_id_teacher_unique UNIQUE (class_id,teacher_id);
ALTER TABLE classes ADD CONSTRAINT classes_course_slot_unique UNIQUE (course_id,class_date,slot_type);
CREATE INDEX idx_classes_course_date ON classes(course_id,class_date);
CREATE INDEX idx_courses_teacher ON courses(teacher_id);

CREATE TABLE teacher_availability (
    teacher_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    available_date DATE NOT NULL,
    slot_type VARCHAR(20) NOT NULL CHECK (slot_type IN ('morning','afternoon','evening')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL CHECK (end_time > start_time),
    PRIMARY KEY (teacher_id,available_date,slot_type)
);
INSERT INTO teacher_availability
SELECT DISTINCT ON (teacher_id,class_date,slot_type) teacher_id,class_date,slot_type,start_time,end_time
FROM classes ORDER BY teacher_id,class_date,slot_type,class_id;

ALTER TABLE bookings ADD COLUMN course_title TEXT;
ALTER TABLE bookings ADD COLUMN teacher_id BIGINT;
ALTER TABLE bookings ADD COLUMN teacher_name TEXT;
ALTER TABLE bookings ADD COLUMN student_name TEXT;
ALTER TABLE bookings ADD COLUMN scheduled_date DATE;
ALTER TABLE bookings ADD COLUMN slot_type VARCHAR(20);
-- Legacy creation times were not recorded. Keep them unknown rather than inventing a date.
ALTER TABLE bookings ADD COLUMN created_at TIMESTAMPTZ;
ALTER TABLE bookings ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE bookings ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE bookings ADD COLUMN completed_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN refunded_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN dispute_reason TEXT;
UPDATE bookings b SET teacher_id=c.teacher_id,course_title=o.title,teacher_name=t.username,student_name=s.username,
  scheduled_date=c.class_date,slot_type=c.slot_type
FROM classes c JOIN courses o ON o.course_id=c.course_id
JOIN users t ON t.user_id=c.teacher_id JOIN users s ON TRUE
WHERE c.class_id=b.class_id AND s.user_id=b.student_id;
ALTER TABLE bookings ALTER COLUMN course_title SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN teacher_id SET NOT NULL;
ALTER TABLE bookings ADD CONSTRAINT bookings_class_teacher_fk
  FOREIGN KEY (class_id,teacher_id) REFERENCES classes(class_id,teacher_id) ON DELETE RESTRICT;
ALTER TABLE bookings ADD CONSTRAINT bookings_not_self CHECK (student_id <> teacher_id);
ALTER TABLE bookings ALTER COLUMN teacher_name SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN student_name SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN scheduled_date SET NOT NULL;
ALTER TABLE bookings ALTER COLUMN slot_type SET NOT NULL;
ALTER TABLE bookings ADD CONSTRAINT bookings_positive_amount CHECK (points_spent > 0 AND points_spent <> 'NaN'::numeric);
ALTER TABLE bookings ADD CONSTRAINT bookings_state_pair CHECK (
  (status IN ('confirmed','disputed') AND payment_status='escrowed') OR
  (status='completed' AND payment_status='released') OR
  (status='cancelled' AND payment_status='refunded')
);
CREATE UNIQUE INDEX idx_bookings_one_active_class ON bookings(class_id)
  WHERE status IN ('confirmed','disputed','completed');
CREATE UNIQUE INDEX idx_bookings_student_slot ON bookings(student_id,scheduled_date,slot_type)
  WHERE status IN ('confirmed','disputed','completed');
CREATE UNIQUE INDEX idx_bookings_teacher_slot ON bookings(teacher_id,scheduled_date,slot_type)
  WHERE status IN ('confirmed','disputed','completed');
CREATE INDEX idx_bookings_updated ON bookings(updated_at DESC);
CREATE INDEX idx_bookings_teacher_created ON bookings(teacher_id,created_at DESC);
CREATE INDEX idx_bookings_student_created ON bookings(student_id,created_at DESC);

-- is_booked is maintained by the database, including cancellation/refund transitions.
UPDATE classes c SET is_booked=EXISTS (SELECT 1 FROM bookings b WHERE b.class_id=c.class_id
  AND b.status IN ('confirmed','disputed','completed'));
CREATE UNIQUE INDEX idx_classes_teacher_reserved_slot ON classes(teacher_id,class_date,slot_type) WHERE is_booked;
CREATE FUNCTION sync_class_booking_state() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target BIGINT;
BEGIN
  IF TG_OP='DELETE' THEN target:=OLD.class_id; ELSE target:=NEW.class_id; END IF;
  UPDATE classes c SET is_booked=EXISTS (SELECT 1 FROM bookings b WHERE b.class_id=target
    AND b.status IN ('confirmed','disputed','completed')) WHERE c.class_id=target;
  IF TG_OP='UPDATE' AND OLD.class_id<>NEW.class_id THEN
    UPDATE classes c SET is_booked=EXISTS (SELECT 1 FROM bookings b WHERE b.class_id=OLD.class_id
      AND b.status IN ('confirmed','disputed','completed')) WHERE c.class_id=OLD.class_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER bookings_sync_class AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW EXECUTE FUNCTION sync_class_booking_state();

ALTER TABLE point_transactions ADD COLUMN booking_id BIGINT REFERENCES bookings(booking_id) ON DELETE RESTRICT;
ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_nonzero CHECK (amount<>0 AND amount<>'NaN'::numeric);
ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_amount_sign CHECK (
  (transaction_type IN ('consume','withdraw') AND amount<0) OR
  (transaction_type IN ('charge','refund','release') AND amount>0) OR transaction_type='adjustment');
ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_type CHECK (transaction_type IN ('charge','consume','refund','withdraw','release','adjustment'));
ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_status CHECK (tx_status IN ('pending','success','failed'));
CREATE INDEX idx_point_transactions_user_created ON point_transactions(user_id,created_at DESC,transaction_id DESC);
CREATE UNIQUE INDEX idx_point_transactions_booking_type ON point_transactions(booking_id,transaction_type)
  WHERE booking_id IS NOT NULL;
ALTER TABLE point_transactions DROP CONSTRAINT point_transactions_user_id_fkey;
ALTER TABLE point_transactions ADD CONSTRAINT point_transactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT;

ALTER TABLE reviews ADD CONSTRAINT reviews_direction CHECK (reviewer_role IN ('student_to_teacher','teacher_to_student'));
ALTER TABLE reviews ADD CONSTRAINT reviews_different_users CHECK (sender_id<>receiver_id);
ALTER TABLE reviews ADD CONSTRAINT reviews_one_per_sender UNIQUE (booking_id,sender_id);
ALTER TABLE users ADD CONSTRAINT users_nonnegative_balance CHECK (cached_points>=0 AND cached_points<>'NaN'::numeric);
ALTER TABLE users ADD CONSTRAINT users_role_values CHECK (role IN ('student','teacher'));
ALTER TABLE users ADD CONSTRAINT users_rating_range CHECK (student_rating BETWEEN 1 AND 5 AND teacher_rating BETWEEN 1 AND 5);
ALTER TABLE entity_skills ADD CONSTRAINT entity_skills_owner_type CHECK (owner_type='user');
ALTER TABLE entity_skills ADD CONSTRAINT entity_skills_unique UNIQUE (owner_id,skill_id);
