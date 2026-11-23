-- The composite foreign key still enforces the booking's class and teacher.
ALTER TABLE bookings DROP CONSTRAINT bookings_class_id_fkey;

-- owner_id already refers to users and owner_type was constrained to 'user'.
ALTER TABLE entity_skills DROP COLUMN owner_type;

-- Authentication uses the verified wallet. Public ratings come from reviews.
ALTER TABLE users
  DROP COLUMN wallet_address,
  DROP COLUMN student_rating,
  DROP COLUMN teacher_rating;
