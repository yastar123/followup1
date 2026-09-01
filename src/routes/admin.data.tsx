import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore, type Customer } from "@/lib/store";

export const Route = createFileRoute("/admin/data")({
  head: () => ({
    meta: [
      { title: "Database Customer — ACC One" },
      {
        name: "description",
        content:
          "Import database customer dari file Excel dan bagikan penanganannya ke sales berdasarkan rentang nomor.",
      },
      { property: "og:title", content: "Database Customer — ACC One" },
      {
        property: "og:description",
        content: "Import Excel dan atur pembagian customer per sales.",
      },
    ],
  }),
  component: DataPage,
});

type StagedRow = Omit<Customer, "id"> & { id: string };

const norm = (v: unknown) => String(v ?? "").trim();

function rowsFromSheet(rows: unknown[][], sheetName: string): StagedRow[] {
  const headerIdx = rows.findIndex((r) =>
    r.some((c) => norm(c).toUpperCase() === "NAME" || norm(c).toUpperCase() === "NAMA"),
  );
  if (headerIdx === -1) return [];
  const header = rows[headerIdx]!.map((c) => norm(c).toUpperCase());
  const col = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };
  const iName = col("NAME", "NAMA");
  const iPhone = col("NO_TELP_HP", "NO_HP", "TELP", "NOMOR_WA");
  const iAggr = col("NO_AGGR", "NO_KONTRAK");
  const iBrand = col("BRAND");
  const iMod = col("MOD");
  const iYear = col("YEAR");
  const iSeg = col("SEGMEN", "SEGMENT");
  const iGroup = col("GROUP_PRODUCT", "GROUP_STATUS", "STATUS");
  const iHandling = col("HANDLING");

  const out: StagedRow[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const name = norm(row[iName]);
    if (!name) continue;
    const brand = norm(row[iBrand]);
    const year = norm(row[iYear]);
    const unit = [brand, year].filter(Boolean).join(" ") || "-";
    const handling = norm(row[iHandling]) || "-";
    let phone = norm(row[iPhone]).replace(/\D/g, "");
    if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;
    out.push({
      id: `imp${Date.now()}${out.length}`,
      name,
      phone,
      city: handling,
      company: norm(row[iGroup]) || sheetName,
      product: unit,
      unit,
      segment: norm(row[iSeg]) || "-",
      contractNumber: norm(row[iAggr]) || "-",
      region: handling,
      value: 0,
      source: `Excel · ${sheetName}`,
      status: "Baru",
      owner: "Belum ditugaskan",
      note: `MOD ${norm(row[iMod]) || "-"} · ${norm(row[iGroup]) || "-"}`,
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}

function DataPage() {
  const { customers, followUps, accounts, addCustomers } = useStore();
  const [staged, setStaged] = useState<StagedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("50");
  const [sales, setSales] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const salesList = useMemo(
    () => accounts.filter((a) => a.role === "sales" && a.active),
    [accounts],
  );

  const assignedCount = staged.filter((r) => r.owner !== "Belum ditugaskan").length;

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const all: StagedRow[] = [];
      for (const name of wb.SheetNames) {
        const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name]!, {
          header: 1,
          raw: false,
          defval: "",
        });
        all.push(...rowsFromSheet(grid, name));
      }
      if (!all.length) {
        toast.error("Tidak menemukan baris customer. Pastikan ada kolom NAME.");
        return;
      }
      setStaged(all.map((r, i) => ({ ...r, id: `imp${Date.now()}${i}` })));
      setFileName(file.name);
      setTo(String(Math.min(50, all.length)));
      toast.success(`${all.length} customer terbaca dari ${file.name}.`);
    } catch {
      toast.error("Gagal membaca file Excel.");
    } finally {
      setLoading(false);
    }
  };

  const assignRange = () => {
    const a = Math.max(1, Number(from) || 1);
    const b = Math.min(staged.length, Number(to) || 0);
    if (!sales) {
      toast.error("Pilih sales terlebih dahulu.");
      return;
    }
    if (b < a) {
      toast.error("Rentang tidak valid.");
      return;
    }
    setStaged((rows) =>
      rows.map((r, i) => (i + 1 >= a && i + 1 <= b ? { ...r, owner: `Sales · ${sales}` } : r)),
    );
    toast.success(`Customer ${a}–${b} ditugaskan ke ${sales}.`);
  };

  const saveAll = () => {
    if (!staged.length) return;
    addCustomers(staged.map((r) => ({ ...r })));
    toast.success(`${staged.length} customer masuk ke database.`);
    setStaged([]);
    setFileName("");
  };

  const download = (filename: string, content: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filename} diunduh.`);
  };

  const downloadTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      const sampleData = [
        {
          NAME: "Budi Santoso",
          NO_AGGR: "01.100.2023.00192",
          NO_TELP_HP: "081234567890",
          MOD: "AVANZA G 1.5 MT",
          BRAND: "TOYOTA",
          YEAR: "2022",
          SEGMEN: "RETAIL",
          GROUP_PRODUCT: "PASSENGER CAR",
          HANDLING: "JAKARTA SELATAN",
        },
        {
          NAME: "Siti Rahmawati",
          NO_AGGR: "01.100.2023.00481",
          NO_TELP_HP: "085712345678",
          MOD: "INNOVA ZENIX 2.0 V",
          BRAND: "TOYOTA",
          YEAR: "2023",
          SEGMEN: "COMMERCIAL",
          GROUP_PRODUCT: "PASSENGER CAR",
          HANDLING: "SURABAYA",
        },
        {
          NAME: "Ahmad Hidayat",
          NO_AGGR: "01.100.2022.01254",
          NO_TELP_HP: "081398765432",
          MOD: "BR-V PRESTIGE CVT",
          BRAND: "HONDA",
          YEAR: "2021",
          SEGMEN: "RETAIL",
          GROUP_PRODUCT: "PASSENGER CAR",
          HANDLING: "BANDUNG",
        },
      ];

      const ws = XLSX.utils.json_to_sheet(sampleData, {
        header: [
          "NAME",
          "NO_AGGR",
          "NO_TELP_HP",
          "MOD",
          "BRAND",
          "YEAR",
          "SEGMEN",
          "GROUP_PRODUCT",
          "HANDLING",
        ],
      });

      // Set column widths for better readability
      ws["!cols"] = [
        { wch: 22 }, // NAME
        { wch: 20 }, // NO_AGGR
        { wch: 16 }, // NO_TELP_HP
        { wch: 22 }, // MOD
        { wch: 12 }, // BRAND
        { wch: 8 }, // YEAR
        { wch: 14 }, // SEGMEN
        { wch: 18 }, // GROUP_PRODUCT
        { wch: 18 }, // HANDLING
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DATA_CUSTOMER");

      XLSX.writeFile(wb, "template-import-customer-acc.xlsx");
      toast.success("Template Excel berhasil diunduh. Silakan isi data dan upload kembali.");
    } catch (err) {
      console.error(err);
      toast.error("Gagal membuat template Excel.");
    }
  };

  const exportCustomers = () =>
    download(
      "database-customer-acc.csv",
      ["nama,nomor_wa,no_kontrak,unit,segmen,handling,sumber,status,sales"]
        .concat(
          customers.map((c) =>
            [
              c.name,
              c.phone,
              c.contractNumber,
              c.unit,
              c.segment,
              c.region,
              c.source,
              c.status,
              c.owner,
            ].join(","),
          ),
        )
        .join("\n"),
    );

  const exportFollowUps = () =>
    download(
      "riwayat-followup.csv",
      ["tanggal,customer,channel,hasil,minat,alasan,tindakan,sales"]
        .concat(
          followUps.map((f) => {
            const c = customers.find((x) => x.id === f.customerId);
            return [
              new Date(f.at).toISOString(),
              c?.name ?? "-",
              f.channel,
              f.outcome,
              f.interest,
              `"${f.reason.replace(/"/g, "'")}"`,
              `"${f.nextAction}"`,
              f.by,
            ].join(",");
          }),
        )
        .join("\n"),
    );

  return (
    <AppShell
      role="admin"
      title="Database"
      subtitle="Import database Excel dan bagi penanganan customer ke sales."
    >
      <div className="grid gap-6">
        <section className="surface-card p-5">
          <h2 className="text-base font-medium text-foreground">1. Import file Excel</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Format kolom: NAME, NO_AGGR, NO_TELP_HP, MOD, BRAND, YEAR, SEGMEN, GROUP_PRODUCT /
            GROUP_STATUS, HANDLING. Semua sheet (CLOSE &amp; OPEN) ikut terbaca.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={() => fileRef.current?.click()} disabled={loading} className="gap-1.5">
              <FileSpreadsheet className="size-4" />
              {loading ? "Membaca file…" : "Pilih file Excel (.xlsx)"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={downloadTemplate}
              className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
            >
              <Download className="size-4" /> Unduh Template Excel (.xlsx)
            </Button>
            {fileName ? (
              <span className="text-xs text-muted-foreground">
                {fileName} · {staged.length} baris
              </span>
            ) : null}
            {staged.length ? (
              <Button
                variant="ghost"
                className="gap-1.5"
                onClick={() => {
                  setStaged([]);
                  setFileName("");
                }}
              >
                <Trash2 className="size-4" /> Bersihkan
              </Button>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await handleFile(file);
                e.target.value = "";
              }}
            />
          </div>
        </section>

        {staged.length ? (
          <>
            <section className="surface-card p-5">
              <h2 className="text-base font-medium text-foreground">
                2. Bagi customer ke sales (per rentang)
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Contoh: customer 1–50 ke Sales 1, 51–120 ke Sales 2. Ditugaskan: {assignedCount}{" "}
                dari {staged.length}.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="from">Dari nomor</Label>
                  <Input
                    id="from"
                    type="number"
                    min={1}
                    max={staged.length}
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="to">Sampai nomor</Label>
                  <Input
                    id="to"
                    type="number"
                    min={1}
                    max={staged.length}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sales penanggung jawab</Label>
                  <Select value={sales} onValueChange={setSales}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih sales" />
                    </SelectTrigger>
                    <SelectContent>
                      {salesList.map((a) => (
                        <SelectItem key={a.id} value={a.name.split(" ")[0] ?? a.name}>
                          {a.name} · {a.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={assignRange} className="gap-1.5">
                  <UserCheck className="size-4" /> Tugaskan
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={saveAll}>Simpan ke database ({staged.length})</Button>
              </div>
            </section>

            <section className="surface-card p-5">
              <h2 className="text-base font-medium text-foreground">Pratinjau data</h2>
              <div className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Nama</th>
                      <th className="px-3 py-2 font-medium">No. WA</th>
                      <th className="px-3 py-2 font-medium">Unit</th>
                      <th className="px-3 py-2 font-medium">Segmen</th>
                      <th className="px-3 py-2 font-medium">Handling</th>
                      <th className="px-3 py-2 font-medium">Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staged.slice(0, 300).map((r, i) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 text-foreground">{r.name}</td>
                        <td className="px-3 py-2">{r.phone || "-"}</td>
                        <td className="px-3 py-2">{r.unit}</td>
                        <td className="px-3 py-2">{r.segment}</td>
                        <td className="px-3 py-2">{r.region}</td>
                        <td className="px-3 py-2">
                          {r.owner === "Belum ditugaskan" ? (
                            <span className="text-muted-foreground">Belum ditugaskan</span>
                          ) : (
                            <span className="text-foreground">{r.owner}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {staged.length > 300 ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Menampilkan 300 baris pertama. Semua {staged.length} baris tetap ikut disimpan.
                </p>
              ) : null}
            </section>
          </>
        ) : null}

        <section className="surface-card p-5">
          <h2 className="text-base font-medium text-foreground">Export</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Unduh database customer dan riwayat follow up untuk laporan.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCustomers} className="gap-1.5">
              <Download className="size-4" /> Data customer ({customers.length})
            </Button>
            <Button variant="outline" onClick={exportFollowUps} className="gap-1.5">
              <Download className="size-4" /> Riwayat follow up ({followUps.length})
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
