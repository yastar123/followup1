import { Client } from "pg";
import fs from "fs";
import path from "path";

async function runDbPush() {
  console.log("🚀 Starting PostgreSQL DB Push Script...");

  const connectionString = process.env.DATABASE_URL || process.env.PG_CONN_STR;
  const config = connectionString
    ? {
        connectionString,
        ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
      }
    : {
        host: process.env.PGHOST || "localhost",
        user: process.env.PGUSER || "postgres",
        password: process.env.PGPASSWORD || "postgres",
        database: process.env.PGDATABASE || "acc_db",
        port: Number(process.env.PGPORT) || 5432,
        ssl: false,
      };

  console.log(`Connecting to PostgreSQL at ${config.host || "DATABASE_URL"}...`);

  const client = new Client(config);

  try {
    await client.connect();
    console.log("✅ Successfully connected to PostgreSQL!");

    // Create customers table
    console.log("Pushing table: customers...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        city TEXT DEFAULT '',
        company TEXT DEFAULT '',
        product TEXT DEFAULT '',
        unit TEXT DEFAULT '',
        segment TEXT DEFAULT '',
        contract_number TEXT DEFAULT '',
        region TEXT DEFAULT '',
        value INTEGER DEFAULT 0,
        source TEXT DEFAULT '',
        status TEXT DEFAULT 'Prospect',
        owner TEXT DEFAULT '',
        note TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create follow_ups table
    console.log("Pushing table: follow_ups...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS follow_ups (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        channel TEXT DEFAULT 'WhatsApp',
        outcome TEXT DEFAULT '',
        interest TEXT DEFAULT '',
        reason TEXT DEFAULT '',
        next_action TEXT DEFAULT '',
        by TEXT DEFAULT '',
        at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create templates table
    console.log("Pushing table: templates...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        body TEXT NOT NULL
      );
    `);

    // Create accounts table
    console.log("Pushing table: accounts...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT DEFAULT 'sales',
        active BOOLEAN DEFAULT true
      );
    `);

    // Create notes table
    console.log("Pushing table: notes...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        by TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create acc_app_state table
    console.log("Pushing table: acc_app_state...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS acc_app_state (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✨ All tables created/verified successfully!");

    // Check if initial JSON data exists to seed into PostgreSQL
    const jsonPath = path.join(process.cwd(), "acc_db.json");
    if (fs.existsSync(jsonPath)) {
      console.log("Found acc_db.json. Syncing seed state to acc_app_state table...");
      const rawData = fs.readFileSync(jsonPath, "utf-8");
      await client.query(
        `INSERT INTO acc_app_state (key, value, updated_at)
         VALUES ('full_state', $1, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
        [rawData],
      );
      console.log("✅ acc_db.json data successfully pushed & synced to PostgreSQL!");
    }
  } catch (err) {
    console.error("❌ DB Push Error:", err);
  } finally {
    await client.end();
    console.log("🔒 Closed PostgreSQL connection.");
  }
}

runDbPush();
