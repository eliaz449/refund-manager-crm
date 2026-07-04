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

const client = await pool.connect();
try {
  console.log("=== Recent webhook_events (last 5 days) ===");
  const events = await client.query(`
    SELECT id, received_at, source, auth_status, processing_status, error_message, created_client_id,
           (normalized_payload::jsonb)->>'full_name' as name,
           (normalized_payload::jsonb)->>'phone' as phone
    FROM webhook_events
    WHERE received_at > NOW() - INTERVAL '5 days'
    ORDER BY received_at DESC
    LIMIT 50
  `);
  console.log(`Found ${events.rowCount} events`);
  for (const e of events.rows) {
    const ts = e.received_at.toISOString().replace('T', ' ').substring(0, 19);
    console.log(`  [${ts}] src=${e.source} auth=${e.auth_status} proc=${e.processing_status} client_id=${e.created_client_id || '-'} name="${e.name || '?'}" phone=${e.phone || '?'} ${e.error_message ? '| ERR=' + e.error_message : ''}`);
  }

  console.log("\n=== Recent clients (last 5 days) ===");
  const clients = await client.query(`
    SELECT id, created_at, full_name, phone, source, status, lead_status
    FROM clients
    WHERE created_at > NOW() - INTERVAL '5 days'
    ORDER BY created_at DESC
    LIMIT 50
  `);
  console.log(`Found ${clients.rowCount} clients`);
  for (const c of clients.rows) {
    const ts = c.created_at.toISOString().replace('T', ' ').substring(0, 19);
    console.log(`  [${ts}] id=${c.id} ${c.full_name} | ${c.phone} | src=${c.source || '-'} status=${c.status} lead=${c.lead_status || '-'}`);
  }

  console.log("\n=== WhatsApp / notifications log (last 5 days) ===");
  const notifs = await client.query(`
    SELECT id, created_at, date, type, client_id, content
    FROM communication_logs
    WHERE created_at > NOW() - INTERVAL '5 days'
    ORDER BY created_at DESC
    LIMIT 50
  `);
  console.log(`Found ${notifs.rowCount} communication logs`);
  for (const n of notifs.rows) {
    const ts = n.created_at.toISOString().replace('T', ' ').substring(0, 19);
    const preview = (n.content || '').substring(0, 60).replace(/\n/g, ' ');
    console.log(`  [${ts}] type=${n.type} client=${n.client_id || '-'} | ${preview}`);
  }

  console.log("\n=== Summary by day ===");
  const summary = await client.query(`
    SELECT
      DATE(received_at) as day,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE auth_status='ok') as auth_ok,
      COUNT(*) FILTER (WHERE processing_status='ok') as proc_ok,
      COUNT(*) FILTER (WHERE created_client_id IS NOT NULL) as client_created
    FROM webhook_events
    WHERE received_at > NOW() - INTERVAL '14 days'
    GROUP BY DATE(received_at)
    ORDER BY day DESC
  `);
  for (const s of summary.rows) {
    console.log(`  ${s.day.toISOString().substring(0,10)}: total=${s.total}, auth_ok=${s.auth_ok}, proc_ok=${s.proc_ok}, client_created=${s.client_created}`);
  }

} finally {
  client.release();
  await pool.end();
}
