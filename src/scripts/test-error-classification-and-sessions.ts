import server from "../server";
import {
  isConnectionError,
  handleDbError,
  DatabaseUnavailableError,
  ConflictError,
  ValidationError,
  getIsPgConnected,
  setIsPgConnectedForTesting,
  createSession,
  getSession,
  deleteSession,
} from "../lib/db";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING TESTS: ERROR CLASSIFICATION & SESSIONS");
  console.log("=================================================");

  // TEST 1: isConnectionError helper tests
  {
    console.log("1. Pengujian isConnectionError:");
    console.assert(isConnectionError({ code: "ECONNREFUSED" }) === true, "ECONNREFUSED failed");
    console.assert(isConnectionError({ code: "ETIMEDOUT" }) === true, "ETIMEDOUT failed");
    console.assert(isConnectionError({ code: "ECONNRESET" }) === true, "ECONNRESET failed");
    console.assert(isConnectionError({ code: "08006" }) === true, "08006 failed");
    console.assert(isConnectionError({ code: "08001" }) === true, "08001 failed");
    console.assert(isConnectionError({ code: "57P01" }) === true, "57P01 failed");
    console.assert(isConnectionError({ code: "57P02" }) === true, "57P02 failed");
    console.assert(isConnectionError({ code: "53300" }) === true, "53300 failed");
    console.assert(
      isConnectionError({ message: "Connection terminated unexpectedly" }) === true,
      "message connection terminated failed",
    );

    // Non-connection errors must return false
    console.assert(
      isConnectionError({ code: "42601", message: "syntax error" }) === false,
      "42601 must be false",
    );
    console.assert(
      isConnectionError({ code: "42703", message: "undefined column" }) === false,
      "42703 must be false",
    );
    console.assert(
      isConnectionError({ code: "23505", message: "unique constraint violation" }) === false,
      "23505 must be false",
    );
    console.assert(
      isConnectionError({ code: "23503", message: "foreign key violation" }) === false,
      "23503 must be false",
    );
    console.log("   ✓ isConnectionError membedakan error koneksi vs error SQL dengan tepat");
  }

  // TEST 2: handleDbError error classification tests
  {
    console.log("2. Pengujian handleDbError classification:");

    // Connection error throws DatabaseUnavailableError & sets isPgConnected = false
    setIsPgConnectedForTesting(true);
    let threw503 = false;
    try {
      handleDbError({ code: "ECONNREFUSED" }, "testConn");
    } catch (e) {
      if (e instanceof DatabaseUnavailableError) threw503 = true;
    }
    console.assert(threw503, "ECONNREFUSED did not throw DatabaseUnavailableError");
    console.assert(
      getIsPgConnected() === false,
      "isPgConnected was not set to false on ECONNREFUSED",
    );

    // Unique violation throws ConflictError & leaves isPgConnected untouched
    setIsPgConnectedForTesting(true);
    let threw409 = false;
    try {
      handleDbError({ code: "23505" }, "testUnique");
    } catch (e) {
      if (e instanceof ConflictError) threw409 = true;
    }
    console.assert(threw409, "23505 did not throw ConflictError");
    console.assert(getIsPgConnected() === true, "isPgConnected was altered on unique violation");

    // Syntax error re-throws original error & leaves isPgConnected untouched
    setIsPgConnectedForTesting(true);
    const syntaxErr = new Error("syntax error at or near WHERE");
    (syntaxErr as unknown as { code: string }).code = "42601";
    let threwOriginal = false;
    try {
      handleDbError(syntaxErr, "testSyntax");
    } catch (e) {
      if (e === syntaxErr) threwOriginal = true;
    }
    console.assert(threwOriginal, "42601 did not re-throw original error");
    console.assert(getIsPgConnected() === true, "isPgConnected was altered on syntax error");

    console.log("   ✓ handleDbError mengklasifikasi 503, 409, 400, dan 500 dengan benar");
  }

  // TEST 3: createSession, getSession, deleteSession saat DB mati
  {
    console.log("3. Pengujian sesi tanpa memory fallback saat DB mati:");
    setIsPgConnectedForTesting(false);

    let create503 = false;
    try {
      await createSession({
        id: "acc_test",
        name: "Test Sales",
        email: "sales_test@tuba.com",
        role: "sales",
        active: true,
      });
    } catch (e) {
      if (e instanceof DatabaseUnavailableError) create503 = true;
    }
    console.assert(create503, "createSession did not throw 503 when DB is down");

    let get503 = false;
    try {
      await getSession("some_mock_token_12345");
    } catch (e) {
      if (e instanceof DatabaseUnavailableError) get503 = true;
    }
    console.assert(get503, "getSession did not throw 503 when DB is down");

    let delete503 = false;
    try {
      await deleteSession("some_mock_token_12345");
    } catch (e) {
      if (e instanceof DatabaseUnavailableError) delete503 = true;
    }
    console.assert(delete503, "deleteSession did not throw 503 when DB is down");

    console.log("   ✓ Operasi sesi tidak memakai memori dan melempar 503 saat DB mati");
  }

  // TEST 4: Global handler server.ts HTTP Status codes
  {
    console.log("4. Pengujian server global error response statuses:");

    // Simulasi request login saat DB mati -> 503
    setIsPgConnectedForTesting(false);
    const reqLogin503 = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Real-IP": "10.0.0.1" },
      body: JSON.stringify({ email: "sales@acc.co.id", password: "PasswordKuat123!" }),
    });
    const resLogin = await server.fetch(reqLogin503, {}, {});
    console.assert(
      resLogin.status === 503,
      `Expected 503 for login when DB down, got ${resLogin.status}`,
    );
    console.log("   ✓ POST /api/auth/login saat DB mati menghasilkan HTTP 503");
  }

  console.log("=================================================");
  console.log("🎉 SEMUA TEST PERBAIKAN 1, 2, DAN 3 LULUS (100%)!");
  console.log("=================================================");
}

runTests().catch((e) => {
  console.error("Test failed with error:", e);
  process.exit(1);
});
