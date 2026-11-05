const { transaction } = require('./db');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const SLOT = { Morning: ['morning','09:00','10:00'], Afternoon: ['afternoon','14:00','15:00'], Night: ['evening','19:00','20:00'] };
const LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Night' };
const ACTIVE = "('confirmed','disputed','completed')";

function text(value, name, max = 10000) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new HttpError(400, `${name}格式不正確`);
  return value.trim();
}
function id(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new HttpError(400,'編號不正確');
  return String(value);
}
function amount(value) {
  if (!/^[0-9]+(\.[0-9]{1,6})?$/.test(String(value)) || Number(value)<=0 || Number(value)>1e9) throw new HttpError(400,'價格必須大於零，最多六位小數');
  return String(value);
}
function slot(value) {
  const parts = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2})\|(Morning|Afternoon|Night)$/.exec(value);
  if (!parts || !Number.isFinite(Date.parse(parts[1])) || new Date(parts[1]).toISOString().slice(0,10)!==parts[1]) throw new HttpError(400,'授課日期或時段格式不正確');
  return { date: parts[1], type: SLOT[parts[2]][0], start: SLOT[parts[2]][1], end: SLOT[parts[2]][2], key: value };
}

async function courseCards(db, teacherId = null) {
  const { rows } = await db.query(`SELECT o.*,u.username,s.category,
    (SELECT AVG(r.rating_stars) FROM reviews r JOIN bookings b ON b.booking_id=r.booking_id JOIN classes c ON c.class_id=b.class_id
      WHERE c.course_id=o.course_id AND r.reviewer_role='student_to_teacher') AS rating,
    (SELECT COUNT(*)::int FROM reviews r JOIN bookings b ON b.booking_id=r.booking_id JOIN classes c ON c.class_id=b.class_id
      WHERE c.course_id=o.course_id AND r.reviewer_role='student_to_teacher') AS review_count,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.class_id,'date',c.class_date::text,'slot',c.slot_type)
      ORDER BY c.class_date,c.start_time) FROM classes c
      JOIN teacher_availability a ON a.teacher_id=c.teacher_id AND a.available_date=c.class_date AND a.slot_type=c.slot_type
      WHERE c.course_id=o.course_id AND NOT c.is_booked
      AND (c.class_date+c.start_time) AT TIME ZONE 'Asia/Taipei'>NOW()
      AND NOT EXISTS (SELECT 1 FROM classes busy WHERE busy.teacher_id=c.teacher_id
        AND busy.class_date=c.class_date AND busy.slot_type=c.slot_type AND busy.is_booked)), '[]'::jsonb) AS slots
    FROM courses o JOIN users u ON u.user_id=o.teacher_id JOIN skills s ON s.skill_id=o.skill_id
    WHERE o.is_active AND ($1::bigint IS NULL OR o.teacher_id=$1) ORDER BY o.course_id DESC`, [teacherId]);
  return rows.map(o => ({ id:Number(o.course_id),courseId:Number(o.course_id),classId:o.slots[0]?Number(o.slots[0].id):null,
    jobId:Number(o.course_id),teacherId:Number(o.teacher_id),name:o.username,skill:o.title,price:Number(o.price),
    category:o.category,description:o.description,rating:o.rating===null?null:Number(o.rating),reviewCount:o.review_count,
    availableTimes:o.slots.map(c=>`${c.date}|${LABEL[c.slot]}`),isBooked:!o.slots.length }));
}

async function syncClasses(client, teacherId) {
  // Lock the teacher first in all scheduling/booking operations to serialize competing changes.
  await client.query(`INSERT INTO classes (course_id,teacher_id,skill_id,class_date,slot_type,start_time,end_time,price,description)
    SELECT o.course_id,o.teacher_id,o.skill_id,a.available_date,a.slot_type,a.start_time,a.end_time,o.price,o.description
    FROM courses o JOIN teacher_availability a ON a.teacher_id=o.teacher_id
    WHERE o.teacher_id=$1 AND o.is_active AND a.available_date>=(NOW() AT TIME ZONE 'Asia/Taipei')::date
    ON CONFLICT (course_id,class_date,slot_type) DO NOTHING`, [teacherId]);
}

