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
    r.some(
      (c) =>
        norm(c).toUpperCase() === "NAMA" ||
        norm(c).toUpperCase() === "NAME" ||
        norm(c).toUpperCase() === "NO KONTRAK" ||
        norm(c).toUpperCase() === "NO_KONTRAK",
    ),
  );
  if (headerIdx === -1) return [];
  const header = rows[headerIdx]!.map((c) =>
    norm(c)
      .toUpperCase()
      .replace(/[\s_-]+/g, " "),
  );
  const col = (...names: string[]) => {
    for (const n of names) {
      const normalizedQuery = n.toUpperCase().replace(/[\s_-]+/g, " ");
      const i = header.indexOf(normalizedQuery);
      if (i !== -1) return i;
    }
    return -1;
  };

  const iName = col("NAMA", "NAME", "NAMA CUSTOMER", "CUSTOMER");
  const iAggr = col("NO KONTRAK", "NO_KONTRAK", "NOKONTRAK", "NO AGGR", "NO_AGGR", "KONTRAK");
  const iPhone = col(
    "NO TLP",
    "NO_TLP",
    "NOTLP",
    "NO TELP",
    "NO_TELP",
    "NO TELP HP",
    "NO_TELP_HP",
    "NO HP",
    "NO_HP",
    "TELEPON",
    "PHONE",
    "WA",
  );
  const iPost = col(
    "KODE POST",
    "KODE_POST",
    "KODE POS",
    "KODE_POS",
    "KODEPOS",
    "KODEPOST",
    "POSTAL CODE",
  );
  const iMod = col("MOD");
  const iUnitType = col(
    "TYPE UNIT",
    "TYPE_UNIT",
    "TYPEUNIT",
    "TIPE UNIT",
    "TIPE_UNIT",
    "MOD UNIT",
    "BRAND",
    "UNIT",
  );
  const iYear = col("TAHUN", "YEAR", "THN");
  const iStatus = col(
    "STATUS",
    "STATUS KONTRAK",
    "STATUS_KONTRAK",
    "GROUP PRODUCT",
    "GROUP_PRODUCT",
  );
  const iSeg = col("SEGMENTASI", "SEGMEN", "SEGMENT", "SEGMENTATION");
  const iHandling = col("HANDLING", "CABANG", "WILAYAH", "REGION", "CITY");

  const out: StagedRow[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const name = norm(row[iName]);
    if (!name) continue;

    const contractNumber = norm(row[iAggr]) || "-";
    const postalCode = norm(row[iPost]) || "-";
    const mod = norm(row[iMod]) || "-";
    const unitType = norm(row[iUnitType]) || "-";
    const year = norm(row[iYear]) || "";
    const contractStatus = norm(row[iStatus]) || "03. Open Berjalan";
    const segment = norm(row[iSeg]) || "-";
    const handling = norm(row[iHandling]) || "-";

    const unit = [unitType, year].filter(Boolean).join(" ").trim() || unitType || "-";

    let phone = norm(row[iPhone]).replace(/\D/g, "");
    if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;

    out.push({
      id: `imp${Date.now()}${out.length}`,
      name,
      contractNumber,
      phone,
      postalCode,
      mod,
      unitType,
      year,
      contractStatus,
      segment,
      handling,
      city: handling,
      company: contractStatus,
      product: unitType,
      unit,
      region: handling,
      value: 0,
      source: `Excel · ${sheetName}`,
      status: "Baru",
      owner: "Belum ditugaskan",
      note: `MOD ${mod} · ${segment} · Pos ${postalCode}`,
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}

function DataPage() {
  const { customers, followUps, accounts, addCustomers, syncNow, dbStatus } = useStore();
  const [staged, setStaged] = useState<StagedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("50");
  const [sales, setSales] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  const saveAll = async () => {
    if (!staged.length || isSaving) return;
    setIsSaving(true);
    try {
      const newCustomers = staged.map((r) => ({ ...r }));
      addCustomers(newCustomers);
      // Immediately force synchronous push to PostgreSQL backend
      await syncNow();
      toast.success(
        `${staged.length} customer berhasil disimpan dan disinkronkan ke database PostgreSQL!`,
      );
      setStaged([]);
      setFileName("");
    } catch {
      toast.error("Gagal menyimpan ke database server.");
    } finally {
      setIsSaving(false);
    }
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
          NAMA: "SAPARUDIN",
          "NO KONTRAK": "0150057400245421",
          "NO TLP": "085267475365",
          "KODE POST": "34163",
          MOD: "3",
          "TYPE UNIT": "KIJANG",
          TAHUN: "2001",
          STATUS: "03. Open Berjalan 56%-75%",
          SEGMENTASI: "SOLITAIRE",
          HANDLING: "BANDARJAYA",
        },
        {
          NAMA: "D. TIMOTHY. D",
          "NO KONTRAK": "0150057400244488",
          "NO TLP": "082326683090",
          "KODE POST": "34167",
          MOD: "3",
          "TYPE UNIT": "FUTURA",
          TAHUN: "2005",
          STATUS: "03. Open Berjalan 56%-75%",
          SEGMENTASI: "GOLD",
          HANDLING: "BANDARJAYA",
        },
        {
          NAMA: "HENDRA WIJAYA",
          "NO KONTRAK": "0150057400249821",
          "NO TLP": "081278901234",
          "KODE POST": "34165",
          MOD: "3",
          "TYPE UNIT": "AVANZA G",
          TAHUN: "2019",
          STATUS: "02. Open Berjalan 25%-55%",
          SEGMENTASI: "SILVER",
          HANDLING: "BANDARJAYA",
        },
      ];

      const ws = XLSX.utils.json_to_sheet(sampleData, {
        header: [
          "NAMA",
          "NO KONTRAK",
          "NO TLP",
          "KODE POST",
          "MOD",
          "TYPE UNIT",
          "TAHUN",
          "STATUS",
          "SEGMENTASI",
          "HANDLING",
        ],
      });

      // Set column widths for comfortable editing
      ws["!cols"] = [
        { wch: 24 }, // NAMA
        { wch: 22 }, // NO KONTRAK
        { wch: 18 }, // NO TLP
        { wch: 12 }, // KODE POST
        { wch: 8 }, // MOD
        { wch: 18 }, // TYPE UNIT
        { wch: 10 }, // TAHUN
        { wch: 28 }, // STATUS
        { wch: 16 }, // SEGMENTASI
        { wch: 18 }, // HANDLING
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DATA_CUSTOMER");

      XLSX.writeFile(wb, "template-import-customer-acc.xlsx");
      toast.success(
        "Template Excel 10 kolom berhasil diunduh. Silakan isi data dan upload kembali.",
      );
    } catch (err) {
      console.error(err);
      toast.error("Gagal membuat template Excel.");
    }
  };

  const exportCustomers = () =>
    download(
      "database-customer-acc.csv",
      [
        "NAMA,NO KONTRAK,NO TLP,KODE POST,MOD,TYPE UNIT,TAHUN,STATUS,SEGMENTASI,HANDLING,STATUS PIPELINE,SALES",
      ]
        .concat(
          customers.map((c) =>
            [
              `"${(c.name || "").replace(/"/g, '""')}"`,
              `"${(c.contractNumber || "").replace(/"/g, '""')}"`,
              `"${(c.phone || "").replace(/"/g, '""')}"`,
              `"${(c.postalCode || "").replace(/"/g, '""')}"`,
              `"${(c.mod || "").replace(/"/g, '""')}"`,
              `"${(c.unitType || c.product || "").replace(/"/g, '""')}"`,
              `"${(c.year || "").replace(/"/g, '""')}"`,
              `"${(c.contractStatus || c.company || "").replace(/"/g, '""')}"`,
              `"${(c.segment || "").replace(/"/g, '""')}"`,
              `"${(c.handling || c.region || "").replace(/"/g, '""')}"`,
              `"${(c.status || "").replace(/"/g, '""')}"`,
              `"${(c.owner || "").replace(/"/g, '""')}"`,
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
              `"${(f.reason || "").replace(/"/g, "'")}"`,
              `"${(f.nextAction || "").replace(/"/g, "'")}"`,
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
            Format 10 kolom baku: <strong>NAMA</strong>, <strong>NO KONTRAK</strong>,{" "}
            <strong>NO TLP</strong>, <strong>KODE POST</strong>, <strong>MOD</strong>,{" "}
            <strong>TYPE UNIT</strong>, <strong>TAHUN</strong>, <strong>STATUS</strong>,{" "}
            <strong>SEGMENTASI</strong>, <strong>HANDLING</strong>.
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
              <Download className="size-4" /> Unduh Template Excel 10 Kolom (.xlsx)
            </Button>
            {fileName ? (
              <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2 py-1 rounded">
                {fileName} · {staged.length} baris
              </span>
            ) : null}
            {staged.length ? (
              <Button
                variant="ghost"
                className="gap-1.5 text-destructive hover:bg-destructive/10"
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
                <Button
                  onClick={saveAll}
                  disabled={isSaving}
                  className="gap-1.5 font-medium shadow-sm"
                >
                  {isSaving ? (
                    <>Menyimpan ke PostgreSQL...</>
                  ) : (
                    <>Simpan ke Database PostgreSQL ({staged.length} data)</>
                  )}
                </Button>
              </div>
            </section>

            <section className="surface-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-medium text-foreground">
                    Pratinjau Data Impor ({staged.length} Baris)
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Memeriksa struktur 10 kolom sebelum disimpan ke database aktif.
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {assignedCount} dari {staged.length} ditugaskan
                </span>
              </div>
              <div className="mt-3 max-h-[480px] overflow-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="sticky top-0 bg-muted text-muted-foreground shadow-sm">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">#</th>
                      <th className="px-3 py-2.5 font-medium">NAMA</th>
                      <th className="px-3 py-2.5 font-medium">NO KONTRAK</th>
                      <th className="px-3 py-2.5 font-medium">NO TLP</th>
                      <th className="px-3 py-2.5 font-medium">KODE POST</th>
                      <th className="px-3 py-2.5 font-medium">MOD</th>
                      <th className="px-3 py-2.5 font-medium">TYPE UNIT</th>
                      <th className="px-3 py-2.5 font-medium">TAHUN</th>
                      <th className="px-3 py-2.5 font-medium">STATUS</th>
                      <th className="px-3 py-2.5 font-medium">SEGMENTASI</th>
                      <th className="px-3 py-2.5 font-medium">HANDLING</th>
                      <th className="px-3 py-2.5 font-medium">SALES PIC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {staged.slice(0, 300).map((r, i) => (
                      <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-3 py-2 text-muted-foreground font-mono">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-foreground">{r.name}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {r.contractNumber}
                        </td>
                        <td className="px-3 py-2 font-mono text-emerald-600 dark:text-emerald-400">
                          {r.phone || "-"}
                        </td>
                        <td className="px-3 py-2">{r.postalCode || "-"}</td>
                        <td className="px-3 py-2">{r.mod || "-"}</td>
                        <td className="px-3 py-2 font-medium">{r.unitType || "-"}</td>
                        <td className="px-3 py-2">{r.year || "-"}</td>
                        <td className="px-3 py-2">
                          <span className="inline-block max-w-[180px] truncate text-[11px] bg-secondary/80 px-2 py-0.5 rounded">
                            {r.contractStatus}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-semibold text-primary">{r.segment}</span>
                        </td>
                        <td className="px-3 py-2">{r.handling}</td>
                        <td className="px-3 py-2">
                          {r.owner === "Belum ditugaskan" ? (
                            <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-[11px]">
                              Belum ditugaskan
                            </span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-500/10 px-2 py-0.5 rounded text-[11px]">
                              {r.owner}
                            </span>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-medium text-foreground">
                Database Customer Aktif ({customers.length})
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Semua data pelanggan tersimpan di database ACC One beserta 10 parameter lengkap.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={exportCustomers} className="gap-1.5">
                <Download className="size-4" /> Export Excel/CSV Customer ({customers.length})
              </Button>
              <Button variant="outline" onClick={exportFollowUps} className="gap-1.5">
                <Download className="size-4" /> Export Riwayat Follow Up ({followUps.length})
              </Button>
            </div>
          </div>

          {customers.length > 0 ? (
            <div className="mt-4 max-h-[440px] overflow-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="sticky top-0 bg-muted text-muted-foreground shadow-sm">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">#</th>
                    <th className="px-3 py-2.5 font-medium">NAMA</th>
                    <th className="px-3 py-2.5 font-medium">NO KONTRAK</th>
                    <th className="px-3 py-2.5 font-medium">NO TLP</th>
                    <th className="px-3 py-2.5 font-medium">KODE POST</th>
                    <th className="px-3 py-2.5 font-medium">MOD</th>
                    <th className="px-3 py-2.5 font-medium">TYPE UNIT</th>
                    <th className="px-3 py-2.5 font-medium">TAHUN</th>
                    <th className="px-3 py-2.5 font-medium">STATUS</th>
                    <th className="px-3 py-2.5 font-medium">SEGMENTASI</th>
                    <th className="px-3 py-2.5 font-medium">HANDLING</th>
                    <th className="px-3 py-2.5 font-medium">STATUS PROSPEK</th>
                    <th className="px-3 py-2.5 font-medium">SALES PIC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customers.map((c, i) => (
                    <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2 text-muted-foreground font-mono">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-foreground">{c.name}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {c.contractNumber}
                      </td>
                      <td className="px-3 py-2 font-mono text-emerald-600 dark:text-emerald-400">
                        {c.phone ? `+${c.phone}` : "-"}
                      </td>
                      <td className="px-3 py-2">{c.postalCode || "-"}</td>
                      <td className="px-3 py-2">{c.mod || "-"}</td>
                      <td className="px-3 py-2 font-medium">{c.unitType || c.product || "-"}</td>
                      <td className="px-3 py-2">{c.year || "-"}</td>
                      <td className="px-3 py-2">
                        <span className="inline-block max-w-[180px] truncate text-[11px] bg-secondary/80 px-2 py-0.5 rounded">
                          {c.contractStatus || c.company || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-semibold text-primary">{c.segment}</span>
                      </td>
                      <td className="px-3 py-2">{c.handling || c.region}</td>
                      <td className="px-3 py-2">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {c.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{c.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 p-8 text-center border border-dashed rounded-lg text-muted-foreground text-sm">
              Belum ada data customer di database. Silakan unduh template Excel dan upload file
              data.
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
