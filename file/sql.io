Table users {
  user_id bigserial [primary key] // 使用者 ID (流水號)
  email varchar(255) [unique, not null] // 登入帳號
  password_hash text [not null] // 加密後的密碼
  username varchar(100) [not null] // 姓名 / 暱稱
  avatar_url text // 大頭貼圖片網址
  role varchar(20) [default: 'student'] // 身分分類 ('student'學生, 'teacher'老師)
  category varchar(50) // 老師大分類 (語言/軟體/技能)
  hourly_points int // 老師定價 (一堂課要多少鏈上代幣)
  
  // 🎯 雙向信譽積分 (由後端動態計算 reviews 平均值)
  student_rating numeric(3,2) [default: 5.0] // 學生信譽分數 (1.0~5.0)
  teacher_rating numeric(3,2) [default: 5.0] // 老師信譽分數 (1.0~5.0)
  
  // 🎯 區塊鏈錢包
  wallet_address varchar(42) [unique] // 使用者的區塊鏈錢包地址
  cached_points int [default: 0] // 鏈上點數餘額快取
}

Table point_transactions {
  transaction_id bigserial [primary key] // 流水帳 ID
  user_id bigint [not null] // 哪個會員的交易
  amount int [not null] // 點數變動 (儲值/退款為正，扣點為負)
  transaction_type varchar(50) [not null] // 交易類型 (charge/consume/refund)
  description text // 消費說明 (例如: "課程取消退款")
  created_at timestamptz [default: `now()`] // 交易時間
  tx_hash varchar(66) [unique] // 區塊鏈上的交易雜湊 (退款也會有一串 Hash 鐵證)
  tx_status varchar(20) [default: 'pending'] // 交易狀態 (pending/success/failed)
}

Table skills {
  skill_id bigserial [primary key] // 技能 ID
  category varchar(50) [not null] // 分類 (如：軟體學習)
  name varchar(100) [not null] // 具體科目 (如：Java)
}

Table entity_skills {
  entity_skill_id bigserial [primary key] // 關聯 ID
  owner_type varchar(20) [not null] // 身分類型 (統一用 'user')
  owner_id bigint [not null] // 對應 users.user_id
  skill_id bigint [not null] // 綁定的技能 ID
  skill_level varchar(50) // 熟練度等級 (初級/中級/高級)
}

Table classes {
  class_id bigserial [primary key] // 課程時段 ID
  teacher_id bigint [not null] // 授課教師的 ID
  skill_id bigint [not null] // 這堂課教的科目 ID
  class_date date [not null] // 上課日期 (YYYY-MM-DD)
  slot_type varchar(20) [not null] // 時段標籤 (morning/afternoon/evening)
  start_time time [not null] // 開始時間
  end_time time [not null] // 結束時間
  is_booked boolean [default: false] // 是否被預約
}

Table bookings {
  booking_id bigserial [primary key] // 預約紀錄 ID
  student_id bigint [not null] // 預約的學生 ID
  class_id bigint [not null] // 鎖定的課程時段 ID
  points_spent int [not null] // 當下扣除的代幣數量
  status varchar(50) [default: 'confirmed'] // 預約狀態 (confirmed:已預約/cancelled:已取消)
  
  // 🎯 鏈上退款/託管狀態控制
  payment_status varchar(20) [default: 'escrowed', note: '代幣狀態: escrowed(合約託管中), released(已撥款給老師), refunded(已退款給學生)']
}

// 🎯 升級：雙向用戶信譽評價表
Table reviews {
  review_id bigserial [primary key] // 評價 ID
  booking_id bigint [not null] // 綁定特定的預約紀錄
  sender_id bigint [not null] // 留評價的人 (可能是學生，也可能是老師)
  receiver_id bigint [not null] // 被評價的人 (接收信用積分的人)
  reviewer_role varchar(20) [not null] // 評價方向：'student_to_teacher' 或 'teacher_to_student'
  rating_stars int [not null] // 信用評分星數 (1~5星)
  comment text // 評語文字
  created_at timestamptz [default: `now()`] // 評價時間
}

// ---- 精簡線條關聯 ----

Ref: point_transactions.user_id > users.user_id

Ref: entity_skills.skill_id > skills.skill_id
Ref: entity_skills.owner_id > users.user_id

Ref: classes.teacher_id > users.user_id
Ref: classes.skill_id > skills.skill_id

Ref: bookings.student_id > users.user_id
Ref: bookings.class_id > classes.class_id

Ref: reviews.booking_id > bookings.booking_id
Ref: reviews.sender_id > users.user_id
Ref: reviews.receiver_id > users.user_id