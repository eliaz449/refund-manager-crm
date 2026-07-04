import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  host: "trolley.proxy.rlwy.net",
  port: 50633,
  user: "postgres",
  password: "fzJmujFMZwrmWMjMVaWQtrCEaaEgMTWd",
  database: "railway",
  ssl: false,
});

const c = await pool.connect();
try {
  console.log("=== ALL clients (last 14 days) — created or updated ===");
  const allClients = await c.query(`
    SELECT id, created_at, updated_at, full_name, phone, source, status, lead_status, created_by
    FROM clients
    WHERE created_at > NOW() - INTERVAL '14 days' OR updated_at > NOW() - INTERVAL '14 days'
    ORDER BY GREATEST(created_at, updated_at) DESC
    LIMIT 50
  `);
  console.log(`Found ${allClients.rowCount}`);
  for (const r of allClients.rows) {
    const created = r.created_at.toISOString().substring(0,19).replace('T',' ');
    const updated = r.updated_at.toISOString().substring(0,19).replace('T',' ');
    console.log(`  created=[${created}] updated=[${updated}] ${r.full_name} | ${r.phone} | src=${r.source} status=${r.status} lead=${r.lead_status}`);
  }

  console.log("\n=== partner_leads (last 14 days) ===");
  try {
    const pl = await c.query(`
      SELECT pl.*, cl.full_name, cl.phone
      FROM partner_leads pl
      LEFT JOIN clients cl ON cl.id = pl.client_id
      WHERE pl.created_at > NOW() - INTERVAL '14 days'
      ORDER BY pl.created_at DESC
      LIMIT 30
    `);
    console.log(`Found ${pl.rowCount}`);
    for (const r of pl.rows) {
      console.log(`  [${r.created_at.toISOString().substring(0,19).replace('T',' ')}] partner=${r.partner_user_id || '-'} client=${r.full_name || r.client_id} | ${r.phone || '-'}`);
    }
  } catch (e) { console.log("partner_leads failed:", e.message); }

  console.log("\n=== Daily webhook summary (14 days) ===");
  const summary = await c.query(`
    SELECT
      DATE(received_at) as day,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE auth_status='ok') as auth_ok,
      COUNT(*) FILTER (WHERE auth_status='failed') as auth_failed,
      COUNT(*) FILTER (WHERE auth_status='no_secret') as no_secret,
      COUNT(*) FILTER (WHERE created_client_id IS NOT NULL) as client_created
    FROM webhook_events
    WHERE received_at > NOW() - INTERVAL '14 days'
    GROUP BY DATE(received_at)
    ORDER BY day DESC
  `);
  for (const s of summary.rows) {
    console.log(`  ${s.day.toISOString().substring(0,10)}: total=${s.total}, ok=${s.auth_ok}, failed_sig=${s.auth_failed}, no_secret=${s.no_secret}, created=${s.client_created}`);
  }

  console.log("\n=== Failed webhook payloads (last 3 days, sample) ===");
  const failed = await c.query(`
    SELECT received_at, error_message, raw_headers, raw_body
    FROM webhook_events
    WHERE received_at > NOW() - INTERVAL '3 days' AND auth_status != 'ok'
    ORDER BY received_at DESC
    LIMIT 3
  `);
  for (const r of failed.rows) {
    console.log(`\n  [${r.received_at.toISOString().substring(0,19).replace('T',' ')}] ${r.error_message}`);
    console.log(`  headers: ${JSON.stringify(r.raw_headers).substring(0, 400)}`);
    console.log(`  body: ${(r.raw_body || '').substring(0, 200)}`);
  }

} finally {
  c.release();
  await pool.end();
}
