import { Client } from "pg";
import bcrypt from "bcryptjs";
export { normalizeOwner } from "./utils";
import { normalizeOwner } from "./utils";

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
  role: "admin" | "sales";
  active: boolean;
  password?: string;
  phone?: string;
  note?: string;
  createdAt?: string;
}

export type DbAccountPublic = Omit<DbAccount, "password">;

export interface DbNote {
  id: string;
  title: string;
  body: string;
  by: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbSession {
  token: string;
  accountId: string;
  role: "admin" | "sales";
  name: string;
  email: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Custom Error classes terklasifikasi untuk aplikasi
 */
export class DatabaseUnavailableError extends Error {
  constructor(message = "Layanan database sedang tidak tersedia.") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export class ConflictError extends Error {
  constructor(message = "Data sudah ada atau sudah digunakan.") {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  constructor(message = "Data yang dikirim tidak valid.") {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Helper untuk mendeteksi apakah suatu error merupakan error koneksi database
 * (bukan error logika query, syntax error, atau constraint violation).
 */
export function isConnectionError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof DatabaseUnavailableError) return true;

  const anyErr = err as { code?: string; message?: string };
  const code = typeof anyErr.code === "string" ? anyErr.code : "";
  const msg = typeof anyErr.message === "string" ? anyErr.message : "";

  // 1. Kode jaringan Node.js
  const nodeNetworkCodes = [
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ECONNRESET",
    "EPIPE",
    "ENOTFOUND",
    "ENETUNREACH",
    "EHOSTUNREACH",
  ];
  if (nodeNetworkCodes.includes(code)) {
    return true;
  }

  // 2. Kode pg berawalan "08" (Connection Exception)
  if (code.startsWith("08")) {
    return true;
  }

  // 3. Kode pg spesifik shutdown / limit koneksi
  if (
    code === "57P01" || // admin_shutdown
    code === "57P02" || // crash_shutdown
    code === "57P03" || // cannot_connect_now
    code === "53300" // too_many_connections
  ) {
    return true;
  }

  // 4. Deteksi dari pesan error umum koneksi
  const lowerMsg = msg.toLowerCase();
  if (
    lowerMsg.includes("connection terminated") ||
    lowerMsg.includes("terminating connection") ||
    lowerMsg.includes("timeout exceeded when trying to connect") ||
    lowerMsg.includes("client has encountered a connection error") ||
    lowerMsg.includes("connection closed")
  ) {
    return true;
  }

  return false;
}

export const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@acc.co.id")
  .replace(/['"]/g, "")
  .trim();
export const DEFAULT_ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "password123")
  .replace(/['"]/g, "")
  .trim();

let pgClient: Client | null = null;
let isPgConnected = false;
let lastPgAttemptTime = 0;
const PG_RECONNECT_COOLDOWN_MS = 10000;

export function getIsPgConnected(): boolean {
  return isPgConnected;
}

export function setIsPgConnectedForTesting(val: boolean) {
  isPgConnected = val;
  if (!val) {
    pgClient = null;
  }
}

/**
 * Helper terpusat untuk menangani error dari query PostgreSQL:
 * - Jika connection error: set isPgConnected = false, pgClient = null, lempar DatabaseUnavailableError
 * - Jika constraint error 23505 (unique_violation): lempar ConflictError (HTTP 409)
 * - Jika constraint error 23503 (foreign_key) / 23514 (check): lempar ValidationError (HTTP 400)
 * - Selain itu: lempar error aslinya (re-throw) tanpa mengubah isPgConnected
 */
export function handleDbError(err: unknown, context = "query"): never {
  if (isConnectionError(err)) {
    console.error(`[PostgreSQL] Connection failure in ${context}:`, err);
    isPgConnected = false;
    pgClient = null;
    throw new DatabaseUnavailableError("Layanan database sedang tidak tersedia.");
  }

  const anyErr = err as { code?: string };
  if (anyErr?.code === "23505") {
    console.warn(`[PostgreSQL] Unique violation (23505) in ${context}:`, err);
    throw new ConflictError("Data sudah ada atau sudah digunakan.");
  }

  if (anyErr?.code === "23503" || anyErr?.code === "23514") {
    console.warn(`[PostgreSQL] Constraint violation (${anyErr.code}) in ${context}:`, err);
    throw new ValidationError("Data tidak valid atau referensi tidak ditemukan.");
  }

  console.error(`[PostgreSQL] Query error in ${context}:`, err);
  throw err;
}

export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

export async function verifyPassword(
  plainText: string,
  hashedOrPlain: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!hashedOrPlain || !plainText) return { valid: false, needsRehash: false };

  const normalizedHashed = String(hashedOrPlain).trim();
  const normalizedPlain = String(plainText).trim();

  // Reject dangerous placeholders and default values
  if (
    normalizedHashed === "placeholder_not_used" ||
    normalizedHashed === "password123" ||
    normalizedPlain === "placeholder_not_used" ||
    normalizedPlain === "password123"
  ) {
    return { valid: false, needsRehash: false };
  }

  // Check if it's already a bcrypt hash
  const isBcrypt =
    normalizedHashed.startsWith("$2a$") ||
    normalizedHashed.startsWith("$2b$") ||
    normalizedHashed.startsWith("$2y$");

  if (isBcrypt) {
    const valid = await bcrypt.compare(plainText, normalizedHashed);
    return { valid, needsRehash: false };
  }

  // Legacy plaintext match (only for safe passwords >= 12 chars)
  if (normalizedHashed === normalizedPlain && normalizedPlain.length >= 12) {
    return { valid: true, needsRehash: true };
  }

  return { valid: false, needsRehash: false };
}

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
          connectionTimeoutMillis: 4000,
          ssl: isLocal ? false : { rejectUnauthorized: false },
        }
      : {
          host: pgHost || "localhost",
          user: process.env.PGUSER || "postgres",
          password: process.env.PGPASSWORD || "",
          database: process.env.PGDATABASE || "postgres",
          port: Number(process.env.PGPORT) || 5432,
          connectionTimeoutMillis: 4000,
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
    pgClient = null;
    isPgConnected = false;
    return null;
  }
}

async function requirePgClient(): Promise<Client> {
  const client = await getPgClient();
  if (!client || !isPgConnected) {
    throw new DatabaseUnavailableError("Layanan database sedang tidak tersedia.");
  }
  return client;
}

export async function cleanExpiredSessions(): Promise<number> {
  const client = await getPgClient();
  if (!client || !isPgConnected) return 0;
  try {
    const res = await client.query("DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP");
    const count = res.rowCount ?? 0;
    if (count > 0) {
      console.log(`[Session] Cleaned up ${count} expired sessions.`);
    }
    return count;
  } catch (err) {
    console.error("[Session] Error cleaning expired sessions:", err);
    return 0;
  }
}

// Inisialisasi interval pembersihan sesi kedaluwarsa berkala setiap 6 jam
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const sessionCleanupTimer = setInterval(() => {
  cleanExpiredSessions().catch((err) => {
    console.error("[Session Cleanup Timer] Unexpected error:", err);
  });
}, CLEANUP_INTERVAL_MS);
sessionCleanupTimer.unref?.();

export async function initPgTables() {
  if (!pgClient) return;
  try {
    // 1. Create customers table
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

    // Indexes for high performance searches and role-based filtering
    await pgClient.query(`
      CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(owner);
      CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
      CREATE INDEX IF NOT EXISTS idx_customers_contract ON customers(contract_number);
    `);

    // Ensure columns exist for backward compatibility
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
        /* ignore */
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
      CREATE INDEX IF NOT EXISTS idx_follow_ups_customer ON follow_ups(customer_id);
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
        email TEXT NOT NULL UNIQUE,
        role TEXT DEFAULT 'sales',
        active BOOLEAN DEFAULT true,
        password TEXT NOT NULL,
        phone TEXT DEFAULT '',
        note TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Create sessions table for secure server-side sessions
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        role TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    `);

    // 6. Create notes table
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

    // Seed default admin if accounts table is empty (NEVER OVERWRITES EXISTING ACCOUNTS)
    const checkAcc = await pgClient.query("SELECT COUNT(*) as count FROM accounts");
    const accCount = parseInt(checkAcc.rows[0]?.count || "0", 10);
    if (accCount === 0) {
      const hashedAdminPw = await hashPassword(DEFAULT_ADMIN_PASSWORD);
      await pgClient.query(
        `INSERT INTO accounts (id, name, email, role, active, password)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        ["a_admin", "Admin Utama", DEFAULT_ADMIN_EMAIL, "admin", true, hashedAdminPw],
      );
      console.log(`[PostgreSQL] Initialized default admin account: ${DEFAULT_ADMIN_EMAIL}`);
    }

    // Seed default templates if templates table is empty
    const checkTmpl = await pgClient.query("SELECT COUNT(*) as count FROM templates");
    const tmplCount = parseInt(checkTmpl.rows[0]?.count || "0", 10);
    if (tmplCount === 0) {
      await pgClient.query(`
        INSERT INTO templates (id, name, body) VALUES
        ('t1', 'Perkenalan Awal', 'Selamat pagi Bapak/Ibu {{nama}}, saya {{sales}} dari ACC (Astra Credit Companies) cabang {{cabang}}. Terkait unit {{unit}} dengan nomor kontrak {{no_kontrak}}, boleh saya bantu jelaskan program terbaru kami?'),
        ('t2', 'Penawaran Pembiayaan Ulang', 'Halo {{nama}}, kontrak {{no_kontrak}} untuk unit {{unit}} Anda di ACC sudah berjalan baik. Kami ada program pembiayaan khusus segmen {{segmen}}. Apakah berkenan saya kirimkan simulasinya?')
        ON CONFLICT (id) DO NOTHING;
      `);
    }

    // Pembersihan sesi kadaluarsa awal saat database siap
    await cleanExpiredSessions();

    console.log("[PostgreSQL] Tables & schemas validated safely without data modification.");
  } catch (err) {
    console.error("[PostgreSQL] Error initializing PostgreSQL schemas:", err);
  }
}

// ---------------------------------------------------------
// SESSION MANAGEMENT (Server-Side Session Store - Database Only)
// ---------------------------------------------------------
export async function createSession(
  account: DbAccount,
  durationMs = 7 * 24 * 60 * 60 * 1000,
): Promise<DbSession> {
  const token =
    Math.random().toString(36).substring(2) +
    Date.now().toString(36) +
    Math.random().toString(36).substring(2);
  const expiresAt = new Date(Date.now() + durationMs).toISOString();
  const createdAt = new Date().toISOString();

  const session: DbSession = {
    token,
    accountId: account.id,
    role: account.role as "admin" | "sales",
    name: account.name,
    email: account.email,
    expiresAt,
    createdAt,
  };

  const client = await requirePgClient();
  try {
    await client.query(
      `INSERT INTO sessions (token, account_id, role, name, email, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [token, session.accountId, session.role, session.name, session.email, expiresAt, createdAt],
    );
    return session;
  } catch (err) {
    handleDbError(err, "createSession");
  }
}

export async function getSession(token: string): Promise<DbSession | null> {
  if (!token) return null;

  const client = await requirePgClient();
  try {
    const res = await client.query(
      `SELECT token, account_id as "accountId", role, name, email,
              expires_at as "expiresAt", created_at as "createdAt"
       FROM sessions
       WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [token],
    );
    if (res.rows.length > 0) {
      return res.rows[0] as DbSession;
    }
    return null;
  } catch (err) {
    handleDbError(err, "getSession");
  }
}

export async function deleteSession(token: string): Promise<void> {
  if (!token) return;
  const client = await requirePgClient();
  try {
    await client.query("DELETE FROM sessions WHERE token = $1", [token]);
  } catch (err) {
    handleDbError(err, "deleteSession");
  }
}

// ---------------------------------------------------------
// CUSTOMERS (GRANULAR & SAFE UPSERT OPERATIONS ONLY)
// ---------------------------------------------------------

export async function getCustomers(options?: {
  owner?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ customers: DbCustomer[]; total: number }> {
  const client = await requirePgClient();
  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    if (options?.owner && options.owner.trim()) {
      const norm = normalizeOwner(options.owner);
      if (norm === "belum ditugaskan") {
        conditions.push(`(
          owner IS NULL OR
          TRIM(owner) = '' OR
          LOWER(TRIM(owner)) = 'belum ditugaskan' OR
          LOWER(TRIM(owner)) = '-'
        )`);
      } else {
        conditions.push(
          `LOWER(TRIM(REGEXP_REPLACE(owner, '^\\s*Sales\\s*[·•\\-\\.\\:\\s]\\s*', '', 'i'))) = $${pIdx++}`,
        );
        params.push(norm);
      }
    }

    if (options?.search && options.search.trim()) {
      const term = `%${options.search.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER(name) LIKE $${pIdx} OR
        LOWER(contract_number) LIKE $${pIdx} OR
        LOWER(phone) LIKE $${pIdx} OR
        LOWER(city) LIKE $${pIdx}
      )`);
      params.push(term);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await client.query(
      `SELECT COUNT(*) as count FROM customers ${whereClause}`,
      params,
    );
    const total = parseInt(countRes.rows[0]?.count || "0", 10);

    let query = `
      SELECT 
        id, name, contract_number as "contractNumber", phone, postal_code as "postalCode",
        mod, unit_type as "unitType", year, contract_status as "contractStatus",
        segment, handling, city, company, product, unit, region, value, source,
        status, owner, note, created_at as "createdAt"
      FROM customers
      ${whereClause}
      ORDER BY created_at DESC
    `;

    if (options?.limit && options.limit > 0) {
      query += ` LIMIT $${pIdx++}`;
      params.push(options.limit);
      if (options?.offset && options.offset > 0) {
        query += ` OFFSET $${pIdx++}`;
        params.push(options.offset);
      }
    }

    const res = await client.query(query, params);
    const customers: DbCustomer[] = res.rows.map((r) => ({
      ...r,
      value: Number(r.value) || 0,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    }));

    return { customers, total };
  } catch (err) {
    handleDbError(err, "getCustomers");
  }
}

export async function getCustomerById(
  id: string,
  ownerFilter?: string,
): Promise<DbCustomer | null> {
  if (!id) return null;
  const client = await requirePgClient();
  try {
    let query = `
      SELECT 
        id, name, contract_number as "contractNumber", phone, postal_code as "postalCode",
        mod, unit_type as "unitType", year, contract_status as "contractStatus",
        segment, handling, city, company, product, unit, region, value, source,
        status, owner, note, created_at as "createdAt"
      FROM customers
      WHERE id = $1
    `;
    const params: unknown[] = [id];
    if (ownerFilter && ownerFilter.trim()) {
      const norm = normalizeOwner(ownerFilter);
      if (norm === "belum ditugaskan") {
        query += ` AND (
          owner IS NULL OR
          TRIM(owner) = '' OR
          LOWER(TRIM(owner)) = 'belum ditugaskan' OR
          LOWER(TRIM(owner)) = '-'
        )`;
      } else {
        query += ` AND LOWER(TRIM(REGEXP_REPLACE(owner, '^\\s*Sales\\s*[·•\\-\\.\\:\\s]\\s*', '', 'i'))) = $2`;
        params.push(norm);
      }
    }
    const res = await client.query(query, params);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      value: Number(r.value) || 0,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    };
  } catch (err) {
    handleDbError(err, "getCustomerById");
  }
}

export async function upsertCustomer(customer: DbCustomer): Promise<DbCustomer> {
  const client = await requirePgClient();
  try {
    await client.query(
      `INSERT INTO customers (
         id, name, contract_number, phone, postal_code, mod, unit_type, year,
         contract_status, segment, handling, city, company, product, unit,
         region, value, source, status, owner, note
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
        customer.id,
        customer.name || "",
        customer.contractNumber || "",
        customer.phone || "",
        customer.postalCode || "",
        customer.mod || "",
        customer.unitType || "",
        customer.year || "",
        customer.contractStatus || "",
        customer.segment || "",
        customer.handling || "",
        customer.city || "",
        customer.company || "",
        customer.product || "",
        customer.unit || "",
        customer.region || "",
        customer.value || 0,
        customer.source || "",
        customer.status || "Baru",
        customer.owner || "",
        customer.note || "",
      ],
    );
    return customer;
  } catch (err) {
    handleDbError(err, "upsertCustomer");
  }
}

// Batch import customers: strictly UPSERT ONLY in chunks of 1000 per transaction
export async function upsertCustomersBatch(
  customers: DbCustomer[],
): Promise<{ insertedOrUpdated: number }> {
  if (!customers || customers.length === 0) {
    return { insertedOrUpdated: 0 };
  }

  const client = await requirePgClient();
  const CHUNK_SIZE = 1000;
  let processed = 0;

  for (let i = 0; i < customers.length; i += CHUNK_SIZE) {
    const chunk = customers.slice(i, i + CHUNK_SIZE);
    await client.query("BEGIN");
    try {
      const valueTuples: string[] = [];
      const params: unknown[] = [];
      let pIdx = 1;

      for (const c of chunk) {
        valueTuples.push(
          `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`,
        );
        params.push(
          c.id,
          c.name || "",
          c.contractNumber || "",
          c.phone || "",
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
        );
      }

      if (valueTuples.length > 0) {
        await client.query(
          `INSERT INTO customers (
             id, name, contract_number, phone, postal_code, mod, unit_type, year, contract_status, segment, handling,
             city, company, product, unit, region, value, source, status, owner, note
           )
           VALUES ${valueTuples.join(", ")}
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
          params,
        );
      }
      await client.query("COMMIT");
      processed += chunk.length;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      handleDbError(err, "upsertCustomersBatch");
    }
  }
  return { insertedOrUpdated: processed };
}

