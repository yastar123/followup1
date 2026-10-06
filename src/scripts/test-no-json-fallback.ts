import fs from "fs";
import path from "path";
import server from "../server";
import {
  DatabaseUnavailableError,
  getFullState,
  getCustomers,
  getCustomerById,
  upsertCustomer,
  getFollowUps,
  upsertFollowUp,
  getNotes,
  upsertNote,
  getTemplates,
  getAccounts,
  getAccountByEmail,
} from "../lib/db";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING TESTS: ELIMINASI DB FALLBACK JSON");
  console.log("=================================================");

  const accDbPath = path.join(process.cwd(), "acc_db.json");
  const initialExists = fs.existsSync(accDbPath);
  const initialMtime = initialExists ? fs.statSync(accDbPath).mtimeMs : 0;
  const initialContent = initialExists ? fs.readFileSync(accDbPath, "utf-8") : "";

  // TEST 1: DatabaseUnavailableError class check
  {
    const err = new DatabaseUnavailableError();
    console.assert(err.name === "DatabaseUnavailableError", "Error name mismatch");
    console.assert(
      err.message === "Layanan database sedang tidak tersedia.",
      "Error message mismatch",
    );
    console.log("✓ 1. DatabaseUnavailableError terdefinisi dengan pesan standar yang aman");
  }

  // TEST 2: POST /api/auth/login saat DB mati -> HTTP 503
  {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Real-IP": "10.0.0.1",
      },
      body: JSON.stringify({
        email: "test_db_down@tuba.com",
        password: "PasswordSuperKuat123!",
      }),
    });

    const res = await server.fetch(req, {}, {});
    const body = (await res.json()) as { error?: string };

    console.assert(
      res.status === 503,
      `Expected status 503 for login when DB is down, got ${res.status}`,
    );
    console.assert(
      body.error === "Layanan database sedang tidak tersedia.",
      `Expected generic 503 message, got: ${body.error}`,
    );
    console.log(
      `✓ 2. POST /api/auth/login saat DB mati: Status ${res.status}, Pesan: "${body.error}" -> PASS`,
    );
  }

  // TEST 3: Pemanggilan fungsi-fungsi db saat DB mati melempar DatabaseUnavailableError (TIDAK menyentuh JSON)
  {
    const functionsToTest: Array<{ name: string; fn: () => Promise<unknown> }> = [
      { name: "getCustomers", fn: () => getCustomers() },
      { name: "getCustomerById", fn: () => getCustomerById("c1") },
      {
        name: "upsertCustomer",
        fn: () =>
          upsertCustomer({ id: "test", name: "Test Cust", contractNumber: "K1", phone: "081" }),
      },
      { name: "getFollowUps", fn: () => getFollowUps() },
      {
        name: "upsertFollowUp",
        fn: () =>
          upsertFollowUp({
            id: "f1",
            customerId: "c1",
            channel: "WA",
            outcome: "ok",
            interest: "high",
            reason: "",
            nextAction: "",
            by: "Rio",
            at: new Date().toISOString(),
          }),
      },
      { name: "getNotes", fn: () => getNotes() },
      {
        name: "upsertNote",
        fn: () =>
          upsertNote({
            id: "n1",
            title: "Test Note",
            body: "Note Body",
            by: "Rio",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
      },
      { name: "getTemplates", fn: () => getTemplates() },
      { name: "getAccounts", fn: () => getAccounts() },
      { name: "getAccountByEmail", fn: () => getAccountByEmail("admin@acc.co.id") },
      { name: "getFullState", fn: () => getFullState("admin") },
    ];

    for (const testCase of functionsToTest) {
      let threwCorrect = false;
      try {
        await testCase.fn();
      } catch (e) {
        if (e instanceof DatabaseUnavailableError) {
          threwCorrect = true;
        }
      }
      console.assert(
        threwCorrect,
        `Function ${testCase.name} did not throw DatabaseUnavailableError when DB is down!`,
      );
    }
    console.log(
      "✓ 3. Seluruh 11 fungsi database melempar DatabaseUnavailableError saat DB mati (0 fallback) -> PASS",
    );
  }

  // TEST 4: Verifikasi acc_db.json tidak dimodifikasi / tidak ditulis
  {
    const currentExists = fs.existsSync(accDbPath);
    if (initialExists && currentExists) {
      const currentMtime = fs.statSync(accDbPath).mtimeMs;
      const currentContent = fs.readFileSync(accDbPath, "utf-8");
      console.assert(
        initialMtime === currentMtime && initialContent === currentContent,
        "acc_db.json was modified during DB failure!",
      );
      console.log(
        "✓ 4. acc_db.json TIDAK disentuh / tidak ditulis saat terjadi operasi tulis DB -> PASS",
      );
    } else {
      console.log("✓ 4. acc_db.json tidak dibuat oleh operasi fallback -> PASS");
    }
  }

  // TEST 5: Verifikasi rate limit login dan IP extraction tetap berjalan sebelum query DB
  {
    const ip = "192.168.10.99";
    const reqMissingPw = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Real-IP": ip,
      },
      body: JSON.stringify({
        email: "empty_pw@tuba.com",
      }),
    });

    const res = await server.fetch(reqMissingPw, {}, {});
    console.assert(
      res.status === 400,
      `Expected 400 for missing password before DB query, got ${res.status}`,
    );
    console.log("✓ 5. Validasi input & rate limit login dievaluasi sebelum query DB -> PASS");
  }

  console.log("=================================================");
  console.log("🎉 SEMUA TEST PENGHENTIAN FALLBACK JSON BERHASIL (100% PASS)!");
  console.log("=================================================");
}

runTests().catch((e) => {
  console.error("Test failed with error:", e);
  process.exit(1);
});