async function profile(db, userId) {
  const { rows:[u] } = await db.query(`SELECT user_id,username,department,bio,role,wallet_address,
    (SELECT AVG(rating_stars) FROM reviews WHERE receiver_id=$1 AND reviewer_role='student_to_teacher') AS rating
    FROM users WHERE user_id=$1`,[userId]);
  const { rows } = await db.query(`SELECT a.available_date::text,a.slot_type,
    EXISTS(SELECT 1 FROM classes c WHERE c.teacher_id=a.teacher_id AND c.class_date=a.available_date AND c.slot_type=a.slot_type AND c.is_booked) AS reserved
    FROM teacher_availability a WHERE teacher_id=$1 AND available_date>=(NOW() AT TIME ZONE 'Asia/Taipei')::date ORDER BY available_date,start_time`,[userId]);
  return {userId:Number(u.user_id),userName:u.username,department:u.department||'',bio:u.bio||'',role:u.role,walletAddress:u.wallet_address,teacherRating:u.rating===null?null:Number(u.rating),
    availableTimes:rows.map(r=>`${r.available_date}|${LABEL[r.slot_type]}`),lockedTimes:rows.filter(r=>r.reserved).map(r=>`${r.available_date}|${LABEL[r.slot_type]}`)};
}

async function bookingList(db, userId) {
  const { rows } = await db.query(`SELECT b.*,b.scheduled_date::text AS day_text,c.teacher_id,c.course_id,c.start_time::text,c.end_time::text,s.category,
    (c.class_date+c.start_time) AT TIME ZONE 'Asia/Taipei'>NOW() AS can_cancel,
    (c.class_date+c.end_time) AT TIME ZONE 'Asia/Taipei'<=NOW() AS can_complete,
    r.rating_stars,r.comment
    FROM bookings b JOIN classes c ON c.class_id=b.class_id JOIN skills s ON s.skill_id=c.skill_id
    LEFT JOIN reviews r ON r.booking_id=b.booking_id AND r.sender_id=$1
    WHERE b.student_id=$1 OR b.teacher_id=$1 ORDER BY b.created_at DESC NULLS LAST,b.booking_id DESC`,[userId]);
  return rows.map(b=>({id:Number(b.booking_id),classId:Number(b.class_id),courseId:Number(b.course_id),courseTitle:b.course_title,
    teacherId:Number(b.teacher_id),studentId:Number(b.student_id),teacherName:b.teacher_name,studentName:b.student_name,
    role:String(b.student_id)===String(userId)?'student':'teacher',category:b.category,amount:Number(b.points_spent),
    scheduledTime:`${b.day_text} ${b.start_time.slice(0,5)} - ${b.end_time.slice(0,5)}`,
    status:{confirmed:'IN_ESCROW',disputed:'DISPUTED',completed:'COMPLETED',cancelled:'REFUNDED'}[b.status],
    paymentStatus:b.payment_status,txHash:b.tx_hash,rating:b.rating_stars,review:b.comment||'',disputeReason:b.dispute_reason||'',
    canCancel:b.can_cancel,canComplete:b.can_complete,createdAt:b.created_at}));
}

