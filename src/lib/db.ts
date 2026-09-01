import fs from "fs";
import path from "path";
import { Client } from "pg";

export interface DbCustomer {
  id: string;
  name: string; // NAMA
  contractNumber: string; // NO KONTRAK
  phone: string; // NO TLP
  postalCode?: string; // KODE POST
  mod?: string; // MOD
  unitType?: string; // TYPE UNIT
  year?: string; // TAHUN
  contractStatus?: string; // STATUS
  segment?: string; // SEGMENTASI
  handling?: string; // HANDLING
  city?: string;
  company?: string;
  product?: string;
  unit?: string;
  region?: string;
  value?: number;
  source?: string;
  status?: string;
  owner?: string;
  note?: string;
  createdAt?: string;
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

// Default clean initial state with zero dummy customers / followups
export const initialCleanState: DbState = {
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
const PG_RECONNECT_COOLDOWN_MS = 15000;

// Check if PostgreSQL environment variables are defined and try to connect
export async function getPgClient(): Promise<Client | null> {
  if (pgClient && isPgConnected) return pgClient;

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
          connectionTimeoutMillis: 3000,
          ssl: isLocal ? false : { rejectUnauthorized: false },
        }
      : {
          host: pgHost || "localhost",
          user: process.env.PGUSER || "postgres",
          password: process.env.PGPASSWORD || "",
          database: process.env.PGDATABASE || "postgres",
          port: Number(process.env.PGPORT) || 5432,
          connectionTimeoutMillis: 3000,
          ssl: isLocal ? false : { rejectUnauthorized: false },
        };

    const client = new Client(config);
    await client.connect();
    pgClient = client;
    isPgConnected = true;
    console.log("[Database] Connected to PostgreSQL database successfully.");
    await initPgTables();
    return pgClient;
  } catch (err) {
    pgClient = null;
    isPgConnected = false;
    return null;
  }
}

export async function initPgTables() {
  if (!pgClient) return;
  try {
    // 1. Create customers table with all 10 attributes
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        contract_number TEXT DEFAULT '',
        phone TEXT NOT NULL,
        postal_code TEXT DEFAULT '',
        mod TEXT DEFAULT '',
        unit_type TEXT DEFAULT '',
        year TEXT DEFAULT '',
        contract_status TEXT DEFAULT '',
        segment TEXT DEFAULT '',
        handling TEXT DEFAULT '',
        city TEXT DEFAULT '',
        company TEXT DEFAULT '',
        product TEXT DEFAULT '',
        unit TEXT DEFAULT '',
        region TEXT DEFAULT '',
        value INTEGER DEFAULT 0,
        source TEXT DEFAULT '',
        status TEXT DEFAULT 'Baru',
        owner TEXT DEFAULT '',
        note TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure columns exist if table was previously created with older schema
    const alterCols = [
      "ALTER TABLE customers ADD COLUMN IF NOT EXISTS postal_code TEXT DEFAULT ''",
      "ALTER TABLE customers ADD COLUMN IF NOT EXISTS mod TEXT DEFAULT ''",
      "ALTER TABLE customers ADD COLUMN IF NOT EXISTS unit_type TEXT DEFAULT ''",
      "ALTER TABLE customers ADD COLUMN IF NOT EXISTS year TEXT DEFAULT ''",
      "ALTER TABLE customers ADD COLUMN IF NOT EXISTS contract_status TEXT DEFAULT ''",
      "ALTER TABLE customers ADD COLUMN IF NOT EXISTS handling TEXT DEFAULT ''",
    ];
    for (const sql of alterCols) {
      try {
        await pgClient.query(sql);
      } catch {
        /* ignore column already exists */
      }
    }

    // 2. Create follow_ups table
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

    // 3. Create templates table
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        body TEXT NOT NULL
      );
    `);

    // 4. Create accounts table
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT DEFAULT 'sales',
        active BOOLEAN DEFAULT true
      );
    `);

    // 5. Create notes table
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

    // 6. Create acc_app_state table for synchronized snapshots
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS acc_app_state (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("[PostgreSQL] Tables & schemas validated successfully.");
  } catch (err) {
    console.error("[PostgreSQL] Failed to initialize PostgreSQL tables:", err);
  }
}

