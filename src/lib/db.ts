import fs from "fs";
import path from "path";
import { Client } from "pg";

export interface DbCustomer {
  id: string;
  name: string;
  phone: string;
  city: string;
  company: string;
  product: string;
  unit: string;
  segment: string;
  contractNumber: string;
  region: string;
  value: number;
  source: string;
  status: string;
  owner: string;
  note: string;
  createdAt: string;
}

export interface DbFollowUp {
  id: string;
  customerId: string;
  channel: string;
  outcome: string;
  interest: string;
  reason: string;
  nextAction: string;
  by: string;
  at: string;
}

export interface DbTemplate {
  id: string;
  name: string;
  body: string;
}

export interface DbAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

export interface DbNote {
  id: string;
  title: string;
  body: string;
  by: string;
  createdAt: string;
  updatedAt: string;
}

// Define the shape of our full-stack state
export type DbState = {
  customers: DbCustomer[];
  followUps: DbFollowUp[];
  templates: DbTemplate[];
  accounts: DbAccount[];
  notes: DbNote[];
  sheetUrl: string;
};

const DB_FILE_PATH = path.join(process.cwd(), "acc_db.json");

// Default initial state with clean database and single admin account
const initialSeedData: DbState = {
  customers: [],
  followUps: [],
  templates: [
    {
      id: "t1",
      name: "Perkenalan Awal",
      body: "Selamat pagi Bapak/Ibu {{nama}}, saya {{sales}} dari ACC (Astra Credit Companies) cabang {{cabang}}. Terkait unit {{unit}} dengan nomor kontrak {{no_kontrak}}, boleh saya bantu jelaskan program terbaru kami?",
    },
    {
      id: "t2",
      name: "Penawaran Pembiayaan Ulang",
      body: "Halo {{nama}}, kontrak {{no_kontrak}} untuk unit {{unit}} Anda di ACC sudah berjalan baik. Kami ada program pembiayaan khusus segmen {{segmen}}. Apakah berkenan saya kirimkan simulasinya?",
    },
  ],
  accounts: [
    {
      id: "a_admin",
      name: "Admin Utama",
      email: (process.env.ADMIN_EMAIL || "admin@acc.co.id").replace(/['"]/g, "").trim(),
      role: "admin",
      active: true,
    },
  ],
  notes: [],
  sheetUrl: "",
};

let pgClient: Client | null = null;
let isPgConnected = false;
let lastPgAttemptTime = 0;
const PG_RECONNECT_COOLDOWN_MS = 30000; // 30s cooldown after connection failure

// Check if PostgreSQL environment variables are defined and try to connect
async function getPgClient(): Promise<Client | null> {
  if (pgClient && isPgConnected) return pgClient;

  // Don't hammer the database on every request if recent connection attempt failed
  const now = Date.now();
  if (
    !isPgConnected &&
    lastPgAttemptTime > 0 &&
    now - lastPgAttemptTime < PG_RECONNECT_COOLDOWN_MS
  ) {
    return null;
  }

  let connectionString = process.env.DATABASE_URL || process.env.PG_CONN_STR;
  if (connectionString) {
    connectionString = connectionString.trim().replace(/^['"]|['"]$/g, "");
  }

  const pgHost = process.env.PGHOST;

  // Check if valid connection details exist
  const hasPostgres = Boolean(
    (connectionString && connectionString !== "base" && connectionString.trim().length > 0) ||
    (pgHost && pgHost !== "base" && pgHost.trim().length > 0),
  );

  if (!hasPostgres) {
    return null;
  }

  lastPgAttemptTime = now;

  try {
    const isLocal =
      connectionString?.includes("localhost") ||
      connectionString?.includes("127.0.0.1") ||
      pgHost === "localhost" ||
      pgHost === "127.0.0.1";

    const config = connectionString
      ? {
          connectionString,
          connectionTimeoutMillis: 2000,
          ssl: isLocal ? false : { rejectUnauthorized: false },
        }
      : {
          host: pgHost || "localhost",
          user: process.env.PGUSER || "postgres",
          password: process.env.PGPASSWORD || "",
          database: process.env.PGDATABASE || "postgres",
          port: Number(process.env.PGPORT) || 5432,
          connectionTimeoutMillis: 2000,
          ssl: isLocal ? false : { rejectUnauthorized: false },
        };

    const client = new Client(config);
    await client.connect();
    pgClient = client;
    isPgConnected = true;
    console.log("[Database] Connected to PostgreSQL database successfully.");
    await initPgTables();
    return pgClient;
  } catch {
    // Graceful fallback to persistent JSON storage without polluting logs
    pgClient = null;
    isPgConnected = false;
    return null;
  }
}

async function initPgTables() {
  if (!pgClient) return;
  try {
    // Create customers table
    await pgClient.query(`
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
        status TEXT DEFAULT 'Baru',
        owner TEXT DEFAULT '',
        note TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create follow_ups table
    await pgClient.query(`
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
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        body TEXT NOT NULL
      );
    `);

    // Create accounts table
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT DEFAULT 'sales',
        active BOOLEAN DEFAULT true
      );
    `);

    // Create notes table
    await pgClient.query(`
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
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS acc_app_state (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("PostgreSQL schema validated successfully.");
  } catch (err) {
    console.error("Failed to initialize PostgreSQL tables:", err);
  }
}

// Read database state
export async function readDb(): Promise<DbState> {
  const client = await getPgClient();
  if (client && isPgConnected) {
    try {
      const res = await client.query("SELECT value FROM acc_app_state WHERE key = 'full_state'");
      if (res.rows.length > 0 && res.rows[0]?.value) {
        return JSON.parse(res.rows[0].value) as DbState;
      }
      // If table is empty, write initial seed data
      await writeDb(initialSeedData);
      return initialSeedData;
    } catch (err) {
      console.error("PostgreSQL read error, falling back to local file:", err);
    }
  }

  // Fallback to local file DB
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initialSeedData, null, 2), "utf-8");
      return initialSeedData;
    }
    const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
    return JSON.parse(raw) as DbState;
  } catch (err) {
    console.error("Error reading file database:", err);
    return initialSeedData;
  }
}

// Write database state
export async function writeDb(state: DbState): Promise<boolean> {
  const client = await getPgClient();
  if (client && isPgConnected) {
    try {
      const jsonStr = JSON.stringify(state);
      // 1. Update master state table
      await client.query(
        `INSERT INTO acc_app_state (key, value, updated_at) 
         VALUES ('full_state', $1, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
        [jsonStr],
      );

      // 2. Also sync to individual relational tables
      if (Array.isArray(state.customers)) {
        for (const c of state.customers) {
          await client.query(
            `INSERT INTO customers (id, name, phone, city, company, product, unit, segment, contract_number, region, value, source, status, owner, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               phone = EXCLUDED.phone,
               city = EXCLUDED.city,
               company = EXCLUDED.company,
               product = EXCLUDED.product,
               unit = EXCLUDED.unit,
               segment = EXCLUDED.segment,
               contract_number = EXCLUDED.contract_number,
               region = EXCLUDED.region,
               value = EXCLUDED.value,
               source = EXCLUDED.source,
               status = EXCLUDED.status,
               owner = EXCLUDED.owner,
               note = EXCLUDED.note`,
            [
              c.id,
              c.name,
              c.phone,
              c.city || "",
              c.company || "",
              c.product || "",
              c.unit || "",
              c.segment || "",
              c.contractNumber || "",
              c.region || "",
              c.value || 0,
              c.source || "",
              c.status || "Baru",
              c.owner || "",
              c.note || "",
            ],
          );
        }
      }

      if (Array.isArray(state.accounts)) {
        for (const a of state.accounts) {
          await client.query(
            `INSERT INTO accounts (id, name, email, role, active)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               email = EXCLUDED.email,
               role = EXCLUDED.role,
               active = EXCLUDED.active`,
            [a.id, a.name, a.email, a.role, a.active],
          );
        }
      }

      if (Array.isArray(state.templates)) {
        for (const t of state.templates) {
          await client.query(
            `INSERT INTO templates (id, name, body)
             VALUES ($1, $2, $3)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               body = EXCLUDED.body`,
            [t.id, t.name, t.body],
          );
        }
      }

      return true;
    } catch (err) {
      console.error("PostgreSQL write error, falling back to local file:", err);
    }
  }

  // Fallback to local file DB
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(state, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error writing to file database:", err);
    return false;
  }
}

export function getDbStatus(): { connected: boolean; type: "PostgreSQL" | "File System" } {
  return {
    connected: isPgConnected,
    type: isPgConnected ? "PostgreSQL" : "File System",
  };
}