// Explicit single customer deletion
export async function deleteCustomerById(id: string): Promise<boolean> {
  if (!id) return false;
  const client = await requirePgClient();
  try {
    await client.query("DELETE FROM follow_ups WHERE customer_id = $1", [id]);
    const res = await client.query("DELETE FROM customers WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  } catch (err) {
    handleDbError(err, "deleteCustomerById");
  }
}

// Explicit batch customer deletion (Admin only, chunked in batches of 1000, up to 5000 IDs)
export async function deleteCustomersBatch(ids: string[]): Promise<number> {
  if (!ids || ids.length === 0) return 0;
  if (ids.length > 5000) {
    throw new ValidationError("Maksimal 5000 customer per permintaan penghapusan.");
  }

  const client = await requirePgClient();
  const CHUNK_SIZE = 1000;
  let totalDeleted = 0;

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    await client.query("BEGIN");
    try {
      await client.query("DELETE FROM follow_ups WHERE customer_id = ANY($1::text[])", [chunk]);
      const res = await client.query("DELETE FROM customers WHERE id = ANY($1::text[])", [chunk]);
      await client.query("COMMIT");
      totalDeleted += res.rowCount ?? 0;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      handleDbError(err, "deleteCustomersBatch");
    }
  }

  return totalDeleted;
}

