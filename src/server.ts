import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  getFullState,
  getDbStatus,
  getCustomers,
  getCustomerById,
  upsertCustomer,
  upsertCustomersBatch,
  deleteCustomerById,
  deleteCustomersBatch,
  getFollowUps,
  getFollowUpById,
  upsertFollowUp,
  deleteFollowUpById,
  getTemplates,
  upsertTemplate,
  deleteTemplateById,
  getNotes,
  getNoteById,
  upsertNote,
  deleteNoteById,
  normalizeOwner,
  getAccounts,
  getAccountByEmail,
  upsertAccount,
  deleteAccountById,
  createSession,
  getSession,
  deleteSession,
  verifyPassword,
  hashPassword,
  getPgClient,
  DbCustomer,
  DbFollowUp,
  DbTemplate,
  DbNote,
  DbSession,
} from "./lib/db";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------
// Helper utilities for auth, cookies, JSON and rate limiting
// ---------------------------------------------------------

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [key, ...vals] = part.trim().split("=");
    if (key) {
      cookies[key.trim()] = vals.join("=").trim();
    }
  }
  return cookies;
}

function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store, no-cache, must-revalidate",
      ...extraHeaders,
    },
  });
}

// Simple in-memory IP rate limiter for write endpoints
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, maxPerMin = 150): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || record.resetAt <= now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  record.count++;
  return record.count <= maxPerMin;
}

