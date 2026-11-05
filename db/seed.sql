-- YunBarter 開發測試資料；請透過 npm run db:seed 匯入空白資料庫。
-- 不會清空既有資料。禁止用於正式環境。

-- 1. 使用者（user_id 會依序變成 1、2、3）
--    以下是已加鹽的 scrypt 雜湊；測試帳號密碼皆為 123456。
INSERT INTO users (email, password_hash, username, role, category, hourly_points, teacher_rating, wallet_address, cached_points) VALUES
  ('test@email.com',  'scrypt$131072$8$1$04ce8152383f3bb69371af14b1d4078c$7372d666738f6262654e9220c686a670aa2a121dde49d950614c1504da6cfe97c59dd21d895a0fc2941c79730efb5fbe935d7ca0e9592a4ccbc30d60051648fa', '大帥哥', 'student', NULL, NULL, 5.0, NULL, 94),
  ('axian@email.com', 'scrypt$131072$8$1$08e3009ec6b9210d34acb2c33423ee12$8c18aa83f9cab2811fa6791b950244708b5989c09587dffe472da583b0855aa47787a8d01470ee5240be5ba1b9903b10cc6170a2698cea101202de9e3c5fbc87', '阿弦', 'teacher', '音樂', 2, 4.8, '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0', 50),
  ('link@email.com',  'scrypt$131072$8$1$a8ba1bd55b922a0c22115d537ef5010d$b07d605e7c72ba8932251813299ab04bebef36c44b45218ae71b7704ffea1342806b8b1f706d5be39d106c9a4ca44a51435cb29d42cb75b71314572efcfc1394', '林克', 'teacher', '程式', 4, 4.9, '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', 80);

-- 2. 技能科目（skill_id 1、2、3）
INSERT INTO skills (category, name) VALUES
  ('音樂', '吉他指彈教學'),
  ('程式', '網頁開發實戰'),
  ('程式', 'Java 基礎入門');

-- 3. 誰會哪些技能：阿弦(2) 會吉他(1)；林克(3) 會網頁(2)、Java(3)
INSERT INTO entity_skills (owner_type, owner_id, skill_id, skill_level) VALUES
  ('user', 2, 1, '高級'),
  ('user', 3, 2, '高級'),
  ('user', 3, 3, '中級');

-- 4. 課程時段（class_id 1~4），is_booked = TRUE 代表已被預約
INSERT INTO courses (teacher_id,skill_id,title,price,description) VALUES
  (2,1,'吉他指彈教學',2,'從基礎和弦到指彈技巧。'),
  (3,2,'網頁開發實戰',4,'以實作學習網頁開發。');
INSERT INTO classes (teacher_id, skill_id, class_date, slot_type, start_time, end_time, is_booked, price, course_id) VALUES
  (2, 1, CURRENT_DATE + 7, 'morning',   '09:00', '10:00', FALSE, 2, 1),
  (2, 1, CURRENT_DATE + 8, 'afternoon', '14:00', '15:00', FALSE, 2, 1),
  (3, 2, CURRENT_DATE + 9, 'morning',   '09:00', '10:00', FALSE, 4, 2),
  (3, 2, CURRENT_DATE + 10, 'afternoon', '14:00', '15:00', FALSE, 4, 2);
INSERT INTO teacher_availability
SELECT DISTINCT teacher_id,class_date,slot_type,start_time,end_time FROM classes;
UPDATE users SET schedule_configured=TRUE WHERE EXISTS (SELECT 1 FROM teacher_availability a WHERE a.teacher_id=users.user_id);

-- 5. 預約紀錄：大帥哥(1) 預約了 class 1 和 class 3
INSERT INTO bookings (student_id,class_id,points_spent,course_title,teacher_name,student_name,scheduled_date,slot_type,teacher_id)
SELECT 1,c.class_id,c.price,o.title,u.username,'大帥哥',c.class_date,c.slot_type,c.teacher_id
FROM classes c JOIN courses o ON o.course_id=c.course_id JOIN users u ON u.user_id=c.teacher_id
WHERE c.class_id IN (1,3);

-- 6. 大帥哥的點數流水帳：儲值 100，上課花掉 2 + 4，剩 94
INSERT INTO point_transactions (user_id, amount, transaction_type, description, created_at, tx_status) VALUES
  (1, 100, 'charge',  '初始儲值',                '2026-06-01 10:00:00+00', 'success'),
  (1,  -2, 'consume', '阿弦老師 - 吉他指彈教學', '2026-06-05 14:30:00+00', 'success'),
  (1,  -4, 'consume', '林克老師 - 網頁開發實戰', '2026-06-08 09:00:00+00', 'success');