// ---------------------------------------------------------
// FOLLOW UPS (GRANULAR)
// ---------------------------------------------------------
export async function getFollowUps(
  customerId?: string,
  ownerFilter?: string,
): Promise<DbFollowUp[]> {
  const client = await requirePgClient();
  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    let query = `
      SELECT f.id, f.customer_id as "customerId", f.channel, f.outcome, f.interest,
             f.reason, f.next_action as "nextAction", f.by, f.at
      FROM follow_ups f
    `;

    if (ownerFilter && ownerFilter.trim()) {
      const norm = normalizeOwner(ownerFilter);
      query += " JOIN customers c ON f.customer_id = c.id";
      if (norm === "belum ditugaskan") {
        conditions.push(`(
          c.owner IS NULL OR
          TRIM(c.owner) = '' OR
          LOWER(TRIM(c.owner)) = 'belum ditugaskan' OR
          LOWER(TRIM(c.owner)) = '-'
        )`);
      } else {
        conditions.push(
          `LOWER(TRIM(REGEXP_REPLACE(c.owner, '^\\s*Sales\\s*[·•\\-\\.\\:\\s]\\s*', '', 'i'))) = $${pIdx++}`,
        );
        params.push(norm);
      }
    }

    if (customerId) {
      conditions.push(`f.customer_id = $${pIdx++}`);
      params.push(customerId);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    query += " ORDER BY f.at DESC";
    const res = await client.query(query, params);
    return res.rows.map((r) => ({
      ...r,
      at: r.at ? new Date(r.at).toISOString() : new Date().toISOString(),
    }));
  } catch (err) {
    handleDbError(err, "getFollowUps");
  }
}