// Read database state
export async function readDb(): Promise<DbState> {
  const client = await getPgClient();
  if (client && isPgConnected) {
    try {
      const res = await client.query("SELECT value FROM acc_app_state WHERE key = 'full_state'");
      if (res.rows.length > 0 && res.rows[0]?.value) {
        const parsed = JSON.parse(res.rows[0].value) as DbState;
        return {
          ...initialCleanState,
          ...parsed,
          customers: Array.isArray(parsed.customers) ? parsed.customers : [],
          followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
          notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        };
      }
      // If table is empty, write initial clean data
      await writeDb(initialCleanState);
      return initialCleanState;
    } catch (err) {
      console.error("PostgreSQL read error, falling back to local file:", err);
    }
  }

  // Fallback to local file DB
  try {
    if (!fs.existsSync(DB_FILE_PATH)) {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initialCleanState, null, 2), "utf-8");
      return initialCleanState;
    }
    const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as DbState;
    return {
      ...initialCleanState,
      ...parsed,
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch (err) {
    console.error("Error reading file database:", err);
    return initialCleanState;
  }
}

// Write database state
export async function writeDb(state: DbState): Promise<boolean> {
  const client = await getPgClient();
  if (client && isPgConnected) {
    try {
      await client.query("BEGIN");
      const jsonStr = JSON.stringify(state);
      // 1. Update master state table
      await client.query(
        `INSERT INTO acc_app_state (key, value, updated_at) 
         VALUES ('full_state', $1, CURRENT_TIMESTAMP)
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
        [jsonStr],
      );

      // 2. Sync to individual relational tables
      if (Array.isArray(state.customers)) {
        // Clear removed customers or sync full list
        const customerIds = state.customers.map((c) => c.id);
        if (customerIds.length === 0) {
          await client.query("DELETE FROM customers");
        } else {
          await client.query("DELETE FROM customers WHERE NOT (id = ANY($1::text[]))", [
            customerIds,
          ]);
        }

        for (const c of state.customers) {
          await client.query(
            `INSERT INTO customers (
               id, name, contract_number, phone, postal_code, mod, unit_type, year, contract_status, segment, handling,
               city, company, product, unit, region, value, source, status, owner, note
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               contract_number = EXCLUDED.contract_number,
               phone = EXCLUDED.phone,
               postal_code = EXCLUDED.postal_code,
               mod = EXCLUDED.mod,
               unit_type = EXCLUDED.unit_type,
               year = EXCLUDED.year,
               contract_status = EXCLUDED.contract_status,
               segment = EXCLUDED.segment,
               handling = EXCLUDED.handling,
               city = EXCLUDED.city,
               company = EXCLUDED.company,
               product = EXCLUDED.product,
               unit = EXCLUDED.unit,
               region = EXCLUDED.region,
               value = EXCLUDED.value,
               source = EXCLUDED.source,
               status = EXCLUDED.status,
               owner = EXCLUDED.owner,
               note = EXCLUDED.note`,
            [
              c.id,
              c.name,
              c.contractNumber || "",
              c.phone,
              c.postalCode || "",
              c.mod || "",
              c.unitType || "",
              c.year || "",
              c.contractStatus || "",
              c.segment || "",
              c.handling || "",
              c.city || "",
              c.company || "",
              c.product || "",
              c.unit || "",
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

      if (Array.isArray(state.followUps)) {
        const followUpIds = state.followUps.map((f) => f.id);
        if (followUpIds.length === 0) {
          await client.query("DELETE FROM follow_ups");
        } else {
          await client.query("DELETE FROM follow_ups WHERE NOT (id = ANY($1::text[]))", [
            followUpIds,
          ]);
        }

        for (const f of state.followUps) {
          await client.query(
            `INSERT INTO follow_ups (id, customer_id, channel, outcome, interest, reason, next_action, by, at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET
               customer_id = EXCLUDED.customer_id,
               channel = EXCLUDED.channel,
               outcome = EXCLUDED.outcome,
               interest = EXCLUDED.interest,
               reason = EXCLUDED.reason,
               next_action = EXCLUDED.next_action,
               by = EXCLUDED.by,
               at = EXCLUDED.at`,
            [
              f.id,
              f.customerId,
              f.channel || "WhatsApp",
              f.outcome || "",
              f.interest || "",
              f.reason || "",
              f.nextAction || "",
              f.by || "",
              f.at || new Date().toISOString(),
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

      if (Array.isArray(state.notes)) {
        for (const n of state.notes) {
          await client.query(
            `INSERT INTO notes (id, title, content, by, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               title = EXCLUDED.title,
               content = EXCLUDED.content,
               by = EXCLUDED.by,
               updated_at = EXCLUDED.updated_at`,
            [
              n.id,
              n.title,
              n.content,
              n.by,
              n.createdAt || new Date().toISOString(),
              n.updatedAt || new Date().toISOString(),
            ],
          );
        }
      }

      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
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

export function getDbStatus(): {
  connected: boolean;
  type: "PostgreSQL" | "File System";
  details?: string;
} {
  return {
    connected: isPgConnected,
    type: isPgConnected ? "PostgreSQL" : "File System",
    details: isPgConnected
      ? "Terhubung ke database PostgreSQL aktif"
      : "Mode penyimpanan lokal / fallback aktif",
  };
}
