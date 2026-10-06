import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalisasi nama owner/sales secara konsisten:
 * 1. Trim spasi.
 * 2. Mengubah nilai kosong, '-', 'unassigned' menjadi 'belum ditugaskan'.
 * 3. Membuang prefix "Sales · ", "Sales - ", "Sales.", "Sales:", "Sales " (toleran terhadap spasi dan variasi titik tengah/bullet).
 * 4. Mengubah ke lowercase.
 */
export function normalizeOwner(owner?: string | null): string {
  if (!owner) return "";
  const trimmed = String(owner).trim();
  if (
    trimmed === "" ||
    trimmed === "-" ||
    trimmed.toLowerCase() === "belum ditugaskan" ||
    trimmed.toLowerCase() === "unassigned"
  ) {
    return "belum ditugaskan";
  }
  return trimmed
    .replace(/^\s*sales\s*[·•\-.:\s]\s*/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Membandingkan kepemilikan data sales secara STRICT EQUALITY (persis) setelah normalisasi.
 * DILARANG menggunakan includes / LIKE %...% untuk mencegah kebocoran antar sales (contoh: Rio vs Mario).
 */
export function isMatchSales(target?: string | null, salesUser?: string | null): boolean {
  if (!salesUser || salesUser === "all" || salesUser === "Semua") return true;
  const cleanUser = normalizeOwner(salesUser);
  const cleanTarget = normalizeOwner(target);

  if (cleanUser === "belum ditugaskan") {
    return cleanTarget === "belum ditugaskan";
  }
  if (!cleanTarget || cleanTarget === "belum ditugaskan") {
    return false;
  }
  // Pengecekan persis (strict equality)
  return cleanTarget === cleanUser;
}
