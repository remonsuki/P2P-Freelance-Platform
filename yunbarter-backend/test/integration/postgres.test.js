const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');
const { connectionOptions, assertConfigured } = require('../../db');
const { migrate } = require('../../scripts/migrate');
const { seed } = require('../../scripts/seed');
const { createApp } = require('../../server');
const { isPasswordHash, verifyPassword } = require('../../passwords');

test('PostgreSQL: migrated history, schedules, course content, bookings and atomic settlement', async t => {
  const env=process.env.TEST_DATABASE_URL?{DATABASE_URL:process.env.TEST_DATABASE_URL}:process.env;
  assertConfigured(env);
  const pool=new Pool(connectionOptions(env));
  const schemas=[];
  let server;
  t.after(async()=>{
    if(server?.listening) await new Promise(resolve=>server.close(resolve));
    try {for(const name of schemas.reverse()) await pool.query(`DROP SCHEMA "${name}" CASCADE`);}
    finally {await pool.end();}
  });
  async function scoped(name){
    await pool.query(`CREATE SCHEMA "${name}"`);schemas.push(name);
    const db={async connect(){const client=await pool.connect();try {await client.query("SELECT set_config('search_path',$1,false)",[name]);return client;}catch(e){client.release();throw e;}},
      async query(sql,values){const client=await db.connect();try{return await client.query(sql,values);}finally{client.release();}}};
    return db;
  }
  const db=await scoped('yunbarter_test_'+randomBytes(8).toString('hex'));
  await db.query(await fs.readFile(path.join(__dirname,'../../../db/schema.sql'),'utf8'));
  await db.query("INSERT INTO users(email,password_hash,username,role,hourly_points,cached_points) VALUES ('LEGACY@example.com','old-password','Legacy','student',NULL,42),('oldteacher@example.com','old-password','Old Teacher','teacher',2,50)");
  await db.query("INSERT INTO skills(category,name) VALUES ('程式','Legacy Course')");
  await db.query("INSERT INTO classes(teacher_id,skill_id,class_date,slot_type,start_time,end_time,is_booked) VALUES (2,1,CURRENT_DATE+30,'morning','09:00','10:00',TRUE)");
  await db.query("INSERT INTO bookings(student_id,class_id,points_spent) VALUES (1,1,2)");

  await t.test('upgrade preserves existing users, bookings, prices and dates; migrations are repeatable',async()=>{
    assert.equal((await migrate(db)).upgradedPasswords,2);
    const {rows:[u]}=await db.query('SELECT * FROM users WHERE user_id=1');
    assert.equal(u.email,'legacy@example.com');assert.equal(Number(u.cached_points),42);
    assert.ok(isPasswordHash(u.password_hash));assert.equal(await verifyPassword('old-password',u.password_hash),true);
    const {rows:[b]}=await db.query('SELECT b.*,c.course_id FROM bookings b JOIN classes c USING(class_id) WHERE booking_id=1');
    assert.equal(b.course_title,'Legacy Course');assert.equal(Number(b.points_spent),2);assert.ok(b.course_id);
    assert.equal((await migrate(db)).upgradedPasswords,0);
  });

  let base;
  async function start(){server=createApp({db,secureCookies:false,demoPayments:true}).listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;}
  await start();
  async function request(method,route,body,cookie){
    const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',Origin:'http://localhost:5173',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,body:await response.json(),cookie:response.headers.getSetCookie()[0]?.split(';')[0],headers:response.headers};
  }
  const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.body));return r.body;};
  const password='same-password-123';
  const a=await request('POST','/api/auth/register',{email:'a@example.com',password,userName:'同名老師'});
  const b=await request('POST','/api/auth/register',{email:'b@example.com',password,userName:'同名老師'});
  const student=await request('POST','/api/auth/register',{email:'student@example.com',password,userName:'Student'});
  ok(a,201);ok(b,201);ok(student,201);
  await db.query('UPDATE users SET cached_points=50 WHERE user_id=$1',[a.body.userId]);
  await db.query('UPDATE users SET cached_points=30 WHERE user_id=$1',[b.body.userId]);
  await db.query('UPDATE users SET cached_points=20 WHERE user_id=$1',[student.body.userId]);
  const dates=(await db.query("SELECT ((NOW() AT TIME ZONE 'Asia/Taipei')::date+2)::text AS d1,((NOW() AT TIME ZONE 'Asia/Taipei')::date+3)::text AS d2,((NOW() AT TIME ZONE 'Asia/Taipei')::date+4)::text AS d3")).rows[0];
  const first=dates.d1+'|Morning',second=dates.d2+'|Afternoon',third=dates.d3+'|Night';
  const wallet=async account=>ok(await request('GET','/api/user/wallet',undefined,account.cookie));
  const list=async account=>ok(await request('GET','/api/bookings',undefined,account.cookie));

  await t.test('cookie sessions, password salts and private bookings remain isolated',async()=>{
    assert.notEqual(a.cookie,b.cookie);assert.match(a.headers.get('set-cookie'),/HttpOnly/);
    assert.match(a.headers.get('set-cookie'),/SameSite=Lax/);
    assert.equal((await wallet(a)).balance,50);assert.equal((await wallet(b)).balance,30);
    assert.equal((await list(a)).length,0);assert.equal((await request('GET','/api/bookings')).status,401);
    const {rows}=await db.query('SELECT password_hash FROM users WHERE user_id=ANY($1::bigint[])',[[a.body.userId,b.body.userId]]);
    assert.notEqual(rows[0].password_hash,rows[1].password_hash);
    assert.equal((await request('POST','/api/auth/login',{email:'a@example.com',password:'wrong'})).status,401);
    assert.equal((await request('POST','/api/auth/register',{email:'A@example.com',password,userName:'Duplicate'})).status,409);
  });

  await t.test('schedule saves before publishing, survives reload, and rejects invalid or repeated values',async()=>{
    const saved=ok(await request('PUT','/api/user/profile',{userName:'Teacher A',department:'Dept',bio:'Bio',availableTimes:[first,second,third]},a.cookie));
    assert.deepEqual(saved.availableTimes,[first,second,third]);
    const loaded=ok(await request('GET','/api/user/profile',undefined,a.cookie));assert.equal(loaded.bio,'Bio');
    assert.deepEqual(loaded.availableTimes,[first,second,third]);
    assert.equal((await request('PUT','/api/user/profile',{userName:'STALE ACCOUNT',expectedUserId:b.body.userId,availableTimes:[]},a.cookie)).status,409);
    assert.equal((await request('PUT','/api/user/profile',{userName:'Teacher A',availableTimes:[first,first]},a.cookie)).status,400);
    assert.equal((await request('PUT','/api/user/profile',{userName:'Teacher A',availableTimes:['2026-02-31|Morning']},a.cookie)).status,400);
    assert.equal((await request('PUT','/api/user/profile',{userName:'Teacher A',availableTimes:['2000-01-01|Morning']},a.cookie)).status,400);
  });
  const originalDescription='第一行：原始課程說明\n第二行：中文與 emoji 🎸';
  const courseA=ok(await request('POST','/api/teachers',{skill:'Course A',category:'程式',price:2.5,description:originalDescription,name:'forged owner'},a.cookie),201);
  const otherA=ok(await request('POST','/api/teachers',{skill:'Course A2',category:'程式',price:3,description:'Another course'},a.cookie),201);
  const courseB=ok(await request('POST','/api/teachers',{skill:'Course B',category:'音樂',price:9,description:'B'},b.cookie),201);

  await t.test('course content and its distinct price persist; edits cannot affect another owner',async()=>{
    assert.equal(courseA.teacherId,a.body.userId);assert.equal(courseA.description,originalDescription);
    assert.deepEqual(courseA.availableTimes,[first,second,third]);assert.equal(courseB.price,9);
    assert.equal((await request('PUT',`/api/teachers/${courseA.id}`,{skill:'Hijacked',price:1},b.cookie)).status,403);
    assert.equal((await request('DELETE',`/api/teachers/${courseA.id}`,undefined,b.cookie)).status,403);
    const courses=ok(await request('GET','/api/teachers'));assert.equal(courses.find(c=>c.id===courseA.id).description,originalDescription);
    assert.equal(courses.find(c=>c.id===courseB.id).description,'B');
  });

  let booked;
  await t.test('real booking debits once, appears only for its participants, and locks all teacher courses at that time',async()=>{
    booked=ok(await request('POST','/api/bookings',{courseId:courseA.id,timeSlot:first,amount:-100},student.cookie),201).booking;
    assert.equal(booked.amount,2.5);assert.ok(booked.scheduledTime.startsWith(dates.d1));
    assert.equal((await wallet(student)).balance,17.5);assert.equal((await wallet(a)).balance,50);
    assert.equal((await list(student)).length,1);assert.equal((await list(a)).length,1);assert.equal((await list(b)).length,0);
    assert.equal((await request('POST',`/api/bookings/${booked.id}/cancel`,undefined,b.cookie)).status,403);
    assert.equal((await request('POST','/api/bookings',{courseId:otherA.id,timeSlot:first},b.cookie)).status,409);
    const cards=ok(await request('GET','/api/teachers'));assert.ok(!cards.find(c=>c.id===otherA.id).availableTimes.includes(first));
    assert.equal((await request('DELETE',`/api/teachers/${courseA.id}`,undefined,a.cookie)).status,409);
  });

  await t.test('reserved schedule removal rolls back the entire profile update',async()=>{
    assert.equal((await request('PUT','/api/user/profile',{userName:'SHOULD NOT SAVE',availableTimes:[second,third]},a.cookie)).status,409);
    const loaded=ok(await request('GET','/api/user/profile',undefined,a.cookie));
    assert.equal(loaded.userName,'Teacher A');assert.ok(loaded.lockedTimes.includes(first));
    assert.deepEqual(loaded.availableTimes,[first,second,third]);
  });

  await t.test('course edits preserve existing booking title and amount snapshots',async()=>{
    const edited=ok(await request('PUT',`/api/teachers/${courseA.id}`,{skill:'Updated Course A',price:4,description:'更新後的說明\n持久保存'},a.cookie));
    assert.equal(edited.description,'更新後的說明\n持久保存');assert.equal(edited.price,4);
    const historical=(await list(student))[0];assert.equal(historical.courseTitle,'Course A');assert.equal(historical.amount,2.5);
    const cards=ok(await request('GET','/api/teachers'));assert.equal(cards.find(c=>c.id===courseB.id).price,9);
  });

  await t.test('parallel cancellation refunds exactly once and releases the slot without deleting history',async()=>{
    const results=await Promise.all([request('POST',`/api/bookings/${booked.id}/cancel`,undefined,student.cookie),request('POST',`/api/bookings/${booked.id}/cancel`,undefined,student.cookie)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    assert.equal((await wallet(student)).balance,20);
    assert.equal((await list(student))[0].status,'REFUNDED');
    const {rows:[n]}=await db.query("SELECT COUNT(*)::int AS n FROM point_transactions WHERE booking_id=$1 AND transaction_type='refund'",[booked.id]);assert.equal(n.n,1);
    const cards=ok(await request('GET','/api/teachers'));assert.ok(cards.find(c=>c.id===courseA.id).availableTimes.includes(first));
  });

  await t.test('concurrent reservations allow only one student for a teacher/time',async()=>{
    const result=await Promise.all([request('POST','/api/bookings',{courseId:courseA.id,timeSlot:second},student.cookie),request('POST','/api/bookings',{courseId:otherA.id,timeSlot:second},b.cookie)]);
    assert.deepEqual(result.map(r=>r.status).sort(),[201,409]);
    const won=result.find(r=>r.status===201).body.booking;
    const account=won.studentId===student.body.userId?student:b;
    ok(await request('POST',`/api/bookings/${won.id}/cancel`,undefined,account.cookie));
  });

  await t.test('completion is student-only, requires course end, pays teacher once, and persists the review',async()=>{
    const created=ok(await request('POST','/api/bookings',{courseId:courseA.id,timeSlot:first},student.cookie),201).booking;
    assert.equal((await request('POST',`/api/bookings/${created.id}/complete`,{rating:5},a.cookie)).status,403);
    assert.equal((await request('POST',`/api/bookings/${created.id}/complete`,{rating:5},student.cookie)).status,409);
    await db.query("UPDATE classes SET class_date=(NOW() AT TIME ZONE 'Asia/Taipei')::date-1 WHERE class_id=$1",[created.classId]);
    await db.query("UPDATE bookings SET scheduled_date=(NOW() AT TIME ZONE 'Asia/Taipei')::date-1 WHERE booking_id=$1",[created.id]);
    const result=await Promise.all([request('POST',`/api/bookings/${created.id}/complete`,{rating:4,review:'真的保存的評語'},student.cookie),request('POST',`/api/bookings/${created.id}/complete`,{rating:4},student.cookie)]);
    assert.deepEqual(result.map(r=>r.status).sort(),[200,409]);
    assert.equal((await wallet(a)).balance,54);assert.equal((await wallet(student)).balance,16);
    const completed=(await list(student)).find(o=>o.id===created.id);assert.equal(completed.status,'COMPLETED');assert.equal(completed.review,'真的保存的評語');
    const ratedCards=ok(await request('GET','/api/teachers'));
    assert.equal(ratedCards.find(c=>c.id===courseA.id).rating,4);
    assert.equal(ratedCards.find(c=>c.id===courseA.id).reviewCount,1);
    assert.equal(ok(await request('GET','/api/user/profile',undefined,a.cookie)).teacherRating,4);
    assert.equal((await request('POST',`/api/bookings/${created.id}/refund`,undefined,a.cookie)).status,409);
  });

  await t.test('disputes freeze settlement; only the teacher can approve a single refund',async()=>{
    const created=ok(await request('POST','/api/bookings',{courseId:courseA.id,timeSlot:third},student.cookie),201).booking;
    await db.query("UPDATE classes SET class_date=(NOW() AT TIME ZONE 'Asia/Taipei')::date-2 WHERE class_id=$1",[created.classId]);
    await db.query("UPDATE bookings SET scheduled_date=(NOW() AT TIME ZONE 'Asia/Taipei')::date-2 WHERE booking_id=$1",[created.id]);
    ok(await request('POST',`/api/bookings/${created.id}/dispute`,{reason:'老師未依約授課'},student.cookie));
    assert.equal((await list(a)).find(o=>o.id===created.id).disputeReason,'老師未依約授課');
    assert.equal((await request('POST',`/api/bookings/${created.id}/complete`,{rating:5},student.cookie)).status,409);
    assert.equal((await request('POST',`/api/bookings/${created.id}/refund`,undefined,student.cookie)).status,403);
    assert.equal((await request('POST',`/api/bookings/${created.id}/refund`,undefined,b.cookie)).status,403);
    ok(await request('POST',`/api/bookings/${created.id}/refund`,undefined,a.cookie));
    assert.equal((await request('POST',`/api/bookings/${created.id}/refund`,undefined,a.cookie)).status,409);
    assert.equal((await wallet(student)).balance,16);assert.equal((await wallet(a)).balance,54);
  });

  await t.test('wallet cache is not client-controlled and duplicate ledger writes roll back',async()=>{
    const synced=ok(await request('POST','/api/user/wallet/sync',{walletAddress:'0x'+'a'.repeat(40),cachedPoints:1e6},a.cookie));assert.equal(synced.balance,54);
    const txHash='0x'+'b'.repeat(64);
    ok(await request('POST','/api/wallet/deposit',{amount:1,txHash},a.cookie));
    assert.equal((await request('POST','/api/wallet/deposit',{amount:1,txHash},a.cookie)).status,409);
    assert.equal((await wallet(a)).balance,55);
  });

  await t.test('database constraints reject invalid balances, times, states and duplicate reviews',async()=>{
    await assert.rejects(db.query('UPDATE users SET cached_points=-1 WHERE user_id=$1',[a.body.userId]),e=>e.code==='23514');
    await assert.rejects(db.query('UPDATE users SET cached_points=NULL WHERE user_id=$1',[a.body.userId]),e=>e.code==='23502');
    await assert.rejects(db.query('UPDATE bookings SET status=NULL WHERE booking_id=$1',[booked.id]),e=>e.code==='23502');
    await assert.rejects(db.query("UPDATE users SET cached_points='NaN'::numeric WHERE user_id=$1",[a.body.userId]),e=>e.code==='23514');
    await assert.rejects(db.query("UPDATE courses SET price='NaN'::numeric WHERE course_id=$1",[courseA.id]),e=>e.code==='23514');
    await assert.rejects(db.query("UPDATE classes SET end_time=start_time WHERE course_id=$1",[courseA.id]),e=>e.code==='23514');
    await assert.rejects(db.query("UPDATE bookings SET status='unknown' WHERE booking_id=$1",[booked.id]),e=>e.code==='23514');
    await assert.rejects(db.query("INSERT INTO reviews(booking_id,sender_id,receiver_id,reviewer_role,rating_stars) SELECT booking_id,sender_id,receiver_id,reviewer_role,5 FROM reviews LIMIT 1"),e=>e.code==='23505');
  });

  await t.test('empty schedules persist and do not silently reappear when publishing another course',async()=>{
    ok(await request('PUT','/api/user/profile',{userName:'Teacher B',availableTimes:[]},b.cookie));
    const created=ok(await request('POST','/api/teachers',{skill:'No schedule',price:2,category:'程式',description:'No fake time'},b.cookie),201);
    assert.deepEqual(created.availableTimes,[]);assert.equal(created.classId,null);
    assert.equal((await request('POST','/api/bookings',{courseId:created.id,timeSlot:first},student.cookie)).status,409);
    ok(await request('DELETE',`/api/teachers/${created.id}`,undefined,b.cookie));
  });

  await t.test('server restart retains data and sessions; logout/expiry do not affect other accounts',async()=>{
    await new Promise(resolve=>server.close(resolve));await start();
    assert.equal((await wallet(a)).balance,55);assert.ok((await list(student)).some(o=>o.status==='COMPLETED'));
    const login=await request('POST','/api/auth/login',{email:'a@example.com',password},a.cookie);ok(login);
    assert.notEqual(login.cookie,a.cookie);assert.equal((await request('GET','/api/user/wallet',undefined,a.cookie)).status,401);
    ok(await request('POST','/api/auth/logout',undefined,login.cookie));assert.equal((await request('GET','/api/user/wallet',undefined,login.cookie)).status,401);
    assert.equal((await wallet(student)).balance,16);
    await db.query("UPDATE user_sessions SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id=$1",[b.body.userId]);
    assert.equal((await request('GET','/api/user/wallet',undefined,b.cookie)).status,401);
  });

  await t.test('development seeding only fills an empty migrated schema',async()=>{
    const empty=await scoped('yunbarter_test_seed_'+randomBytes(8).toString('hex'));
    await migrate(empty);await seed(empty);await assert.rejects(seed(empty),/已有資料/);
    const {rows:[counts]}=await empty.query('SELECT (SELECT COUNT(*)::int FROM courses) AS courses,(SELECT COUNT(*)::int FROM bookings) AS bookings');
    assert.equal(counts.courses,2);assert.equal(counts.bookings,2);
    await assert.rejects(seed(db),/已有資料/);
  });
});
