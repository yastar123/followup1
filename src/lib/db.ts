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

// Default initial state matching the seed data in store.tsx
const initialSeedData: DbState = {
  customers: [], // Will be populated by seeds if empty
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
    { id: "a1", name: "Rio Saputra", email: "rio@acc.co.id", role: "sales", active: true },
    { id: "a2", name: "Nadia Larasati", email: "nadia@acc.co.id", role: "sales", active: true },
    { id: "a3", name: "Admin Utama", email: "admin@acc.co.id", role: "admin", active: true },
  ],
  notes: [
    {
      id: "n1",
      title: "Catatan harian",
      body: "Prioritaskan follow up pengajuan Prioritas Dana dan Mobil Baru minggu ini.",
      by: "Sales · Rio",
      createdAt: new Date("2026-08-10T02:00:00Z").toISOString(),
      updatedAt: new Date("2026-08-10T02:00:00Z").toISOString(),
    },
  ],
  sheetUrl: "https://docs.google.com/spreadsheets/d/1ACCLeadsDemo/edit",
};

let pgClient: Client | null = null;
let isPgConnected = false;

// Check if PostgreSQL environment variables are defined and try to connect
async function getPgClient(): Promise<Client | null> {
  if (pgClient) return pgClient;

  let connectionString = process.env.DATABASE_URL || process.env.PG_CONN_STR;
  if (connectionString) {
    connectionString = connectionString.trim().replace(/^['"]|['"]$/g, "");
  }

  const pgHost = process.env.PGHOST;

  // If connectionString or pgHost is "base", it is a placeholder from the hosting platform
  const hasPostgres =
    (connectionString && connectionString !== "base" && !connectionString.includes("localhost")) ||
    (pgHost && pgHost !== "base" && pgHost !== "localhost");

  if (!hasPostgres) {
    console.log(
      "No PostgreSQL environment variables configured or using localhost on cloud environment. Running with file-based database.",
    );
    return null;
  }

  try {
    const config = connectionString
      ? { connectionString, ssl: { rejectUnauthorized: false } }
      : {
          host: pgHost,
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
          database: process.env.PGDATABASE,
          port: Number(process.env.PGPORT) || 5432,
          ssl: { rejectUnauthorized: false },
        };

    pgClient = new Client(config);
    await pgClient.connect();
    isPgConnected = true;
    console.log("Successfully connected to PostgreSQL database!");
    await initPgTables();
    return pgClient;
  } catch (err) {
    console.warn("PostgreSQL connection failed, falling back to file-based DB. Error:", err);
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
        status TEXT DEFAULT 'Prospect',
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
      await client.query(
        `INSERT INTO acc_app_state (key, value, updated_at) 
         VALUES ('full_state', $1, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
        [jsonStr],
      );
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
