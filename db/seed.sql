-- YunBarter 開發測試資料，請透過 npm run db:seed 匯入空白開發資料庫。
-- 範例帳號的密碼皆為 123456，以下儲存的是各自加鹽的 scrypt 雜湊。
WITH seed_users AS (
  INSERT INTO users (email, password_hash, username, role, category, hourly_points, schedule_configured) VALUES
    ('test@email.com',  'scrypt$131072$8$1$04ce8152383f3bb69371af14b1d4078c$7372d666738f6262654e9220c686a670aa2a121dde49d950614c1504da6cfe97c59dd21d895a0fc2941c79730efb5fbe935d7ca0e9592a4ccbc30d60051648fa', '大帥哥', 'student', NULL, NULL, FALSE),
    ('axian@email.com', 'scrypt$131072$8$1$08e3009ec6b9210d34acb2c33423ee12$8c18aa83f9cab2811fa6791b950244708b5989c09587dffe472da583b0855aa47787a8d01470ee5240be5ba1b9903b10cc6170a2698cea101202de9e3c5fbc87', '阿弦', 'teacher', '音樂', 2, TRUE),
    ('link@email.com',  'scrypt$131072$8$1$a8ba1bd55b922a0c22115d537ef5010d$b07d605e7c72ba8932251813299ab04bebef36c44b45218ae71b7704ffea1342806b8b1f706d5be39d106c9a4ca44a51435cb29d42cb75b71314572efcfc1394', '林克', 'teacher', '程式', 4, TRUE)
  RETURNING user_id, email
), seed_skills AS (
  INSERT INTO skills (category, name) VALUES
    ('音樂', '吉他指彈教學'),
    ('程式', '網頁開發實戰'),
    ('程式', 'Java 基礎入門')
  RETURNING skill_id, name
), seed_entity_skills AS (
  INSERT INTO entity_skills (owner_id, skill_id, skill_level)
  SELECT u.user_id, s.skill_id, sample.skill_level
  FROM (VALUES
    ('axian@email.com', '吉他指彈教學', '高級'),
    ('link@email.com', '網頁開發實戰', '高級'),
    ('link@email.com', 'Java 基礎入門', '中級')
  ) AS sample(email, skill_name, skill_level)
  JOIN seed_users u ON u.email = sample.email
  JOIN seed_skills s ON s.name = sample.skill_name
), seed_courses AS (
  INSERT INTO courses (teacher_id, skill_id, title, price, description)
  SELECT u.user_id, s.skill_id, s.name, sample.price, sample.description
  FROM (VALUES
    ('axian@email.com', '吉他指彈教學', 2, '從基礎和弦到指彈技巧。'),
    ('link@email.com', '網頁開發實戰', 4, '以實作學習網頁開發。')
  ) AS sample(email, skill_name, price, description)
  JOIN seed_users u ON u.email = sample.email
  JOIN seed_skills s ON s.name = sample.skill_name
  RETURNING course_id, teacher_id, skill_id, title, price
), seed_classes AS (
  INSERT INTO classes (teacher_id, skill_id, class_date, slot_type, start_time, end_time, price, course_id)
  SELECT c.teacher_id, c.skill_id, CURRENT_DATE + sample.day_offset, sample.slot_type,
    sample.start_time, sample.end_time, c.price, c.course_id
  FROM (VALUES
    ('吉他指彈教學', 7, 'morning', TIME '09:00', TIME '10:00'),
    ('吉他指彈教學', 8, 'afternoon', TIME '14:00', TIME '15:00'),
    ('網頁開發實戰', 9, 'morning', TIME '09:00', TIME '10:00'),
    ('網頁開發實戰', 10, 'afternoon', TIME '14:00', TIME '15:00')
  ) AS sample(course_title, day_offset, slot_type, start_time, end_time)
  JOIN seed_courses c ON c.title = sample.course_title
  RETURNING teacher_id, class_date, slot_type, start_time, end_time
)
INSERT INTO teacher_availability (teacher_id, available_date, slot_type, start_time, end_time)
SELECT teacher_id, class_date, slot_type, start_time, end_time FROM seed_classes;

-- 範例資料不建立模擬帳務或餘額。
