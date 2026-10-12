-- YunBarter 測試資料（第 3 步）
-- 內容與 server.js 開頭的假資料相同，可以重複執行：每次都會先清空再重新放入

-- 0. 清空所有資料表，並把自動編號 (BIGSERIAL) 歸零，讓 id 從 1 開始
TRUNCATE users, skills, point_transactions, entity_skills, classes, bookings, reviews
  RESTART IDENTITY CASCADE;

-- 1. 使用者（user_id 會依序變成 1、2、3）
--    ⚠️ 密碼暫時是明碼 123456，第 5 步改登入時會換成加密後的版本
INSERT INTO users (email, password_hash, username, role, category, hourly_points, teacher_rating, wallet_address, cached_points) VALUES
  ('test@email.com',  '123456', '大帥哥', 'student', NULL,   NULL, 5.0, NULL,                                         94),
  ('axian@email.com', '123456', '阿弦',   'teacher', '音樂', 2,    4.8, '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0', 50),
  ('link@email.com',  '123456', '林克',   'teacher', '程式', 4,    4.9, '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199', 80);

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
INSERT INTO classes (teacher_id, skill_id, class_date, slot_type, start_time, end_time, is_booked) VALUES
  (2, 1, '2026-06-20', 'morning',   '09:00', '10:00', TRUE),
  (2, 1, '2026-06-21', 'afternoon', '14:00', '15:00', FALSE),
  (3, 2, '2026-06-25', 'morning',   '09:00', '10:00', TRUE),
  (3, 2, '2026-06-26', 'afternoon', '14:00', '15:00', FALSE);

-- 5. 預約紀錄：大帥哥(1) 預約了 class 1 和 class 3
INSERT INTO bookings (student_id, class_id, points_spent, status, payment_status) VALUES
  (1, 1, 2, 'confirmed', 'escrowed'),
  (1, 3, 4, 'confirmed', 'escrowed');

-- 6. 大帥哥的點數流水帳：儲值 100，上課花掉 2 + 4，剩 94
INSERT INTO point_transactions (user_id, amount, transaction_type, description, created_at, tx_status) VALUES
  (1, 100, 'charge',  '初始儲值',                '2026-06-01 10:00:00+00', 'success'),
  (1,  -2, 'consume', '阿弦老師 - 吉他指彈教學', '2026-06-05 14:30:00+00', 'success'),
  (1,  -4, 'consume', '林克老師 - 網頁開發實戰', '2026-06-08 09:00:00+00', 'success');