export async function getFollowUpById(id: string): Promise<DbFollowUp | null> {
  if (!id) return null;
  const client = await requirePgClient();
  try {
    const res = await client.query(
      `SELECT id, customer_id as "customerId", channel, outcome, interest, reason, next_action as "nextAction", by, at
       FROM follow_ups WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      at: r.at ? new Date(r.at).toISOString() : new Date().toISOString(),
    };
  } catch (err) {
    handleDbError(err, "getFollowUpById");
  }
}

export async function upsertFollowUp(followUp: DbFollowUp): Promise<DbFollowUp> {
  const client = await requirePgClient();
  try {
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
        followUp.id,
        followUp.customerId,
        followUp.channel || "WhatsApp",
        followUp.outcome || "",
        followUp.interest || "",
        followUp.reason || "",
        followUp.nextAction || "",
        followUp.by || "",
        followUp.at || new Date().toISOString(),
      ],
    );
    return followUp;
  } catch (err) {
    handleDbError(err, "upsertFollowUp");
  }
}

export async function deleteFollowUpById(id: string): Promise<boolean> {
  const client = await requirePgClient();
  try {
    const res = await client.query("DELETE FROM follow_ups WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  } catch (err) {
    handleDbError(err, "deleteFollowUpById");
  }
}

// ---------------------------------------------------------
// TEMPLATES (GRANULAR)
// ---------------------------------------------------------
export async function getTemplates(): Promise<DbTemplate[]> {
  const client = await requirePgClient();
  try {
    const res = await client.query("SELECT id, name, body FROM templates ORDER BY name ASC");
    return res.rows;
  } catch (err) {
    handleDbError(err, "getTemplates");
  }
}

export async function upsertTemplate(tmpl: DbTemplate): Promise<DbTemplate> {
  const client = await requirePgClient();
  try {
    await client.query(
      `INSERT INTO templates (id, name, body)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         body = EXCLUDED.body`,
      [tmpl.id, tmpl.name, tmpl.body],
    );
    return tmpl;
  } catch (err) {
    handleDbError(err, "upsertTemplate");
  }
}

export async function deleteTemplateById(id: string): Promise<boolean> {
  const client = await requirePgClient();
  try {
    const res = await client.query("DELETE FROM templates WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  } catch (err) {
    handleDbError(err, "deleteTemplateById");
  }
}

// ---------------------------------------------------------
// NOTES (GRANULAR)
// ---------------------------------------------------------
export async function getNotes(authorFilter?: string): Promise<DbNote[]> {
  const client = await requirePgClient();
  try {
    let query = `
      SELECT id, title, body, by, created_at as "createdAt", updated_at as "updatedAt"
      FROM notes
    `;
    const params: unknown[] = [];
    if (authorFilter && authorFilter.trim()) {
      const norm = normalizeOwner(authorFilter);
      query += ` WHERE LOWER(TRIM(REGEXP_REPLACE(by, '^\\s*Sales\\s*[·•\\-\\.\\:\\s]\\s*', '', 'i'))) = $1`;
      params.push(norm);
    }
    query += " ORDER BY updated_at DESC";
    const res = await client.query(query, params);
    return res.rows.map((r) => ({
      ...r,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
    }));
  } catch (err) {
    handleDbError(err, "getNotes");
  }
}

export async function getNoteById(id: string): Promise<DbNote | null> {
  if (!id) return null;
  const client = await requirePgClient();
  try {
    const res = await client.query(
      `SELECT id, title, body, by, created_at as "createdAt", updated_at as "updatedAt"
       FROM notes WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
    };
  } catch (err) {
    handleDbError(err, "getNoteById");
  }
}