function installMarketplace(app, db) {
  app.use('/api', (req, res, next) => {
    if (req.body?.expectedUserId !== undefined && String(req.body.expectedUserId) !== String(req.user.user_id)) {
      return res.status(409).json({ error: '帳號已切換，請重新整理後再編輯' });
    }
    return next();
  });
  app.get('/api/user/profile',async(req,res)=>res.json(await profile(db,req.user.user_id)));
  app.put('/api/user/profile',async(req,res)=>{
    const body=req.body||{};
    const name=text(body.userName,'姓名',100);
    for(const key of ['department','bio']) if(body[key]!==undefined && (typeof body[key]!=='string'||body[key].length>(key==='bio'?10000:255))) throw new HttpError(400,'個人資料格式不正確');
    let slots;
    if(body.availableTimes!==undefined){
      if(!Array.isArray(body.availableTimes)||body.availableTimes.length>300) throw new HttpError(400,'排班最多可設定 300 個時段');
      slots=body.availableTimes.map(slot);
      if(new Set(slots.map(s=>s.key)).size!==slots.length) throw new HttpError(400,'排班時段不可重複');
    }
    await transaction(db,async client=>{
      await client.query('SELECT user_id FROM users WHERE user_id=$1 FOR UPDATE',[req.user.user_id]);
      if(slots){
        const {rows:[{today}]}=await client.query("SELECT (NOW() AT TIME ZONE 'Asia/Taipei')::date::text AS today");
        if(slots.some(s=>s.date<today)) throw new HttpError(400,'不能設定過去的授課日期');
        const {rows:reserved}=await client.query(`SELECT DISTINCT class_date::text,slot_type FROM classes
          WHERE teacher_id=$1 AND is_booked AND class_date>=(NOW() AT TIME ZONE 'Asia/Taipei')::date`,[req.user.user_id]);
        if(reserved.some(r=>!slots.some(s=>s.date===r.class_date&&s.type===r.slot_type))) throw new HttpError(409,'已有預約的時段不可移除，請先處理預約');
        await client.query("DELETE FROM teacher_availability WHERE teacher_id=$1 AND available_date>=(NOW() AT TIME ZONE 'Asia/Taipei')::date",[req.user.user_id]);
        for(const s of slots) await client.query('INSERT INTO teacher_availability VALUES ($1,$2,$3,$4,$5)',[req.user.user_id,s.date,s.type,s.start,s.end]);
        await syncClasses(client,req.user.user_id);
      }
      await client.query('UPDATE users SET username=$1,department=COALESCE($2,department),bio=COALESCE($3,bio),schedule_configured=CASE WHEN $5::boolean THEN TRUE ELSE schedule_configured END WHERE user_id=$4',
        [name,body.department,body.bio,req.user.user_id,slots!==undefined]);
    });
    res.json(await profile(db,req.user.user_id));
  });

  app.post('/api/teachers',async(req,res)=>{
    const body=req.body||{},title=text(body.skill,'課程名稱',200),category=text(body.category||'綜合','分類',50),price=amount(body.price);
    if(body.description!==undefined&&(typeof body.description!=='string'||body.description.length>10000)) throw new HttpError(400,'課程說明最多 10000 字');
    const courseId=await transaction(db,async client=>{
      const {rows:[teacher]}=await client.query("UPDATE users SET role='teacher' WHERE user_id=$1 RETURNING schedule_configured",[req.user.user_id]);
      const {rows:[skill]}=await client.query('INSERT INTO skills(category,name) VALUES ($1,$2) RETURNING skill_id',[category,Array.from(title).slice(0,100).join('')]);
      await client.query("INSERT INTO entity_skills(owner_type,owner_id,skill_id,skill_level) VALUES ('user',$1,$2,'中級')",[req.user.user_id,skill.skill_id]);
      const {rows:[o]}=await client.query('INSERT INTO courses(teacher_id,skill_id,title,price,description) VALUES ($1,$2,$3,$4,$5) RETURNING course_id',
        [req.user.user_id,skill.skill_id,title,price,body.description||'']);
      // Retain the original default slot for a new teacher; saved schedules otherwise take priority.
      if(!teacher.schedule_configured) await client.query(`INSERT INTO teacher_availability
        SELECT $1,(NOW() AT TIME ZONE 'Asia/Taipei')::date+7,'morning','09:00'::time,'10:00'::time
        WHERE NOT EXISTS(SELECT 1 FROM teacher_availability WHERE teacher_id=$1 AND available_date>=(NOW() AT TIME ZONE 'Asia/Taipei')::date)
        ON CONFLICT DO NOTHING`,[req.user.user_id]);
      await client.query('UPDATE users SET schedule_configured=TRUE WHERE user_id=$1',[req.user.user_id]);
      await syncClasses(client,req.user.user_id);
      return o.course_id;
    });
    res.status(201).json((await courseCards(db,req.user.user_id)).find(c=>String(c.id)===String(courseId)));
  });

  app.put('/api/teachers/:id',async(req,res)=>{
    const courseId=id(req.params.id),body=req.body||{};
    const title=body.skill===undefined?null:text(body.skill,'課程名稱',200),price=body.price===undefined?null:amount(body.price);
    if(body.description!==undefined&&(typeof body.description!=='string'||body.description.length>10000)) throw new HttpError(400,'課程說明格式不正確');
    await transaction(db,async client=>{
      await client.query('SELECT user_id FROM users WHERE user_id=$1 FOR UPDATE',[req.user.user_id]);
      const {rows:[o]}=await client.query('SELECT * FROM courses WHERE course_id=$1 FOR UPDATE',[courseId]);
      if(!o||!o.is_active) throw new HttpError(404,'找不到課程');
      if(String(o.teacher_id)!==String(req.user.user_id)) throw new HttpError(403,'只能修改自己的課程');
      await client.query('UPDATE courses SET title=COALESCE($1,title),price=COALESCE($2,price),description=COALESCE($3,description),updated_at=NOW() WHERE course_id=$4',
        [title,price,body.description,courseId]);
      await client.query('UPDATE classes SET price=COALESCE($1,price),description=COALESCE($2,description) WHERE course_id=$3 AND NOT is_booked',[price,body.description,courseId]);
    });
    res.json((await courseCards(db,req.user.user_id)).find(c=>String(c.id)===courseId));
  });
  app.delete('/api/teachers/:id',async(req,res)=>{
    const courseId=id(req.params.id);
    await transaction(db,async client=>{
      await client.query('SELECT user_id FROM users WHERE user_id=$1 FOR UPDATE',[req.user.user_id]);
      const {rows:[o]}=await client.query('SELECT teacher_id FROM courses WHERE course_id=$1 FOR UPDATE',[courseId]);
      if(!o) throw new HttpError(404,'找不到課程');
      if(String(o.teacher_id)!==String(req.user.user_id)) throw new HttpError(403,'只能下架自己的課程');
      const active=await client.query(`SELECT 1 FROM bookings b JOIN classes c ON c.class_id=b.class_id
        WHERE c.course_id=$1 AND b.status IN ('confirmed','disputed') LIMIT 1`,[courseId]);
      if(active.rowCount) throw new HttpError(409,'課程仍有尚未結束的預約，請先處理預約');
      await client.query('UPDATE courses SET is_active=FALSE,updated_at=NOW() WHERE course_id=$1',[courseId]);
    });
    res.json({success:true});
  });

  app.get('/api/bookings',async(req,res)=>res.json(await bookingList(db,req.user.user_id)));

  async function createBooking(req,res){
    const body=req.body||{};
    let courseId=body.courseId? id(body.courseId):null;
    if(!courseId){
      const {rows:[reference]}=await db.query('SELECT course_id FROM classes WHERE class_id=$1',[id(body.classId)]);
      if(!reference) throw new HttpError(404,'找不到課程');
      courseId=reference.course_id;
    }
    const {rows:[reference]}=await db.query('SELECT teacher_id FROM courses WHERE course_id=$1',[courseId]);
    if(!reference) throw new HttpError(404,'找不到課程');
    const chosen=body.timeSlot?slot(body.timeSlot):null;
    const bookingId=await transaction(db,async client=>{
      // Consistent user order prevents concurrent settlement/booking deadlocks.
      await client.query('SELECT user_id FROM users WHERE user_id=ANY($1::bigint[]) ORDER BY user_id FOR UPDATE',[[reference.teacher_id,req.user.user_id]]);
      const {rows:[o]}=await client.query('SELECT * FROM courses WHERE course_id=$1 AND is_active FOR UPDATE',[courseId]);
      if(!o) throw new HttpError(404,'課程已下架');
      if(String(o.teacher_id)===String(req.user.user_id)) throw new HttpError(400,'不能預約自己的課程');
      const params=chosen?[courseId,chosen.date,chosen.type]:[courseId,id(body.classId)];
      const {rows:[c]}=await client.query(`SELECT c.*,c.class_date::text AS day_text FROM classes c
        JOIN teacher_availability a ON a.teacher_id=c.teacher_id AND a.available_date=c.class_date AND a.slot_type=c.slot_type
        WHERE c.course_id=$1 AND ${chosen?'c.class_date=$2 AND c.slot_type=$3':'c.class_id=$2'} AND NOT c.is_booked
        AND (c.class_date+c.start_time) AT TIME ZONE 'Asia/Taipei'>NOW()
        AND NOT EXISTS(SELECT 1 FROM classes busy WHERE busy.teacher_id=c.teacher_id AND busy.class_date=c.class_date AND busy.slot_type=c.slot_type AND busy.is_booked)
        LIMIT 1 FOR UPDATE OF c`,params);
      if(!c) throw new HttpError(409,'此時段已無法預約，請重新選擇');
      const {rows:[student]}=await client.query('UPDATE users SET cached_points=cached_points-$1::numeric WHERE user_id=$2 AND cached_points>=$1::numeric RETURNING username',[o.price,req.user.user_id]);
      if(!student) throw new HttpError(400,'餘額不足');
      const {rows:[teacher]}=await client.query('SELECT username FROM users WHERE user_id=$1',[o.teacher_id]);
      const {rows:[b]}=await client.query(`INSERT INTO bookings(student_id,class_id,points_spent,course_title,teacher_name,student_name,scheduled_date,slot_type,teacher_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING booking_id`,[req.user.user_id,c.class_id,o.price,o.title,teacher.username,student.username,c.day_text,c.slot_type,o.teacher_id]);
      await client.query(`INSERT INTO point_transactions(user_id,amount,transaction_type,description,tx_status,booking_id)
        VALUES ($1,-$2::numeric,'consume',$3,'success',$4)`,[req.user.user_id,o.price,`預約託管：${o.title}`,b.booking_id]);
      return b.booking_id;
    });
    res.status(201).json({success:true,booking:(await bookingList(db,req.user.user_id)).find(b=>String(b.id)===String(bookingId))});
  }
  app.post(['/api/bookings','/api/wallet/deduct'],createBooking);

  async function changeBooking(req,res,action){
    const bookingId=id(req.params.id),body=req.body||{};
    const {rows:[reference]}=await db.query('SELECT b.student_id,c.teacher_id FROM bookings b JOIN classes c ON c.class_id=b.class_id WHERE booking_id=$1',[bookingId]);
    if(!reference) throw new HttpError(404,'找不到預約');
    if(![String(reference.student_id),String(reference.teacher_id)].includes(String(req.user.user_id))) throw new HttpError(403,'無法操作其他人的預約');
    await transaction(db,async client=>{
      await client.query('SELECT user_id FROM users WHERE user_id=ANY($1::bigint[]) ORDER BY user_id FOR UPDATE',[[reference.student_id,reference.teacher_id]]);
      const {rows:[b]}=await client.query(`SELECT b.*,c.teacher_id,
        (c.class_date+c.start_time) AT TIME ZONE 'Asia/Taipei'>NOW() AS before_start,
        (c.class_date+c.end_time) AT TIME ZONE 'Asia/Taipei'<=NOW() AS after_end
        FROM bookings b JOIN classes c ON c.class_id=b.class_id WHERE b.booking_id=$1 FOR UPDATE OF b`,[bookingId]);
      const student=String(b.student_id)===String(req.user.user_id);
      if(b.payment_status!=='escrowed') throw new HttpError(409,'此預約已結算，請重新整理');
      if(action==='dispute'){
        if(!student) throw new HttpError(403,'只有學生可以提出爭議');
        if(b.status!=='confirmed'||b.before_start) throw new HttpError(409,'課前請使用取消預約；課後才能提出爭議');
        await client.query("UPDATE bookings SET status='disputed',dispute_reason=$1,updated_at=NOW() WHERE booking_id=$2",[text(body.reason,'爭議原因',3000),bookingId]);
        return;
      }
      if(action==='complete'){
        if(!student) throw new HttpError(403,'只有學生可以確認完課');
        if(b.status!=='confirmed'||!b.after_end) throw new HttpError(409,'課程結束且沒有爭議時，才能確認完課');
        if(!Number.isInteger(body.rating)||body.rating<1||body.rating>5) throw new HttpError(400,'評分必須介於 1 到 5');
        if(body.review!==undefined&&(typeof body.review!=='string'||body.review.length>3000)) throw new HttpError(400,'評語最多 3000 字');
        await client.query("UPDATE bookings SET status='completed',payment_status='released',completed_at=NOW(),updated_at=NOW() WHERE booking_id=$1",[bookingId]);
        await client.query('UPDATE users SET cached_points=cached_points+$1::numeric WHERE user_id=$2',[b.points_spent,b.teacher_id]);
        await client.query(`INSERT INTO point_transactions(user_id,amount,transaction_type,description,tx_status,booking_id)
          VALUES ($1,$2,'release',$3,'success',$4)`,[b.teacher_id,b.points_spent,`完課收入：${b.course_title}`,bookingId]);
        await client.query(`INSERT INTO reviews(booking_id,sender_id,receiver_id,reviewer_role,rating_stars,comment)
          VALUES ($1,$2,$3,'student_to_teacher',$4,$5)`,[bookingId,b.student_id,b.teacher_id,body.rating,body.review||'']);
        await client.query("UPDATE users SET teacher_rating=(SELECT AVG(rating_stars) FROM reviews WHERE receiver_id=$1 AND reviewer_role='student_to_teacher') WHERE user_id=$1",[b.teacher_id]);
      }else{
        if(action==='cancel'&&(!student||b.status!=='confirmed'||!b.before_start)) throw new HttpError(409,'只有學生能在課程開始前取消預約');
        if(action==='refund'&&(student||b.status!=='disputed')) throw new HttpError(403,'爭議退款須由授課老師同意');
        await client.query("UPDATE bookings SET status='cancelled',payment_status='refunded',refunded_at=NOW(),updated_at=NOW() WHERE booking_id=$1",[bookingId]);
        await client.query('UPDATE users SET cached_points=cached_points+$1::numeric WHERE user_id=$2',[b.points_spent,b.student_id]);
        await client.query(`INSERT INTO point_transactions(user_id,amount,transaction_type,description,tx_status,booking_id)
          VALUES ($1,$2,'refund',$3,'success',$4)`,[b.student_id,b.points_spent,`預約退款：${b.course_title}`,bookingId]);
      }
    });
    res.json({success:true,booking:(await bookingList(db,req.user.user_id)).find(b=>String(b.id)===bookingId)});
  }
  for(const action of ['complete','cancel','dispute','refund']) app.post(`/api/bookings/:id/${action}`,(req,res)=>changeBooking(req,res,action));
}

module.exports={installMarketplace,courseCards,HttpError};
