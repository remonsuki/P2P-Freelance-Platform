const pool = require('../db');
const { assertConfigured } = require('../db');

async function audit(db = pool) {
  const { rows: tables } = await db.query(`SELECT tablename,
    pg_size_pretty(pg_total_relation_size((quote_ident(schemaname)||'.'||quote_ident(tablename))::regclass)) AS total_size
    FROM pg_tables WHERE schemaname=current_schema() ORDER BY tablename`);
  const {rows:[counts]}=await db.query(`SELECT
    (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_schema=current_schema() AND column_name IN ('cached_points','balance','remaining_balance')) AS stored_balance_columns,
    (SELECT COUNT(*)::int FROM legacy_point_transactions) AS archived_point_transactions,
    (SELECT COUNT(*)::int FROM bookings WHERE archived_at IS NOT NULL) AS archived_bookings,
    (SELECT COUNT(*)::int FROM chain_transaction_records) AS verified_chain_receipts,
    (SELECT COUNT(*)::int FROM chain_payments p WHERE p.funded_tx_hash IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM chain_transaction_records r WHERE r.chain_id=p.chain_id AND r.tx_hash=LOWER(p.funded_tx_hash))) AS payments_missing_funding_backup,
    (SELECT COUNT(*)::int FROM chain_payments p WHERE p.last_tx_hash IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM chain_transaction_records r WHERE r.chain_id=p.chain_id AND r.tx_hash=LOWER(p.last_tx_hash))) AS payments_missing_latest_backup,
    (SELECT COUNT(*)::int FROM classes c WHERE is_booked<>(
      EXISTS(SELECT 1 FROM bookings b WHERE b.class_id=c.class_id AND b.archived_at IS NULL AND b.status IN ('confirmed','disputed','completed')) OR
      EXISTS(SELECT 1 FROM chain_payments p WHERE p.class_id=c.class_id AND p.status IN ('quoted','funded','disputed','released'))
    )) AS mismatched_slot_flags,
    (SELECT COUNT(*)::int FROM chain_payments WHERE status='quoted') AS pending_chain_payments,
    (SELECT COUNT(*)::int FROM pg_constraint WHERE connamespace=current_schema()::regnamespace AND NOT convalidated) AS unvalidated_constraints`);
  return {tables,counts};
}
if (require.main === module) {
  (async()=>{
    try {assertConfigured();console.log(JSON.stringify(await audit(),null,2));}
    catch(error){console.error('資料檢查失敗:',error.code||error.message);process.exitCode=1;}
    finally {await pool.end();}
  })();
}
module.exports={audit};
