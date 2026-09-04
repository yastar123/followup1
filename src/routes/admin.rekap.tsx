import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Filter,
  PhoneCall,
  RotateCcw,
  Search,
  UserCheck,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Pager } from "@/components/Pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/admin/rekap")({
  head: () => ({
    meta: [
      { title: "Rekap Customer & Follow Up — ACC One" },
      {
        name: "description",
        content:
          "Rekap seluruh customer beserta jumlah follow up, hasil terakhir, dan performa per sales penanggung jawab.",
      },
      { property: "og:title", content: "Rekap Customer & Follow Up — ACC One" },
      {
        property: "og:description",
        content: "Rekap data customer, follow up, dan filter performa per sales.",
      },
    ],
  }),
  component: RekapPage,
});

const PAGE_SIZE = 10;

function RekapPage() {
  const { customers, followUps, accounts } = useStore();

  const [q, setQ] = useState("");
  const [selectedSales, setSelectedSales] = useState("all");
  const [fuStatus, setFuStatus] = useState<"all" | "done" | "pending">("all");
  const [selectedResult, setSelectedResult] = useState<string>("all");
  const [selectedSegment, setSelectedSegment] = useState<string>("all");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [page, setPage] = useState(1);

  // List of sales accounts & owners
  const salesList = useMemo(() => {
    const list = new Set<string>();
    accounts
      .filter((a) => a.role === "sales" && a.active !== false)
      .forEach((a) => list.add(a.name));
    customers.forEach((c) => {
      if (c.owner && c.owner !== "Belum ditugaskan") {
        list.add(c.owner);
      }
    });
    return Array.from(list).sort();
  }, [accounts, customers]);

  // List of unique segments
  const segmentList = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.segment) set.add(c.segment);
    });
    return Array.from(set).sort();
  }, [customers]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return customers.filter((c) => {
      // Search text
      if (q.trim()) {
        const term = q.trim().toLowerCase();
        const searchPool = [
          c.name,
          c.contractNumber,
          c.phone,
          c.postalCode,
          c.mod,
          c.unitType,
          c.year,
          c.unit,
          c.contractStatus,
          c.segment,
          c.handling,
          c.owner,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchPool.includes(term)) return false;
      }

      // Filter Sales PIC
      if (selectedSales !== "all") {
        if (selectedSales === "unassigned") {
          if (c.owner && c.owner !== "Belum ditugaskan") return false;
        } else {
          if (c.owner !== selectedSales) return false;
        }
      }

      const list = followUps.filter((f) => f.customerId === c.id);
      const isDone = list.length > 0;
      const last = list[0];

      // Filter Follow Up Status
      if (fuStatus === "done" && !isDone) return false;
      if (fuStatus === "pending" && isDone) return false;

      // Filter Result
      if (selectedResult !== "all") {
        if (selectedResult === "none") {
          if (isDone) return false;
        } else if (selectedResult === "no_wa") {
          if (!last || !last.reason?.toLowerCase().includes("tidak ada nomor wa")) return false;
        } else {
          if (!last || (last.interest !== selectedResult && last.outcome !== selectedResult)) {
            return false;
          }
        }
      }

      // Filter Segment
      if (selectedSegment !== "all" && c.segment !== selectedSegment) {
        return false;
      }

      // Filter Channel
      if (selectedChannel !== "all") {
        if (!last || last.channel !== selectedChannel) return false;
      }

      return true;
    });
  }, [
    customers,
    followUps,
    q,
    selectedSales,
    fuStatus,
    selectedResult,
    selectedSegment,
    selectedChannel,
  ]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  const hasActiveFilter =
    q !== "" ||
    selectedSales !== "all" ||
    fuStatus !== "all" ||
    selectedResult !== "all" ||
    selectedSegment !== "all" ||
    selectedChannel !== "all";

  const handleResetFilters = () => {
    setQ("");
    setSelectedSales("all");
    setFuStatus("all");
    setSelectedResult("all");
    setSelectedSegment("all");
    setSelectedChannel("all");
    setPage(1);
  };

  // Overall & Per-Sales Statistics
  const stats = useMemo(() => {
    const baseCustomers =
      selectedSales === "all"
        ? customers
        : selectedSales === "unassigned"
          ? customers.filter((c) => !c.owner || c.owner === "Belum ditugaskan")
          : customers.filter((c) => c.owner === selectedSales);

    const total = baseCustomers.length;
    let done = 0;
    let prospects = 0;
    let totalFollowUpCalls = 0;

    baseCustomers.forEach((c) => {
      const list = followUps.filter((f) => f.customerId === c.id);
      if (list.length > 0) {
        done++;
        totalFollowUpCalls += list.length;
        const last = list[0];
        if (
          last.interest === "Prospek" ||
          last.interest === "Kirim simulasi" ||
          last.outcome === "Chat dibalas"
        ) {
          prospects++;
        }
      }
    });

    const pending = total - done;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, done, pending, prospects, totalFollowUpCalls, rate };
  }, [customers, followUps, selectedSales]);

  return (
    <AppShell
      role="admin"
      title="Rekap Data Customer & Follow Up"
      subtitle="Pantau rekapan data customer, status follow up, dan performa per sales secara terpadu."
    >
      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <div className="surface-card p-4">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total Customer</span>
            <Users className="size-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedSales === "all" ? "Semua sales" : `PIC: ${selectedSales}`}
          </p>
        </div>

        <div className="surface-card p-4">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Sudah Follow Up</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{stats.done}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{stats.rate}% selesai diproses</p>
        </div>

        <div className="surface-card p-4">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Belum Follow Up</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-500">{stats.pending}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Menunggu penanganan</p>
        </div>

        <div className="surface-card p-4">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">
              Prospek / Terhubung
            </span>
            <PhoneCall className="size-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.prospects}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Respon aktif & minat</p>
        </div>
      </div>

      {/* Filter Control Box */}
      <div className="surface-card p-4 mb-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Filter Rekap Data &amp; Sales</h2>
          </div>
          {hasActiveFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <RotateCcw className="size-3.5" /> Reset Filter
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* Search Input */}
          <div className="space-y-1.5 xl:col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Pencarian
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari nama, no. kontrak, unit, telepon..."
                className="pl-8.5 h-9 text-xs"
              />
            </div>
          </div>

          {/* Filter Per Sales */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <UserCheck className="size-3 text-primary" /> Filter Sales PIC
            </label>
            <select
              value={selectedSales}
              onChange={(e) => {
                setSelectedSales(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">Semua Sales PIC</option>
              <option value="unassigned">Belum Ditugaskan</option>
              {salesList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Status Follow Up */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Status Follow Up
            </label>
            <select
              value={fuStatus}
              onChange={(e) => {
                setFuStatus(e.target.value as "all" | "done" | "pending");
                setPage(1);
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">Semua Status</option>
              <option value="done">Sudah Follow Up</option>
              <option value="pending">Belum Follow Up</option>
            </select>
          </div>

          {/* Hasil Percakapan / Respon */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Hasil / Respon
            </label>
            <select
              value={selectedResult}
              onChange={(e) => {
                setSelectedResult(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">Semua Hasil</option>
              <option value="Prospek">Prospek</option>
              <option value="Kirim simulasi">Kirim Simulasi</option>
              <option value="Pikir-pikir / diskusi">Pikir-pikir / Diskusi</option>
              <option value="Belum minat">Belum Minat</option>
              <option value="Langsung dimatikan">Langsung Dimatikan</option>
              <option value="no_wa">Tidak Ada Nomor WA</option>
              <option value="none">Belum Ada Riwayat</option>
            </select>
          </div>

          {/* Segmentasi & Channel */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Segmentasi
            </label>
            <select
              value={selectedSegment}
              onChange={(e) => {
                setSelectedSegment(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">Semua Segmen</option>
              {segmentList.map((seg) => (
                <option key={seg} value={seg}>
                  {seg}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Sales Highlight Banner (if single sales is selected) */}
        {selectedSales !== "all" && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/20 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-primary">Rekap Sales:</span>
              <span className="font-bold text-foreground">
                {selectedSales === "unassigned" ? "Customer Belum Ditugaskan" : selectedSales}
              </span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>
                Total: <strong className="text-foreground">{stats.total}</strong>
              </span>
              <span>
                Selesai FU: <strong className="text-emerald-600">{stats.done}</strong>
              </span>
              <span>
                Prospek: <strong className="text-blue-600">{stats.prospects}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold text-center w-12">No</th>
                <th className="px-5 py-3 font-semibold">Customer &amp; No. Kontrak</th>
                <th className="px-5 py-3 font-semibold">Unit Kendaraan</th>
                <th className="px-5 py-3 font-semibold">Segmentasi &amp; Handling</th>
                <th className="px-5 py-3 font-semibold">Sales PIC</th>
                <th className="px-5 py-3 font-semibold text-center">Follow Up</th>
                <th className="px-5 py-3 font-semibold">Hasil Terakhir</th>
                <th className="px-5 py-3 font-semibold">Status Kontrak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedRows.map((c, index) => {
                const list = followUps.filter((f) => f.customerId === c.id);
                const last = list[0];
                const rowNumber = (currentPage - 1) * PAGE_SIZE + index + 1;

                return (
                  <tr key={c.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-4 py-3.5 text-center text-xs font-mono text-muted-foreground">
                      {rowNumber}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground">{c.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">
                        {c.contractNumber || "-"} · +{c.phone}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      <div className="text-foreground font-medium text-xs">
                        {c.unitType || c.product || c.unit || "-"}
                      </div>
                      <div className="text-[11px]">
                        {c.year ? `Thn ${c.year}` : ""} {c.mod ? `· MOD ${c.mod}` : ""}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      <div className="text-primary font-bold text-xs">{c.segment || "-"}</div>
                      <div className="text-[11px]">{c.handling || c.region || "-"}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          c.owner && c.owner !== "Belum ditugaskan"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {c.owner || "Belum ditugaskan"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          list.length > 0
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        }`}
                      >
                        {list.length}x
                      </span>
                    </td>
                    <td className="max-w-xs px-5 py-3.5 text-muted-foreground">
                      {last ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground text-xs">
                              {last.channel}
                            </span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span
                              className={`text-xs font-medium ${
                                last.interest === "Prospek" || last.interest === "Kirim simulasi"
                                  ? "text-blue-600 dark:text-blue-400"
                                  : last.interest === "Belum minat" ||
                                      last.interest === "Langsung dimatikan"
                                    ? "text-destructive"
                                    : "text-foreground"
                              }`}
                            >
                              {last.interest}
                            </span>
                          </div>
                          {last.reason && last.reason !== "-" && (
                            <p className="line-clamp-1 text-[11px] text-muted-foreground mt-0.5">
                              {last.reason}
                            </p>
                          )}
                          <span className="text-[10px] text-muted-foreground/70">
                            {new Date(last.at).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Belum follow up
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground font-medium">
                        {c.contractStatus || c.company || "-"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {pagedRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    Tidak ada data customer yang sesuai dengan filter yang dipilih.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 10 Items per page Pagination footer */}
        <div className="p-4 border-t border-border">
          <Pager
            page={currentPage}
            totalPages={totalPages}
            total={filteredRows.length}
            from={filteredRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}
            to={Math.min(currentPage * PAGE_SIZE, filteredRows.length)}
            onPageChange={setPage}
          />
        </div>
      </div>
    </AppShell>
  );
}
