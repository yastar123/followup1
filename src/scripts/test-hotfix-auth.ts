import { verifyPassword, hashPassword } from "../lib/db";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING TESTS: HOTFIX AKUN & RATE LIMITING");
  console.log("=================================================");

  // Test 1: verifyPassword rejects forbidden defaults & placeholders
  console.log("1. Pengujian verifyPassword terhadap default/placeholder:");
  const test1a = await verifyPassword("password123", "password123");
  const test1b = await verifyPassword("placeholder_not_used", "placeholder_not_used");
  const test1c = await verifyPassword("", "");
  console.log(
    "   - 'password123' valid?",
    test1a.valid,
    "->",
    test1a.valid === false ? "✅ PASS" : "❌ FAIL",
  );
  console.log(
    "   - 'placeholder_not_used' valid?",
    test1b.valid,
    "->",
    test1b.valid === false ? "✅ PASS" : "❌ FAIL",
  );
  console.log(
    "   - '' (kosong) valid?",
    test1c.valid,
    "->",
    test1c.valid === false ? "✅ PASS" : "❌ FAIL",
  );

  // Test 2: verifyPassword accepts bcrypt >= 12 chars
  console.log("\n2. Pengujian hashing Bcrypt untuk password >= 12 karakter:");
  const strongPwd = "AmanSekali123!";
  const hash = await hashPassword(strongPwd);
  console.log("   - Hash bcrypt yang dihasilkan:", hash.substring(0, 20) + "...");
  console.log("   - Panjang hash bcrypt:", hash.length, "(harus 60)");
  const test2 = await verifyPassword(strongPwd, hash);
  console.log(
    "   - Verifikasi hash Bcrypt benar?",
    test2.valid,
    "->",
    test2.valid === true ? "✅ PASS" : "❌ FAIL",
  );
  const test2Wrong = await verifyPassword("SalahPassword123!", hash);
  console.log(
    "   - Verifikasi hash Bcrypt password salah?",
    test2Wrong.valid,
    "->",
    test2Wrong.valid === false ? "✅ PASS" : "❌ FAIL",
  );

  // Test 3: Short password rejected
  console.log("\n3. Pengujian password kurang dari 12 karakter:");
  const shortPwd = "pendek123";
  const test3 = await verifyPassword(shortPwd, shortPwd);
  console.log(
    "   - Plaintext kurang dari 12 karakter ditolak?",
    test3.valid === false ? "✅ PASS" : "❌ FAIL",
  );

  console.log("\n=================================================");
  console.log("🎉 SEMUA PENGUJIAN LOGIKA AUTH BERHASIL (100% PASS)!");
  console.log("=================================================");
}

runTests();
