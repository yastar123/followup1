import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Trash2,
  UserCheck,
  Plus,
  Pencil,
  Search,
  Filter,
  MoreHorizontal,
  X,
  Building2,
  Tag,
  Phone,
  FileText,
  User,
  Hash,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
  CheckSquare,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const defaultFormState = {
  name: "",
  contractNumber: "",
  phone: "",
  postalCode: "",
  mod: "",
  unitType: "",
  year: "",
  contractStatus: "03. Open Berjalan 56%-75%",
  segment: "GOLD",
  handling: "BANDARJAYA",
  status: "Baru" as Customer["status"],
  owner: "Belum ditugaskan",
  note: "",
};

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
  const {
    customers,
    followUps,
    accounts,
    addCustomer,
    updateCustomer,
    removeCustomer,
    deleteCustomers,
    clearAllCustomers,
    addCustomers,
    syncNow,
  } = useStore();

  const [staged, setStaged] = useState<StagedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("50");
  const [sales, setSales] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Search & Filter State for Active Customers Table
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [filterSales, setFilterSales] = useState("Semua");
  const [filterSegment, setFilterSegment] = useState("Semua");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // CRUD Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(defaultFormState);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState(defaultFormState);

  const [isDeleteSingleOpen, setIsDeleteSingleOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const [isDeleteBatchOpen, setIsDeleteBatchOpen] = useState(false);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);

  const [isBatchAssignOpen, setIsBatchAssignOpen] = useState(false);
  const [batchSalesTarget, setBatchSalesTarget] = useState("");

  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Range Assign State for Saved Database Customers
  const [dbFrom, setDbFrom] = useState("1");
  const [dbTo, setDbTo] = useState("3");
  const [dbSales, setDbSales] = useState("");
  const [isDbAssigning, setIsDbAssigning] = useState(false);

  const salesList = useMemo(
    () => accounts.filter((a) => a.role === "sales" && a.active),
    [accounts],
  );

  const segmentOptions = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.segment && c.segment !== "-") set.add(c.segment);
    });
    return Array.from(set);
  }, [customers]);

  const assignedCount = staged.filter((r) => r.owner !== "Belum ditugaskan").length;

  const assignedDbCount = useMemo(
    () => customers.filter((c) => c.owner && c.owner !== "Belum ditugaskan").length,
    [customers],
  );

  useEffect(() => {
    if (customers.length > 0) {
      setDbTo((prev) => {
        const num = Number(prev);
        if (isNaN(num) || num <= 0 || num > customers.length) {
          return String(Math.min(3, customers.length));
        }
        return prev;
      });
    }
  }, [customers.length]);

  const dbRangeCount = useMemo(() => {
    const a = Math.max(1, Number(dbFrom) || 1);
    const b = Math.min(customers.length, Number(dbTo) || 0);
    return b >= a ? b - a + 1 : 0;
  }, [dbFrom, dbTo, customers.length]);

  const handleAssignDbRange = async () => {
    const a = Math.max(1, Number(dbFrom) || 1);
    const b = Math.min(customers.length, Number(dbTo) || 0);

    if (!dbSales) {
      toast.error("Pilih sales penanggung jawab terlebih dahulu.");
      return;
    }
    if (!customers.length) {
      toast.error("Tidak ada data customer di database.");
      return;
    }
    if (b < a) {
      toast.error("Rentang nomor tidak valid.");
      return;
    }

    setIsDbAssigning(true);
    try {
      const ownerName = `Sales · ${dbSales}`;
      const targetCustomers = customers.slice(a - 1, b);

      targetCustomers.forEach((c) => {
        updateCustomer(c.id, { owner: ownerName });
      });

      await syncNow();
      toast.success(
        `Customer nomor ${a}–${b} (${targetCustomers.length} data) berhasil ditugaskan ke ${dbSales} dan disinkronkan ke PostgreSQL!`,
      );
    } catch {
      toast.error("Gagal menyimpan penugasan ke database PostgreSQL.");
    } finally {
      setIsDbAssigning(false);
    }
  };

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
        toast.error("Tidak menemukan baris customer. Pastikan ada kolom NAMA.");
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

  // Filtered Active Customers List
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.contractNumber && c.contractNumber.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.postalCode && c.postalCode.toLowerCase().includes(q)) ||
        (c.mod && c.mod.toLowerCase().includes(q)) ||
        (c.unitType && c.unitType.toLowerCase().includes(q)) ||
        (c.handling && c.handling.toLowerCase().includes(q)) ||
        (c.owner && c.owner.toLowerCase().includes(q));

      const matchStatus = filterStatus === "Semua" || c.status === filterStatus;
      const matchSales =
        filterSales === "Semua"
          ? true
          : filterSales === "Belum ditugaskan"
            ? c.owner === "Belum ditugaskan" || !c.owner
            : c.owner.toLowerCase().includes(filterSales.toLowerCase());
      const matchSegment = filterSegment === "Semua" || c.segment === filterSegment;

      return matchSearch && matchStatus && matchSales && matchSegment;
    });
  }, [customers, searchQuery, filterStatus, filterSales, filterSegment]);

  // Checkbox Selection Logic
  const isAllSelected =
    filteredCustomers.length > 0 && filteredCustomers.every((c) => selectedIds.includes(c.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCustomers.map((c) => c.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // CRUD Handlers
  const handleOpenAdd = () => {
    setAddForm(defaultFormState);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setEditForm({
      name: c.name || "",
      contractNumber: c.contractNumber || "",
      phone: c.phone || "",
      postalCode: c.postalCode || "",
      mod: c.mod || "",
      unitType: c.unitType || c.product || "",
      year: c.year || "",
      contractStatus: c.contractStatus || c.company || "03. Open Berjalan 56%-75%",
      segment: c.segment || "GOLD",
      handling: c.handling || c.region || "BANDARJAYA",
      status: c.status || "Baru",
      owner: c.owner || "Belum ditugaskan",
      note: c.note || "",
    });
    setIsEditOpen(true);
  };

  const handleSaveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = addForm.name.trim();
    if (!cleanName) {
      toast.error("Nama customer wajib diisi.");
      return;
    }
    setIsSavingCustomer(true);
    try {
      let phone = addForm.phone.trim().replace(/\D/g, "");
      if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;

      const newCustomer: Omit<Customer, "id"> & { id?: string } = {
        name: cleanName,
        contractNumber: addForm.contractNumber.trim() || "-",
        phone,
        postalCode: addForm.postalCode.trim() || "-",
        mod: addForm.mod.trim() || "-",
        unitType: addForm.unitType.trim() || "-",
        year: addForm.year.trim() || "",
        contractStatus: addForm.contractStatus.trim() || "03. Open Berjalan",
        segment: addForm.segment.trim() || "SILVER",
        handling: addForm.handling.trim() || "BANDARJAYA",
        city: addForm.handling.trim() || "BANDARJAYA",
        company: addForm.contractStatus.trim() || "03. Open Berjalan",
        product: addForm.unitType.trim() || "-",
        unit: [addForm.unitType.trim(), addForm.year.trim()].filter(Boolean).join(" ") || "-",
        region: addForm.handling.trim() || "BANDARJAYA",
        value: 0,
        source: "Input Manual Admin",
        status: addForm.status,
        owner: addForm.owner || "Belum ditugaskan",
        note: addForm.note.trim(),
        createdAt: new Date().toISOString(),
      };

      addCustomer(newCustomer);
      await syncNow();
      toast.success(`Customer "${cleanName}" berhasil ditambahkan dan disinkronkan ke PostgreSQL!`);
      setIsAddOpen(false);
      setAddForm(defaultFormState);
    } catch {
      toast.error("Gagal menyimpan data customer baru.");
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleSaveEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    const cleanName = editForm.name.trim();
    if (!cleanName) {
      toast.error("Nama customer wajib diisi.");
      return;
    }
    setIsSavingCustomer(true);
    try {
      let phone = editForm.phone.trim().replace(/\D/g, "");
      if (phone.startsWith("0")) phone = `62${phone.slice(1)}`;

      updateCustomer(editingCustomer.id, {
        name: cleanName,
        contractNumber: editForm.contractNumber.trim() || "-",
        phone,
        postalCode: editForm.postalCode.trim() || "-",
        mod: editForm.mod.trim() || "-",
        unitType: editForm.unitType.trim() || "-",
        year: editForm.year.trim() || "",
        contractStatus: editForm.contractStatus.trim() || "03. Open Berjalan",
        segment: editForm.segment.trim() || "-",
        handling: editForm.handling.trim() || "-",
        city: editForm.handling.trim() || "-",
        company: editForm.contractStatus.trim() || "-",
        product: editForm.unitType.trim() || "-",
        unit: [editForm.unitType.trim(), editForm.year.trim()].filter(Boolean).join(" ") || "-",
        region: editForm.handling.trim() || "-",
        status: editForm.status,
        owner: editForm.owner || "Belum ditugaskan",
        note: editForm.note.trim(),
      });

      await syncNow();
      toast.success(`Data "${cleanName}" berhasil diperbarui dan disinkronkan ke PostgreSQL!`);
      setIsEditOpen(false);
      setEditingCustomer(null);
    } catch {
      toast.error("Gagal memperbarui data customer.");
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleConfirmDeleteSingle = async () => {
    if (!customerToDelete) return;
    setIsSavingCustomer(true);
    try {
      removeCustomer(customerToDelete.id);
      await syncNow();
      toast.success(`Customer "${customerToDelete.name}" berhasil dihapus dari database.`);
      setIsDeleteSingleOpen(false);
      setCustomerToDelete(null);
      setSelectedIds((prev) => prev.filter((id) => id !== customerToDelete.id));
    } catch {
      toast.error("Gagal menghapus customer.");
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleConfirmDeleteBatch = async () => {
    if (!selectedIds.length) return;
    setIsSavingCustomer(true);
    try {
      const count = selectedIds.length;
      deleteCustomers(selectedIds);
      await syncNow();
      toast.success(`${count} data customer berhasil dihapus dari database.`);
      setIsDeleteBatchOpen(false);
      setSelectedIds([]);
    } catch {
      toast.error("Gagal menghapus data customer.");
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleConfirmClearAll = async () => {
    setIsSavingCustomer(true);
    try {
      clearAllCustomers();
      await syncNow();
      toast.success("Seluruh database customer berhasil dikosongkan.");
      setIsClearAllOpen(false);
      setSelectedIds([]);
    } catch {
      toast.error("Gagal mengosongkan database.");
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleConfirmBatchAssign = async () => {
    if (!selectedIds.length || !batchSalesTarget) {
      toast.error("Pilih sales penanggung jawab.");
      return;
    }
    setIsSavingCustomer(true);
    try {
      const ownerName = `Sales · ${batchSalesTarget}`;
      selectedIds.forEach((id) => {
        updateCustomer(id, { owner: ownerName });
      });
      await syncNow();
      toast.success(`${selectedIds.length} customer berhasil ditugaskan ke ${batchSalesTarget}.`);
      setIsBatchAssignOpen(false);
      setSelectedIds([]);
    } catch {
      toast.error("Gagal menugaskan sales.");
    } finally {
      setIsSavingCustomer(false);
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

      ws["!cols"] = [
        { wch: 24 },
        { wch: 22 },
        { wch: 18 },
        { wch: 12 },
        { wch: 8 },
        { wch: 18 },
        { wch: 10 },
        { wch: 28 },
        { wch: 16 },
        { wch: 18 },
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
      subtitle="Import database Excel, kelola CRUD customer, dan bagi penanganan ke sales."
    >
      <div className="grid gap-6">
        {/* Section 1: Excel Import */}
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

        {/* Section 2: Assign Range & Staged Table */}
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

        {/* Section 3: Database Customer Aktif (CRUD Section) */}
        <section className="surface-card p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-medium text-foreground">
                  Database Customer Aktif ({customers.length})
                </h2>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                >
                  PostgreSQL Sync Active
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Semua data pelanggan tersimpan di database ACC One beserta 10 parameter lengkap.
                Anda dapat Tambah (Create), Edit (Update), Hapus (Delete), serta Filter & Eksport
                data.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={handleOpenAdd} className="gap-1.5 font-medium">
                <Plus className="size-4" /> Tambah Customer Baru
              </Button>
              <Button variant="outline" onClick={exportCustomers} className="gap-1.5">
                <Download className="size-4" /> Export Excel/CSV ({customers.length})
              </Button>
              <Button variant="outline" onClick={exportFollowUps} className="gap-1.5">
                <Download className="size-4" /> Export Follow Up ({followUps.length})
              </Button>
              {customers.length > 0 ? (
                <Button
                  variant="outline"
                  onClick={() => setIsClearAllOpen(true)}
                  className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="size-4" /> Kosongkan DB
                </Button>
              ) : null}
            </div>
          </div>

          {/* Range Assign Bar for Active PostgreSQL Database Customers */}
          {customers.length > 0 ? (
            <div className="mt-5 p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <UserCheck className="size-4 text-primary" /> Bagi customer ke sales (per
                    rentang)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Contoh: customer 1–50 ke Sales 1, 51–120 ke Sales 2. Ditugaskan:{" "}
                    {assignedDbCount} dari {customers.length}.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="w-fit text-[11px] font-mono bg-background border-primary/30 text-primary"
                >
                  {assignedDbCount} dari {customers.length} ditugaskan
                </Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="dbFrom" className="text-xs font-medium">
                    Dari nomor
                  </Label>
                  <Input
                    id="dbFrom"
                    type="number"
                    min={1}
                    max={customers.length}
                    value={dbFrom}
                    onChange={(e) => setDbFrom(e.target.value)}
                    className="bg-background text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dbTo" className="text-xs font-medium">
                    Sampai nomor
                  </Label>
                  <Input
                    id="dbTo"
                    type="number"
                    min={1}
                    max={customers.length}
                    value={dbTo}
                    onChange={(e) => setDbTo(e.target.value)}
                    className="bg-background text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Sales penanggung jawab</Label>
                  <Select value={dbSales} onValueChange={setDbSales}>
                    <SelectTrigger className="bg-background text-xs">
                      <SelectValue placeholder="Pilih sales" />
                    </SelectTrigger>
                    <SelectContent>
                      {salesList.map((a) => {
                        const firstName = a.name.split(" ")[0] ?? a.name;
                        return (
                          <SelectItem key={a.id} value={firstName}>
                            {a.name} ({a.email})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAssignDbRange}
                  disabled={isDbAssigning}
                  className="gap-1.5 text-xs font-medium shadow-sm"
                >
                  <UserCheck className="size-4" />
                  {isDbAssigning ? (
                    "Menyimpan ke Database..."
                  ) : (
                    <>Tugaskan & Simpan ke PostgreSQL ({dbRangeCount} data)</>
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {/* Search, Filter & Controls Toolbar */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama, kontrak, no HP, unit, cabang..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            <div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Filter Status Prospek" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Semua">Semua Status Prospek</SelectItem>
                  <SelectItem value="Baru">Baru</SelectItem>
                  <SelectItem value="Proses">Proses</SelectItem>
                  <SelectItem value="Tertarik">Tertarik</SelectItem>
                  <SelectItem value="Tidak Tertarik">Tidak Tertarik</SelectItem>
                  <SelectItem value="Closing">Closing</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={filterSales} onValueChange={setFilterSales}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Filter Sales Penanggung Jawab" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Semua">Semua Sales</SelectItem>
                  <SelectItem value="Belum ditugaskan">Belum ditugaskan</SelectItem>
                  {salesList.map((a) => {
                    const firstName = a.name.split(" ")[0] ?? a.name;
                    return (
                      <SelectItem key={a.id} value={firstName}>
                        {a.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={filterSegment} onValueChange={setFilterSegment}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Filter Segmentasi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Semua">Semua Segmentasi</SelectItem>
                  {segmentOptions.map((seg) => (
                    <SelectItem key={seg} value={seg}>
                      Segmentasi: {seg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bulk Action Bar (When rows are checked) */}
          {selectedIds.length > 0 ? (
            <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in-50">
              <div className="flex items-center gap-2">
                <CheckSquare className="size-4 text-primary" />
                <span className="text-xs font-semibold text-primary">
                  {selectedIds.length} data customer dipilih
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsBatchAssignOpen(true)}
                  className="gap-1 text-xs border-primary/30 text-primary hover:bg-primary/10"
                >
                  <UserCheck className="size-3.5" /> Tugaskan Sales
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setIsDeleteBatchOpen(true)}
                  className="gap-1 text-xs"
                >
                  <Trash2 className="size-3.5" /> Hapus Selected ({selectedIds.length})
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-muted-foreground"
                >
                  Batal Pilih
                </Button>
              </div>
            </div>
          ) : null}

          {/* Table Active Customers */}
          {filteredCustomers.length > 0 ? (
            <div className="mt-4 max-h-[520px] overflow-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="sticky top-0 bg-muted text-muted-foreground shadow-sm z-10">
                  <tr>
                    <th className="px-3 py-2.5 font-medium w-8">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Pilih Semua"
                      />
                    </th>
                    <th className="px-3 py-2.5 font-medium">#</th>
                    <th className="px-3 py-2.5 font-medium">NAMA CUSTOMER</th>
                    <th className="px-3 py-2.5 font-medium">NO KONTRAK</th>
                    <th className="px-3 py-2.5 font-medium">NO TLP / WA</th>
                    <th className="px-3 py-2.5 font-medium">KODE POST</th>
                    <th className="px-3 py-2.5 font-medium">MOD</th>
                    <th className="px-3 py-2.5 font-medium">TYPE UNIT</th>
                    <th className="px-3 py-2.5 font-medium">TAHUN</th>
                    <th className="px-3 py-2.5 font-medium">STATUS KONTRAK</th>
                    <th className="px-3 py-2.5 font-medium">SEGMENTASI</th>
                    <th className="px-3 py-2.5 font-medium">HANDLING</th>
                    <th className="px-3 py-2.5 font-medium">STATUS PROSPEK</th>
                    <th className="px-3 py-2.5 font-medium">SALES PIC</th>
                    <th className="px-3 py-2.5 font-medium text-right pr-4">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCustomers.map((c, i) => {
                    const isChecked = selectedIds.includes(c.id);
                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-muted/40 transition-colors ${
                          isChecked ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleSelectOne(c.id)}
                            aria-label={`Pilih ${c.name}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground font-mono">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-foreground">
                          <div className="flex flex-col">
                            <span>{c.name}</span>
                            {c.source ? (
                              <span className="text-[10px] text-muted-foreground/70 font-mono">
                                {c.source}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {c.contractNumber || "-"}
                        </td>
                        <td className="px-3 py-2 font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                          {c.phone ? `+${c.phone}` : "-"}
                        </td>
                        <td className="px-3 py-2 font-mono">{c.postalCode || "-"}</td>
                        <td className="px-3 py-2 font-mono">{c.mod || "-"}</td>
                        <td className="px-3 py-2 font-medium">{c.unitType || c.product || "-"}</td>
                        <td className="px-3 py-2 font-mono">{c.year || "-"}</td>
                        <td className="px-3 py-2">
                          <span className="inline-block max-w-[180px] truncate text-[11px] bg-secondary/80 px-2 py-0.5 rounded">
                            {c.contractStatus || c.company || "-"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-semibold text-primary">{c.segment || "-"}</span>
                        </td>
                        <td className="px-3 py-2">{c.handling || c.region || "-"}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                              c.status === "Closing"
                                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                : c.status === "Tertarik"
                                  ? "bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                                  : c.status === "Proses"
                                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                    : c.status === "Tidak Tertarik"
                                      ? "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                                      : "bg-primary/10 text-primary border border-primary/20"
                            }`}
                          >
                            {c.status || "Baru"}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {c.owner === "Belum ditugaskan" || !c.owner ? (
                            <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-[11px]">
                              Belum ditugaskan
                            </span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-300 font-medium bg-emerald-500/10 px-2 py-0.5 rounded text-[11px]">
                              {c.owner}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right pr-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7 p-0">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                onClick={() => handleOpenEdit(c)}
                                className="gap-2 text-xs cursor-pointer"
                              >
                                <Pencil className="size-3.5 text-primary" /> Edit Parameter
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setCustomerToDelete(c);
                                  setIsDeleteSingleOpen(true);
                                }}
                                className="gap-2 text-xs text-destructive cursor-pointer focus:text-destructive"
                              >
                                <Trash2 className="size-3.5" /> Hapus Customer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 p-8 text-center border border-dashed rounded-lg text-muted-foreground text-sm space-y-2">
              <p>Tidak ada data customer yang sesuai dengan pencarian atau filter saat ini.</p>
              {customers.length === 0 ? (
                <Button onClick={handleOpenAdd} className="gap-1.5 mt-2">
                  <Plus className="size-4" /> Tambah Customer Pertama
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterStatus("Semua");
                    setFilterSales("Semua");
                    setFilterSegment("Semua");
                  }}
                  className="mt-2 text-xs"
                >
                  Reset Filter
                </Button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* MODAL 1: Tambah Customer Baru (Create) */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Plus className="size-5 text-primary" /> Tambah Data Customer Baru
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan 10 parameter data customer secara lengkap. Data akan langsung disinkronkan ke
              PostgreSQL.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveNewCustomer} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="add-name" className="text-xs font-semibold">
                  Nama Customer <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="add-name"
                    value={addForm.name}
                    onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Contoh: SAPARUDIN"
                    className="pl-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-contract" className="text-xs font-semibold">
                  No. Kontrak
                </Label>
                <div className="relative">
                  <Hash className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="add-contract"
                    value={addForm.contractNumber}
                    onChange={(e) => setAddForm((p) => ({ ...p, contractNumber: e.target.value }))}
                    placeholder="0150057400245421"
                    className="pl-9 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-phone" className="text-xs font-semibold">
                  No. Telepon / WhatsApp
                </Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="add-phone"
                    value={addForm.phone}
                    onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="085267475365"
                    className="pl-9 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-postal" className="text-xs font-semibold">
                  Kode Pos (Postal Code)
                </Label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="add-postal"
                    value={addForm.postalCode}
                    onChange={(e) => setAddForm((p) => ({ ...p, postalCode: e.target.value }))}
                    placeholder="34163"
                    className="pl-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-mod" className="text-xs font-semibold">
                  MOD
                </Label>
                <Input
                  id="add-mod"
                  value={addForm.mod}
                  onChange={(e) => setAddForm((p) => ({ ...p, mod: e.target.value }))}
                  placeholder="3"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-unit" className="text-xs font-semibold">
                  Type Unit / Tipe Kendaraan
                </Label>
                <Input
                  id="add-unit"
                  value={addForm.unitType}
                  onChange={(e) => setAddForm((p) => ({ ...p, unitType: e.target.value }))}
                  placeholder="KIJANG / AVANZA G"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-year" className="text-xs font-semibold">
                  Tahun Unit
                </Label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="add-year"
                    value={addForm.year}
                    onChange={(e) => setAddForm((p) => ({ ...p, year: e.target.value }))}
                    placeholder="2019"
                    className="pl-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-status-contract" className="text-xs font-semibold">
                  Status Kontrak
                </Label>
                <Input
                  id="add-status-contract"
                  value={addForm.contractStatus}
                  onChange={(e) => setAddForm((p) => ({ ...p, contractStatus: e.target.value }))}
                  placeholder="03. Open Berjalan 56%-75%"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-segment" className="text-xs font-semibold">
                  Segmentasi Customer
                </Label>
                <Select
                  value={addForm.segment}
                  onValueChange={(val) => setAddForm((p) => ({ ...p, segment: val }))}
                >
                  <SelectTrigger id="add-segment" className="text-xs">
                    <SelectValue placeholder="Pilih Segmentasi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOLITAIRE">SOLITAIRE</SelectItem>
                    <SelectItem value="GOLD">GOLD</SelectItem>
                    <SelectItem value="SILVER">SILVER</SelectItem>
                    <SelectItem value="PLATINUM">PLATINUM</SelectItem>
                    <SelectItem value="REGULAR">REGULAR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-handling" className="text-xs font-semibold">
                  Handling / Cabang
                </Label>
                <Input
                  id="add-handling"
                  value={addForm.handling}
                  onChange={(e) => setAddForm((p) => ({ ...p, handling: e.target.value }))}
                  placeholder="BANDARJAYA"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-status-pipeline" className="text-xs font-semibold">
                  Status Prospek (Pipeline)
                </Label>
                <Select
                  value={addForm.status}
                  onValueChange={(val) =>
                    setAddForm((p) => ({ ...p, status: val as Customer["status"] }))
                  }
                >
                  <SelectTrigger id="add-status-pipeline" className="text-xs">
                    <SelectValue placeholder="Pilih Status Prospek" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baru">Baru</SelectItem>
                    <SelectItem value="Proses">Proses</SelectItem>
                    <SelectItem value="Tertarik">Tertarik</SelectItem>
                    <SelectItem value="Tidak Tertarik">Tidak Tertarik</SelectItem>
                    <SelectItem value="Closing">Closing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-owner" className="text-xs font-semibold">
                  Sales Penanggung Jawab (PIC)
                </Label>
                <Select
                  value={addForm.owner}
                  onValueChange={(val) => setAddForm((p) => ({ ...p, owner: val }))}
                >
                  <SelectTrigger id="add-owner" className="text-xs">
                    <SelectValue placeholder="Pilih Sales PIC" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Belum ditugaskan">Belum ditugaskan</SelectItem>
                    {salesList.map((a) => (
                      <SelectItem key={a.id} value={`Sales · ${a.name.split(" ")[0] ?? a.name}`}>
                        {a.name} ({a.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="add-note" className="text-xs font-semibold">
                  Catatan Internal
                </Label>
                <Textarea
                  id="add-note"
                  value={addForm.note}
                  onChange={(e) => setAddForm((p) => ({ ...p, note: e.target.value }))}
                  placeholder="Catatan penanganan atau preferensi customer..."
                  className="text-xs min-h-[60px]"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSavingCustomer}>
                {isSavingCustomer ? "Menyimpan..." : "Simpan Customer ke DB"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Edit Customer (Update) */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil className="size-5 text-primary" /> Edit Parameter Customer
            </DialogTitle>
            <DialogDescription className="text-xs">
              Perbarui 10 parameter data customer. Perubahan langsung tersimpan ke PostgreSQL.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEditCustomer} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-name" className="text-xs font-semibold">
                  Nama Customer <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Nama Customer"
                    className="pl-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-contract" className="text-xs font-semibold">
                  No. Kontrak
                </Label>
                <div className="relative">
                  <Hash className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="edit-contract"
                    value={editForm.contractNumber}
                    onChange={(e) => setEditForm((p) => ({ ...p, contractNumber: e.target.value }))}
                    className="pl-9 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-phone" className="text-xs font-semibold">
                  No. Telepon / WhatsApp
                </Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="edit-phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    className="pl-9 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-postal" className="text-xs font-semibold">
                  Kode Pos (Postal Code)
                </Label>
                <Input
                  id="edit-postal"
                  value={editForm.postalCode}
                  onChange={(e) => setEditForm((p) => ({ ...p, postalCode: e.target.value }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-mod" className="text-xs font-semibold">
                  MOD
                </Label>
                <Input
                  id="edit-mod"
                  value={editForm.mod}
                  onChange={(e) => setEditForm((p) => ({ ...p, mod: e.target.value }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-unit" className="text-xs font-semibold">
                  Type Unit / Tipe Kendaraan
                </Label>
                <Input
                  id="edit-unit"
                  value={editForm.unitType}
                  onChange={(e) => setEditForm((p) => ({ ...p, unitType: e.target.value }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-year" className="text-xs font-semibold">
                  Tahun Unit
                </Label>
                <Input
                  id="edit-year"
                  value={editForm.year}
                  onChange={(e) => setEditForm((p) => ({ ...p, year: e.target.value }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-status-contract" className="text-xs font-semibold">
                  Status Kontrak
                </Label>
                <Input
                  id="edit-status-contract"
                  value={editForm.contractStatus}
                  onChange={(e) => setEditForm((p) => ({ ...p, contractStatus: e.target.value }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-segment" className="text-xs font-semibold">
                  Segmentasi Customer
                </Label>
                <Input
                  id="edit-segment"
                  value={editForm.segment}
                  onChange={(e) => setEditForm((p) => ({ ...p, segment: e.target.value }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-handling" className="text-xs font-semibold">
                  Handling / Cabang
                </Label>
                <Input
                  id="edit-handling"
                  value={editForm.handling}
                  onChange={(e) => setEditForm((p) => ({ ...p, handling: e.target.value }))}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-status-pipeline" className="text-xs font-semibold">
                  Status Prospek (Pipeline)
                </Label>
                <Select
                  value={editForm.status}
                  onValueChange={(val) =>
                    setEditForm((p) => ({ ...p, status: val as Customer["status"] }))
                  }
                >
                  <SelectTrigger id="edit-status-pipeline" className="text-xs">
                    <SelectValue placeholder="Pilih Status Prospek" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Baru">Baru</SelectItem>
                    <SelectItem value="Proses">Proses</SelectItem>
                    <SelectItem value="Tertarik">Tertarik</SelectItem>
                    <SelectItem value="Tidak Tertarik">Tidak Tertarik</SelectItem>
                    <SelectItem value="Closing">Closing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-owner" className="text-xs font-semibold">
                  Sales Penanggung Jawab (PIC)
                </Label>
                <Select
                  value={editForm.owner}
                  onValueChange={(val) => setEditForm((p) => ({ ...p, owner: val }))}
                >
                  <SelectTrigger id="edit-owner" className="text-xs">
                    <SelectValue placeholder="Pilih Sales PIC" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Belum ditugaskan">Belum ditugaskan</SelectItem>
                    {salesList.map((a) => (
                      <SelectItem key={a.id} value={`Sales · ${a.name.split(" ")[0] ?? a.name}`}>
                        {a.name} ({a.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="edit-note" className="text-xs font-semibold">
                  Catatan Internal
                </Label>
                <Textarea
                  id="edit-note"
                  value={editForm.note}
                  onChange={(e) => setEditForm((p) => ({ ...p, note: e.target.value }))}
                  className="text-xs min-h-[60px]"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSavingCustomer}>
                {isSavingCustomer ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG 1: Hapus Single Customer */}
      <AlertDialog open={isDeleteSingleOpen} onOpenChange={setIsDeleteSingleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Hapus Customer dari Database?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Apakah Anda yakin ingin menghapus data customer{" "}
              <strong>{customerToDelete?.name}</strong> (No Kontrak:{" "}
              {customerToDelete?.contractNumber || "-"})? Tindakan ini akan menghapus data secara
              permanen dari database PostgreSQL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCustomerToDelete(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteSingle}
              disabled={isSavingCustomer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSavingCustomer ? "Menghapus..." : "Ya, Hapus Customer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ALERT DIALOG 2: Hapus Batch Selected */}
      <AlertDialog open={isDeleteBatchOpen} onOpenChange={setIsDeleteBatchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Hapus {selectedIds.length} Data Customer
              Terpilih?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Anda memilih <strong>{selectedIds.length} data customer</strong> untuk dihapus
              sekaligus. Tindakan ini tidak dapat dibatalkan dan data akan dihapus permanen dari
              PostgreSQL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteBatch}
              disabled={isSavingCustomer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSavingCustomer ? "Menghapus..." : `Hapus ${selectedIds.length} Data`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ALERT DIALOG 3: Kosongkan Seluruh Database */}
      <AlertDialog open={isClearAllOpen} onOpenChange={setIsClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" /> Kosongkan Seluruh Database Customer?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Tindakan ini akan menghapus <strong>semua {customers.length} data customer</strong>{" "}
              yang tersimpan di database ACC One. Gunakan ini jika Anda ingin mereset dan mengunggah
              ulang data dari Excel baru.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClearAll}
              disabled={isSavingCustomer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSavingCustomer ? "Mengosongkan..." : "Ya, Kosongkan Semua Data"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG 4: Tugaskan Sales Massal */}
      <Dialog open={isBatchAssignOpen} onOpenChange={setIsBatchAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserCheck className="size-5 text-primary" /> Tugaskan {selectedIds.length} Customer
              ke Sales
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pilih petugas sales yang akan menangani {selectedIds.length} customer terpilih.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Sales Penanggung Jawab</Label>
              <Select value={batchSalesTarget} onValueChange={setBatchSalesTarget}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Pilih Sales PIC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Belum ditugaskan">Belum ditugaskan (Reset)</SelectItem>
                  {salesList.map((a) => {
                    const firstName = a.name.split(" ")[0] ?? a.name;
                    return (
                      <SelectItem key={a.id} value={firstName}>
                        {a.name} ({a.email})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsBatchAssignOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleConfirmBatchAssign}
              disabled={isSavingCustomer || !batchSalesTarget}
            >
              {isSavingCustomer ? "Menyimpan..." : "Tugaskan Sales"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