export async function upsertNote(note: DbNote): Promise<DbNote> {
  const client = await requirePgClient();
  try {
    await client.query(
      `INSERT INTO notes (id, title, body, by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         body = EXCLUDED.body,
         by = EXCLUDED.by,
         updated_at = EXCLUDED.updated_at`,
      [
        note.id,
        note.title,
        note.body || "",
        note.by || "",
        note.createdAt || new Date().toISOString(),
        note.updatedAt || new Date().toISOString(),
      ],
    );
    return note;
  } catch (err) {
    handleDbError(err, "upsertNote");
  }
}

export async function deleteNoteById(id: string): Promise<boolean> {
  const client = await requirePgClient();
  try {
    const res = await client.query("DELETE FROM notes WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  } catch (err) {
    handleDbError(err, "deleteNoteById");
  }
}

// ---------------------------------------------------------
// ACCOUNTS & AUTHENTICATION (SECURE WITH HASHING)
// ---------------------------------------------------------
export async function getAccounts(includePassword = false): Promise<DbAccount[]> {
  const client = await requirePgClient();
  try {
    const res = await client.query(`
      SELECT id, name, email, role, active, phone, note, created_at as "createdAt"${
        includePassword ? ", password" : ""
      }
      FROM accounts
      ORDER BY created_at ASC
    `);
    return res.rows.map((r) => ({
      ...r,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    }));
  } catch (err) {
    handleDbError(err, "getAccounts");
  }
}

export async function getAccountByEmail(
  email: string,
  includePassword = false,
): Promise<DbAccount | null> {
  if (!email) return null;
  const client = await requirePgClient();
  try {
    const res = await client.query(
      `SELECT id, name, email, role, active, phone, note, created_at as "createdAt"${
        includePassword ? ", password" : ""
      }
       FROM accounts
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email.trim()],
    );
    if (res.rows.length > 0) {
      const r = res.rows[0];
      return {
        ...r,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      };
    }
    return null;
  } catch (err) {
    handleDbError(err, "getAccountByEmail");
  }
}

export async function upsertAccount(
  account: Partial<DbAccount> & { id: string; email: string; name: string },
): Promise<DbAccountPublic> {
  let finalPasswordHash = account.password;
  if (account.password) {
    const isBcrypt =
      account.password.startsWith("$2a$") ||
      account.password.startsWith("$2b$") ||
      account.password.startsWith("$2y$");
    if (!isBcrypt) {
      finalPasswordHash = await hashPassword(account.password);
    }
  }

  const client = await requirePgClient();
  try {
    if (finalPasswordHash) {
      await client.query(
        `INSERT INTO accounts (id, name, email, role, active, password, phone, note, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           role = EXCLUDED.role,
           active = EXCLUDED.active,
           password = EXCLUDED.password,
           phone = EXCLUDED.phone,
           note = EXCLUDED.note`,
        [
          account.id,
          account.name,
          account.email.trim().toLowerCase(),
          account.role || "sales",
          account.active ?? true,
          finalPasswordHash,
          account.phone || "",
          account.note || "",
          account.createdAt || new Date().toISOString(),
        ],
      );
    } else {
      // Update existing account profile without altering existing password
      await client.query(
        `UPDATE accounts SET
           name = $2,
           email = $3,
           role = $4,
           active = $5,
           phone = $6,
           note = $7
         WHERE id = $1`,
        [
          account.id,
          account.name,
          account.email.trim().toLowerCase(),
          account.role || "sales",
          account.active ?? true,
          account.phone || "",
          account.note || "",
        ],
      );
    }

    return {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role || "sales",
      active: account.active ?? true,
      phone: account.phone || "",
      note: account.note || "",
      createdAt: account.createdAt || new Date().toISOString(),
    };
  } catch (err) {
    handleDbError(err, "upsertAccount");
  }
}

export async function deleteAccountById(id: string): Promise<boolean> {
  const client = await requirePgClient();
  try {
    const res = await client.query("DELETE FROM accounts WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  } catch (err) {
    handleDbError(err, "deleteAccountById");
  }
}

// ---------------------------------------------------------
// COMPATIBILITY STATE HELPER (READ ONLY & SAFE BATCH)
// ---------------------------------------------------------
export type FullAppState = {
  customers: DbCustomer[];
  followUps: DbFollowUp[];
  templates: DbTemplate[];
  accounts: DbAccountPublic[];
  notes: DbNote[];
  totalCustomers: number;
};

export async function getFullState(
  userRole: "admin" | "sales",
  userName?: string,
): Promise<FullAppState> {
  const isSales = userRole === "sales";
  const ownerFilter = isSales ? userName : undefined;

  const { customers, total } = await getCustomers({
    owner: ownerFilter,
  });

  const followUps = await getFollowUps(undefined, ownerFilter);
  const templates = await getTemplates();
  const notes = await getNotes(ownerFilter);
  const accounts = isSales ? [] : ((await getAccounts(false)) as DbAccountPublic[]);

  return {
    customers,
    followUps,
    templates,
    accounts,
    notes,
    totalCustomers: total,
  };
}

export function getDbStatus(): {
  connected: boolean;
  type: "PostgreSQL" | "Disconnected";
  details?: string;
} {
  return {
    connected: isPgConnected,
    type: isPgConnected ? "PostgreSQL" : "Disconnected",
    details: isPgConnected
      ? "Terhubung ke database PostgreSQL aktif"
      : "Database PostgreSQL tidak terhubung",
  };
}
