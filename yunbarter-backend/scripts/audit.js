const pool = require('../db');
const { assertConfigured } = require('../db');

async function audit(db = pool) {
  const { rows: tables } = await db.query(`SELECT tablename,
    pg_size_pretty(pg_total_relation_size((quote_ident(schemaname)||'.'||quote_ident(tablename))::regclass)) AS total_size
    FROM pg_tables WHERE schemaname=current_schema() ORDER BY tablename`);
  const { rows: differences } = await db.query(`SELECT u.user_id,u.cached_points::text,
    COALESCE(SUM(t.amount),0)::text AS ledger_total,
    (u.cached_points-COALESCE(SUM(t.amount),0))::text AS difference
    FROM users u LEFT JOIN point_transactions t ON t.user_id=u.user_id GROUP BY u.user_id
    HAVING u.cached_points<>COALESCE(SUM(t.amount),0) ORDER BY u.user_id`);
  const { rows: [counts] } = await db.query(`SELECT
    (SELECT COUNT(*)::int FROM user_sessions WHERE expires_at<=NOW()) AS expired_sessions,
    (SELECT COUNT(*)::int FROM point_transactions WHERE transaction_type='consume' AND booking_id IS NULL) AS legacy_consumes_without_booking_reference,
    (SELECT COUNT(*)::int FROM bookings WHERE created_at IS NULL) AS legacy_bookings_without_creation_time,
    (SELECT COUNT(*)::int FROM bookings b JOIN classes c ON c.class_id=b.class_id
      WHERE b.scheduled_date<>c.class_date OR b.slot_type<>c.slot_type) AS snapshot_schedule_mismatches,
    (SELECT COUNT(*)::int FROM classes c WHERE is_booked<>EXISTS (SELECT 1 FROM bookings b
      WHERE b.class_id=c.class_id AND b.status IN ('confirmed','disputed','completed'))) AS mismatched_slot_flags,
    (SELECT COUNT(*)::int FROM pg_constraint WHERE connamespace=current_schema()::regnamespace AND NOT convalidated) AS unvalidated_constraints`);
  const { rows: [role] } = await db.query('SELECT current_user AS role,rolsuper AS is_superuser FROM pg_roles WHERE rolname=current_user');
  return { databaseRole: role, tables, counts, balanceLedgerDifferences: differences };
}
if (require.main === module) {
  (async () => {
    try { assertConfigured(); console.log(JSON.stringify(await audit(),null,2)); }
    catch (error) { console.error('資料檢查失敗:',error.code||error.message); process.exitCode=1; }
    finally { await pool.end(); }
  })();
}
module.exports={audit};
