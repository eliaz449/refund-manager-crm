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

async function main() {
  const client = await pool.connect();
  try {
    // Check if session table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'session'
      ) as exists
    `);
    console.log("Session table exists:", tableCheck.rows[0].exists);

    if (tableCheck.rows[0].exists) {
      const sessions = await client.query("SELECT COUNT(*) FROM session");
      console.log("Session count:", sessions.rows[0].count);
    } else {
      console.log("❌ Session table is MISSING - this is why login fails!");
      console.log("Creating session table...");
      await client.query(`
        CREATE TABLE IF NOT EXISTS "session" (
          "sid" varchar NOT NULL COLLATE "default",
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL
        )
        WITH (OIDS=FALSE);
        ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
        CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
      `);
      console.log("✅ Session table created!");
    }

    // List all tables
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    console.log("\nAll tables in DB:");
    tables.rows.forEach(r => console.log(" -", r.table_name));

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
