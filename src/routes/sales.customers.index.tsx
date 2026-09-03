import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Filter, X } from "lucide-react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { CallButton } from "@/components/CallButton";
import { Pager } from "@/components/Pager";
import { PeriodFilter, type DateRange, type Period } from "@/components/PeriodFilter";
import { Input } from "@/components/ui/input";
import { WaButton, WaBusinessButton } from "@/components/WaButton";
import { useStore } from "@/lib/store";

const PAGE_SIZE = 10;

const searchSchema = z.object({
  filter: z.string().optional(),
});

export const Route = createFileRoute("/sales/customers/")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Data Customer — ACC One" },
      {
        name: "description",
        content:
          "Daftar customer sales lengkap dengan unit mobil, segmentasi, dan aksi cepat WhatsApp, WA Business, atau telepon.",
      },
      { property: "og:title", content: "Data Customer — ACC One" },
      {
        property: "og:description",
        content:
          "Daftar customer dengan unit mobil, segmentasi, dan aksi kontak cepat WhatsApp, WA Business, serta telepon.",
      },
    ],
  }),
  component: CustomerList,
});

function isInPeriod(date: string, period: Period, range?: DateRange) {
  const d = new Date(date);
  const now = new Date();
  if (period === "all") return true;
  if (period === "custom") {
    if (!range?.from) return true;
    const start = new Date(range.from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(range.to ?? range.from);
    end.setHours(23, 59, 59, 999);
    return d >= start && d <= end;
  }
  if (period === "today") return d.toDateString() === now.toDateString();
  if (period === "week") {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    startOfWeek.setHours(0, 0, 0, 0);
    return d >= startOfWeek && d <= now;
  }
  if (period === "month") {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  return true;
}

const FILTER_OPTIONS = [
  { id: "all", label: "Semua Database" },
  { id: "sudah", label: "Sudah Follow Up" },
  { id: "belum", label: "Belum Follow Up" },
  { id: "terhubung", label: "Terhubung" },
  { id: "tidak_terhubung", label: "Tidak Terhubung" },
  { id: "tidak_minat", label: "Tidak Minat" },
];

function CustomerList() {
  const { filter } = Route.useSearch();
  const { user, customers, followUps } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const connectedOutcomes = useMemo(() => new Set(["Chat dibalas", "Telepon dijawab"]), []);

  const latestFollowUpByCustomer = useMemo(() => {
    const map = new Map<string, (typeof followUps)[number]>();
    for (const f of followUps) {
      const existing = map.get(f.customerId);
      if (!existing || new Date(f.at) > new Date(existing.at)) {
        map.set(f.customerId, f);
      }
    }
    return map;
  }, [followUps]);

  const activeFilter = filter || "all";

  const rows = useMemo(() => {
    return customers.filter((c) => {
      // Must belong to current sales user
      if (user && c.owner !== user) return false;

      // Check date in period
      if (!isInPeriod(c.createdAt, period, range) && !latestFollowUpByCustomer.has(c.id)) {
        return false;
      }

      // Search text match across 10 fields
      const searchTerms = [
        c.name,
        c.contractNumber,
        c.phone,
        c.postalCode,
        c.mod,
        c.unitType,
        c.year,
        c.unit,
        c.segment,
        c.contractStatus,
        c.handling,
        c.company,
        c.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (q.trim() && !searchTerms.includes(q.trim().toLowerCase())) return false;

      const lastFollow = latestFollowUpByCustomer.get(c.id);

      // Filter by category
      if (activeFilter === "sudah") {
        return !!lastFollow;
      }
      if (activeFilter === "belum") {
        return !lastFollow;
      }
      if (activeFilter === "terhubung") {
        return !!lastFollow && connectedOutcomes.has(lastFollow.outcome);
      }
      if (activeFilter === "tidak_terhubung") {
        return !!lastFollow && !connectedOutcomes.has(lastFollow.outcome);
      }
      if (activeFilter === "tidak_minat") {
        return (
          c.status === "Tidak Tertarik" ||
          lastFollow?.interest === "Tidak Tertarik" ||
          lastFollow?.interest === "Belum minat" ||
          lastFollow?.interest === "Langsung dimatikan"
        );
      }

      return true;
    });
  }, [
    customers,
    user,
    period,
    range,
    q,
    activeFilter,
    latestFollowUpByCustomer,
    connectedOutcomes,
  ]);

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [q, period, range, activeFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const currentFilterLabel = FILTER_OPTIONS.find((f) => f.id === activeFilter)?.label || "Semua";

  return (
    <AppShell
      role="sales"
      title="Data Customer"
      subtitle={`${rows.length} customer ditampilkan (${currentFilterLabel})`}
    >
      <div className="space-y-4">
        <PeriodFilter value={period} onChange={setPeriod} range={range} onRangeChange={setRange} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama, unit, segmentasi, nomor HP"
              className="pl-9"
            />
          </div>

          {activeFilter !== "all" && (
            <button
              onClick={() => navigate({ to: "/sales/customers", search: { filter: "all" } })}
              className="inline-flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-md transition-colors self-start sm:self-auto"
            >
              <X className="size-3.5" />
              Reset Filter: {currentFilterLabel}
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50">
          <span className="text-xs text-muted-foreground font-medium mr-1.5 flex items-center gap-1">
            <Filter className="size-3" /> Filter Card:
          </span>
          {FILTER_OPTIONS.map((item) => {
            const isActive = activeFilter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate({ to: "/sales/customers", search: { filter: item.id } })}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-secondary/80 text-secondary-foreground hover:bg-secondary"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="surface-card mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Customer &amp; No. Kontrak</th>
                <th className="px-5 py-3 font-medium">No. Telepon / WA</th>
                <th className="px-5 py-3 font-medium">Unit &amp; Tahun</th>
                <th className="px-5 py-3 font-medium">Status Kontrak</th>
                <th className="px-5 py-3 font-medium">Segmentasi &amp; Handling</th>
                <th className="px-5 py-3 font-medium">Hasil Follow Up</th>
                <th className="px-5 py-3 text-right font-medium min-w-[320px]">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((c) => {
                const lastFollow = latestFollowUpByCustomer.get(c.id);
                return (
                  <tr
                    key={c.id}
                    onClick={() =>
                      navigate({ to: "/sales/customers/details", search: { id: c.id } })
                    }
                    className="cursor-pointer transition-colors hover:bg-secondary/40"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        to="/sales/customers/details"
                        search={{ id: c.id }}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-foreground hover:text-primary block"
                      >
                        {c.name}
                      </Link>
                      <span className="text-xs font-mono text-muted-foreground">
                        {c.contractNumber || "-"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-foreground">
                      {c.phone ? `+${c.phone}` : "-"}
                      {c.postalCode && (
                        <span className="block text-[11px] text-muted-foreground font-sans">
                          Pos: {c.postalCode}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-foreground text-xs">
                        {c.unitType || c.product || c.unit || "-"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.year ? `Thn ${c.year}` : ""} {c.mod ? `· MOD ${c.mod}` : ""}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-block max-w-[160px] truncate text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                        {c.contractStatus || c.company || "-"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-xs text-primary block">
                        {c.segment || "-"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {c.handling || c.region || "-"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {lastFollow ? (
                        <div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              connectedOutcomes.has(lastFollow.outcome)
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {lastFollow.outcome}
                          </span>
                          {lastFollow.interest && (
                            <span className="block text-[11px] text-muted-foreground mt-0.5">
                              {lastFollow.interest}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-muted-foreground">
                          Belum Follow Up
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <WaButton customer={c} size="sm" chooseTemplate label="WhatsApp" />
                        <WaBusinessButton
                          customer={c}
                          size="sm"
                          chooseTemplate
                          label="WA Business"
                        />
                        <CallButton customer={c} size="sm" label="Telepon" />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">
                    Tidak ada customer yang cocok untuk kategori filter{" "}
                    <strong className="text-foreground">{currentFilterLabel}</strong>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 pb-5">
          <Pager
            page={page}
            totalPages={totalPages}
            total={rows.length}
            from={(page - 1) * PAGE_SIZE + 1}
            to={Math.min(page * PAGE_SIZE, rows.length)}
            onPageChange={setPage}
          />
        </div>
      </div>
    </AppShell>
  );
}
