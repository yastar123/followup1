import { getPgClient, hashPassword } from "../lib/db";

async function main() {
  const args = process.argv.slice(2);
  const email = args[0] || process.env.ADMIN_EMAIL || "admin@acc.co.id";
  const newPassword = args[1] || process.env.NEW_ADMIN_PASSWORD || "password123";

  console.log(`[Password Reset] Menyiapkan reset password untuk email: ${email}`);

  const client = await getPgClient();
  if (!client) {
    console.error(
      "[Password Reset] Gagal terhubung ke database PostgreSQL. Pastikan DATABASE_URL valid di .env.",
    );
    process.exit(1);
  }

  try {
    const hashedPassword = await hashPassword(newPassword);
    const res = await client.query(
      `UPDATE accounts 
       SET password = $1, role = 'admin', active = true 
       WHERE LOWER(email) = LOWER($2)`,
      [hashedPassword, email.trim()],
    );

    if ((res.rowCount ?? 0) > 0) {
      console.log(`[Password Reset] Sukses! Password untuk akun '${email}' berhasil diperbarui.`);
    } else {
      console.log(`[Password Reset] Akun '${email}' tidak ditemukan. Membuat akun admin baru...`);
      await client.query(
        `INSERT INTO accounts (id, name, email, role, active, password)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ["a_admin", "Admin Utama", email.trim().toLowerCase(), "admin", true, hashedPassword],
      );
      console.log(
        `[Password Reset] Sukses! Akun admin baru '${email}' berhasil dibuat dengan password yang diberikan.`,
      );
    }
  } catch (err) {
    console.error("[Password Reset] Terjadi kesalahan:", err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
