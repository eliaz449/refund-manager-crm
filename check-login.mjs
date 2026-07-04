import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

const pool = new Pool({
  host: "trolley.proxy.rlwy.net",
  port: 50633,
  user: "postgres",
  password: "fzJmujFMZwrmWMjMVaWQtrCEaaEgMTWd",
  database: "railway",
  ssl: false,
});

const EMAIL = "eliazasulin@gmail.com";
const NEW_PASSWORD = "Admin2026";

async function main() {
  const client = await pool.connect();
  try {
    // Check current user
    const res = await client.query(
      "SELECT id, email, role, password_hash FROM users WHERE email = $1",
      [EMAIL]
    );

    if (res.rows.length === 0) {
      console.log("❌ User not found in DB!");
      return;
    }

    const user = res.rows[0];
    console.log("✅ User found:", user.email, "| role:", user.role);
    console.log("   Hash in DB:", user.password_hash?.substring(0, 30) + "...");

    // Test known passwords
    const passwords = ["TaxPro2026!", "Eliaz2026!", "Admin2026"];
    for (const pw of passwords) {
      const match = await bcrypt.compare(pw, user.password_hash);
      console.log(`   "${pw}" matches: ${match ? "✅ YES" : "❌ no"}`);
    }

    // Reset to known password
    console.log(`\n🔄 Resetting password to "${NEW_PASSWORD}"...`);
    const newHash = await bcrypt.hash(NEW_PASSWORD, 12);
    await client.query("UPDATE users SET password_hash = $1 WHERE email = $2", [
      newHash,
      EMAIL,
    ]);
    console.log("✅ Password reset done.");

    // Verify
    const verify = await bcrypt.compare(NEW_PASSWORD, newHash);
    console.log(`✅ Verification: "${NEW_PASSWORD}" matches new hash: ${verify}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