// Session authentication resolver
async function resolveAuth(request: Request): Promise<DbSession | null> {
  const cookieHeader = request.headers.get("cookie");
  const cookies = parseCookies(cookieHeader);
  let token = cookies["acc_session"];

  if (!token) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) return null;
  return getSession(token);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

      // -----------------------------------------------------
      // /api/* ROUTES HANDLING
      // -----------------------------------------------------
      if (pathname.startsWith("/api/")) {
        // 1. Authentication Routes
        if (pathname === "/api/auth/login" && request.method === "POST") {
          try {
            const body = await request.json();
            const { email, password } = body;
            if (!email || !password) {
              return jsonResponse({ error: "Email dan password wajib diisi." }, 400);
            }

            const account = await getAccountByEmail(email, true);
            if (!account || !account.active) {
              return jsonResponse({ error: "Email atau password tidak valid." }, 401);
            }

            const check = await verifyPassword(password, account.password || "");
            if (!check.valid) {
              return jsonResponse({ error: "Email atau password tidak valid." }, 401);
            }

            // Auto-migrate legacy password to bcrypt hash in DB if needed
            if (check.needsRehash) {
              try {
                const newHash = await hashPassword(password);
                const client = await getPgClient();
                if (client) {
                  await client.query("UPDATE accounts SET password = $1 WHERE id = $2", [
                    newHash,
                    account.id,
                  ]);
                }
              } catch (e) {
                console.warn("[Auth] Failed to rehash password:", e);
              }
            }

            const session = await createSession(account);
            const isProd = process.env.NODE_ENV === "production";
            const cookieVal = `acc_session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${
              isProd ? "; Secure" : ""
            }`;

            return jsonResponse(
              {
                success: true,
                user: {
                  id: account.id,
                  name: account.name,
                  email: account.email,
                  role: account.role,
                  active: account.active,
                  phone: account.phone,
                },
              },
              200,
              { "Set-Cookie": cookieVal },
            );
          } catch (err) {
            return jsonResponse({ error: "Gagal memproses login." }, 400);
          }
        }

        if (pathname === "/api/auth/logout" && request.method === "POST") {
          const cookieHeader = request.headers.get("cookie");
          const cookies = parseCookies(cookieHeader);
          const token = cookies["acc_session"];
          if (token) {
            await deleteSession(token);
          }
          const clearCookie = `acc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
          return jsonResponse({ success: true }, 200, { "Set-Cookie": clearCookie });
        }

        if (pathname === "/api/auth/me" && request.method === "GET") {
          const session = await resolveAuth(request);
          if (!session) {
            return jsonResponse({ authenticated: false }, 401);
          }
          return jsonResponse({
            authenticated: true,
            user: {
              id: session.accountId,
              name: session.name,
              email: session.email,
              role: session.role,
            },
          });
        }

        // REQUIRE AUTHENTICATION FOR ALL OTHER /api/* ENDPOINTS
        const session = await resolveAuth(request);
        if (!session) {
          return jsonResponse(
            { error: "Sesi tidak valid atau telah berakhir. Silakan login kembali." },
            401,
          );
        }

        // Rate limiting for write operations
        if (request.method !== "GET" && !checkRateLimit(clientIp)) {
          return jsonResponse(
            { error: "Terlalu banyak permintaan. Silakan coba lagi nanti." },
            429,
          );
        }

        // 2. Database Status
        if (pathname === "/api/db-status" && request.method === "GET") {
          const status = getDbStatus();
          return jsonResponse(status);
        }

        // 3. Full App State (Read-only, strictly filtered by role at server level)
        if (pathname === "/api/state") {
          if (request.method === "GET") {
            const t0 = performance.now();
            const data = await getFullState(session.role, session.name);
            const dbDurationMs = (performance.now() - t0).toFixed(2);

            const t1 = performance.now();
            const jsonString = JSON.stringify(data);
            const jsonDurationMs = (performance.now() - t1).toFixed(2);

            const payloadBytes = Buffer.byteLength(jsonString, "utf-8");
            const customerCount = Array.isArray(data.customers) ? data.customers.length : 0;

            console.log(
              `[${new Date().toISOString()}] [API /api/state] Role: ${session.role} | Caller: "${session.name}" | Customers: ${customerCount} baris | DB Query: ${dbDurationMs}ms | JSON Stringify: ${jsonDurationMs}ms | Size: ${(payloadBytes / (1024 * 1024)).toFixed(2)} MB (${payloadBytes} bytes)`,
            );

            return new Response(jsonString, {
              status: 200,
              headers: {
                "content-type": "application/json",
                "cache-control": "no-store, no-cache, must-revalidate",
              },
            });
          }
          // Reject raw POST /api/state to prevent monolithic client state wipes
          return jsonResponse(
            {
              error:
                "Endpoint sinkronisasi /api/state telah dinonaktifkan demi keamanan. Gunakan endpoint granular.",
            },
            405,
          );
        }

        // 4. Customers API
        if (pathname === "/api/customers") {
          if (request.method === "GET") {
            const search = url.searchParams.get("search") || undefined;
            const limit = url.searchParams.get("limit")
              ? Number(url.searchParams.get("limit"))
              : undefined;
            const offset = url.searchParams.get("offset")
              ? Number(url.searchParams.get("offset"))
              : undefined;
            const owner =
              session.role === "sales" ? session.name : url.searchParams.get("owner") || undefined;

            const res = await getCustomers({ owner, search, limit, offset });
            return jsonResponse(res);
          }

          if (request.method === "POST") {
            const body = (await request.json()) as DbCustomer;
            if (!body.id || !body.name || !body.phone) {
              return jsonResponse({ error: "Field id, nama, dan nomor telepon wajib diisi." }, 400);
            }

            if (session.role === "sales") {
              const existing = await getCustomerById(body.id);
              if (existing) {
                if (normalizeOwner(existing.owner) !== normalizeOwner(session.name)) {
                  console.warn(
                    `[${new Date().toISOString()}] [UNAUTHORIZED ACCESS] Sales "${session.name}" mencoba mengubah data customer ID ${body.id} milik "${existing.owner}".`,
                  );
                  return jsonResponse(
                    { error: "Anda tidak berhak mengubah data customer milik petugas sales lain." },
                    403,
                  );
                }
                // Sales tidak dapat memindahkan kepemilikan customer
                body.owner = existing.owner;
              } else {
                body.owner = session.name.startsWith("Sales · ")
                  ? session.name
                  : `Sales · ${session.name}`;
              }
            } else if (session.role === "admin") {
              const existing = await getCustomerById(body.id);
              if (existing && existing.owner !== body.owner) {
                console.log(
                  `[${new Date().toISOString()}] [OWNER CHANGED] Customer ID ${body.id} ("${body.name}") owner diubah dari "${existing.owner}" menjadi "${body.owner}" oleh Admin "${session.name}".`,
                );
              }
            }

            const saved = await upsertCustomer(body);
            return jsonResponse({ success: true, customer: saved });
          }
        }

        // 5. Batch Import Customers (Admin only, max 50,000 rows, UPSERT only)
        if (pathname === "/api/customers/import" && request.method === "POST") {
          if (session.role !== "admin") {
            return jsonResponse(
              { error: "Hanya akun Admin yang berhak mengimpor data customer." },
              403,
            );
          }
          const body = await request.json();
          const list = Array.isArray(body?.customers)
            ? body.customers
            : Array.isArray(body)
              ? body
              : [];

          if (list.length === 0) {
            return jsonResponse({ error: "Data impor kosong." }, 400);
          }
          if (list.length > 50000) {
            return jsonResponse({ error: "Maksimal 50.000 baris data per sekali impor." }, 400);
          }

          // Validate each row
          const validCustomers: DbCustomer[] = [];
          for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item.id || !item.name || !item.phone) {
              return jsonResponse(
                { error: `Baris ke-${i + 1} tidak valid. ID, nama, dan no telepon wajib ada.` },
                400,
              );
            }
            validCustomers.push({
              id: String(item.id).trim(),
              name: String(item.name).trim(),
              contractNumber: item.contractNumber ? String(item.contractNumber).trim() : "",
              phone: String(item.phone).trim(),
              postalCode: item.postalCode ? String(item.postalCode).trim() : "",
              mod: item.mod ? String(item.mod).trim() : "",
              unitType: item.unitType ? String(item.unitType).trim() : "",
              year: item.year ? String(item.year).trim() : "",
              contractStatus: item.contractStatus ? String(item.contractStatus).trim() : "",
              segment: item.segment ? String(item.segment).trim() : "",
              handling: item.handling ? String(item.handling).trim() : "",
              city: item.city ? String(item.city).trim() : "",
              company: item.company ? String(item.company).trim() : "",
              product: item.product ? String(item.product).trim() : "",
              unit: item.unit ? String(item.unit).trim() : "",
              region: item.region ? String(item.region).trim() : "",
              value: Number(item.value) || 0,
              source: item.source ? String(item.source).trim() : "",
              status: item.status ? String(item.status).trim() : "Baru",
              owner: item.owner ? String(item.owner).trim() : "",
              note: item.note ? String(item.note).trim() : "",
              createdAt: item.createdAt || new Date().toISOString(),
            });
          }

          const result = await upsertCustomersBatch(validCustomers);
          return jsonResponse({ success: true, count: result.insertedOrUpdated });
        }

        // 6. Batch Delete Customers (Admin only, max 200 IDs)
        if (pathname === "/api/customers/batch-delete" && request.method === "POST") {
          if (session.role !== "admin") {
            return jsonResponse({ error: "Hanya Admin yang berhak menghapus data customer." }, 403);
          }
          const body = await request.json();
          const ids = Array.isArray(body?.ids) ? body.ids : [];
          if (ids.length === 0) {
            return jsonResponse({ error: "Daftar ID customer untuk dihapus kosong." }, 400);
          }
          if (ids.length > 200) {
            return jsonResponse(
              { error: "Maksimal 200 customer per permintaan penghapusan." },
              400,
            );
          }
          console.log(
            `[${new Date().toISOString()}] [BATCH DELETE CUSTOMERS] ${ids.length} customer dihapus oleh Admin "${session.name}". IDs: ${ids.slice(0, 10).join(", ")}${ids.length > 10 ? "..." : ""}`,
          );
          const deleted = await deleteCustomersBatch(ids);
          return jsonResponse({ success: true, deletedCount: deleted });
        }

        // 7. Single Customer Details & Deletion
        if (pathname.startsWith("/api/customers/")) {
          const custId = pathname.replace("/api/customers/", "").trim();
          if (custId) {
            if (request.method === "GET") {
              const cust = await getCustomerById(
                custId,
                session.role === "sales" ? session.name : undefined,
              );
              if (!cust) return jsonResponse({ error: "Customer tidak ditemukan." }, 404);
              return jsonResponse(cust);
            }
            if (request.method === "DELETE") {
              if (session.role !== "admin") {
                return jsonResponse({ error: "Hanya Admin yang berhak menghapus customer." }, 403);
              }
              console.log(
                `[${new Date().toISOString()}] [DELETE CUSTOMER] Customer ID ${custId} dihapus oleh Admin "${session.name}".`,
              );
              const success = await deleteCustomerById(custId);
              return jsonResponse({ success });
            }
          }
        }

        // 8. Follow-ups API
        if (pathname === "/api/followups") {
          if (request.method === "GET") {
            const customerId = url.searchParams.get("customerId") || undefined;
            const ownerFilter = session.role === "sales" ? session.name : undefined;
            const res = await getFollowUps(customerId, ownerFilter);
            return jsonResponse(res);
          }
          if (request.method === "POST") {
            const body = (await request.json()) as DbFollowUp;
            if (!body.id || !body.customerId) {
              return jsonResponse({ error: "ID follow-up dan customerId wajib diisi." }, 400);
            }
            if (session.role === "sales") {
              // Sales dipaksa menggunakan nama sesi sendiri
              body.by = session.name;
              // Validasi bahwa customer milik sales ini
              const targetCust = await getCustomerById(body.customerId);
              if (
                !targetCust ||
                normalizeOwner(targetCust.owner) !== normalizeOwner(session.name)
              ) {
                return jsonResponse(
                  {
                    error:
                      "Anda hanya dapat mencatat follow up untuk customer yang ditugaskan kepada Anda.",
                  },
                  403,
                );
              }
            } else if (session.role === "admin") {
              // Admin boleh mengirim by (impersonasi sales), fallback ke session.name jika kosong
              if (!body.by || !body.by.trim()) {
                body.by = session.name;
              }
            }
            const saved = await upsertFollowUp(body);
            return jsonResponse({ success: true, followUp: saved });
          }
        }

        if (pathname.startsWith("/api/followups/") && request.method === "DELETE") {
          const fuId = pathname.replace("/api/followups/", "").trim();
          const existing = await getFollowUpById(fuId);
          if (!existing) {
            return jsonResponse({ error: "Data follow up tidak ditemukan." }, 404);
          }
          if (
            session.role !== "admin" &&
            normalizeOwner(existing.by) !== normalizeOwner(session.name)
          ) {
            console.warn(
              `[${new Date().toISOString()}] [UNAUTHORIZED DELETE] User "${session.name}" (${session.role}) mencoba menghapus follow up ${fuId} milik "${existing.by}".`,
            );
            return jsonResponse(
              {
                error:
                  "Anda tidak memiliki hak untuk menghapus riwayat follow up milik pengguna lain.",
              },
              403,
            );
          }
          console.log(
            `[${new Date().toISOString()}] [DELETE FOLLOWUP] Follow up ID ${fuId} (Customer: ${existing.customerId}, By: ${existing.by}) dihapus oleh "${session.name}" (${session.role}).`,
          );
          const success = await deleteFollowUpById(fuId);
          return jsonResponse({ success });
        }

        // 9. Templates API
        if (pathname === "/api/templates") {
          if (request.method === "GET") {
            const list = await getTemplates();
            return jsonResponse(list);
          }
          if (request.method === "POST") {
            if (session.role !== "admin") {
              return jsonResponse(
                { error: "Hanya Admin yang dapat mengelola template pesan." },
                403,
              );
            }
            const body = (await request.json()) as DbTemplate;
            if (!body.id || !body.name || !body.body) {
              return jsonResponse({ error: "ID, nama, dan isi template wajib diisi." }, 400);
            }
            const saved = await upsertTemplate(body);
            return jsonResponse({ success: true, template: saved });
          }
        }

        if (pathname.startsWith("/api/templates/") && request.method === "DELETE") {
          if (session.role !== "admin") {
            return jsonResponse({ error: "Hanya Admin yang dapat menghapus template pesan." }, 403);
          }
          const tmplId = pathname.replace("/api/templates/", "").trim();
          const success = await deleteTemplateById(tmplId);
          return jsonResponse({ success });
        }

        // 10. Notes API
        if (pathname === "/api/notes") {
          if (request.method === "GET") {
            const authorFilter = session.role === "sales" ? session.name : undefined;
            const list = await getNotes(authorFilter);
            return jsonResponse(list);
          }
          if (request.method === "POST") {
            const body = (await request.json()) as DbNote;
            if (!body.id || !body.title) {
              return jsonResponse({ error: "ID dan judul catatan wajib diisi." }, 400);
            }
            if (session.role === "sales") {
              body.by = session.name;
            } else if (session.role === "admin") {
              if (!body.by || !body.by.trim()) {
                body.by = session.name;
              }
            }
            const saved = await upsertNote(body);
            return jsonResponse({ success: true, note: saved });
          }
        }

        if (pathname.startsWith("/api/notes/") && request.method === "DELETE") {
          const noteId = pathname.replace("/api/notes/", "").trim();
          const existing = await getNoteById(noteId);
          if (!existing) {
            return jsonResponse({ error: "Catatan tidak ditemukan." }, 404);
          }
          if (
            session.role !== "admin" &&
            normalizeOwner(existing.by) !== normalizeOwner(session.name)
          ) {
            console.warn(
              `[${new Date().toISOString()}] [UNAUTHORIZED DELETE] User "${session.name}" (${session.role}) mencoba menghapus catatan ${noteId} milik "${existing.by}".`,
            );
            return jsonResponse(
              { error: "Anda tidak memiliki hak untuk menghapus catatan milik pengguna lain." },
              403,
            );
          }
          console.log(
            `[${new Date().toISOString()}] [DELETE NOTE] Catatan ID ${noteId} ("${existing.title}", By: ${existing.by}) dihapus oleh "${session.name}" (${session.role}).`,
          );
          const success = await deleteNoteById(noteId);
          return jsonResponse({ success });
        }

        // 11. Accounts API (Admin Only)
        if (pathname === "/api/accounts") {
          if (session.role !== "admin") {
            return jsonResponse({ error: "Hanya Admin yang dapat mengelola akun pengguna." }, 403);
          }
          if (request.method === "GET") {
            const accounts = await getAccounts(false);
            return jsonResponse(accounts);
          }
          if (request.method === "POST") {
            const body = await request.json();
            if (!body.id || !body.name || !body.email) {
              return jsonResponse({ error: "ID, nama, dan email akun wajib diisi." }, 400);
            }
            const saved = await upsertAccount(body);
            return jsonResponse({ success: true, account: saved });
          }
        }

        if (pathname.startsWith("/api/accounts/") && request.method === "DELETE") {
          if (session.role !== "admin") {
            return jsonResponse({ error: "Hanya Admin yang dapat menghapus akun pengguna." }, 403);
          }
          const accId = pathname.replace("/api/accounts/", "").trim();
          if (accId === session.accountId) {
            return jsonResponse(
              { error: "Anda tidak dapat menghapus akun Anda sendiri yang sedang login." },
              400,
            );
          }
          const success = await deleteAccountById(accId);
          return jsonResponse({ success });
        }

        return jsonResponse({ error: "Endpoint tidak ditemukan." }, 404);
      }

      // -----------------------------------------------------
      // SSR & CLIENT APP HANDLING
      // -----------------------------------------------------
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error("[Server Error]", error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
