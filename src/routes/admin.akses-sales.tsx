import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  UserCheck,
  ShieldAlert,
  ArrowRight,
  Mail,
  Database,
  PhoneCall,
  Calendar,
  Users,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { AppShell } from "@/components/AppShell";
import { useStore, isMatchSales } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import {
  AdminDateFilter,
  type AdminFilterMode,
  MONTH_NAMES,
  type AvailableMonth,
} from "@/components/AdminDateFilter";

export const Route = createFileRoute("/admin/akses-sales")({
  head: () => ({
    meta: [
      { title: "Akses Halaman Sales — ACC One" },
      {
        name: "description",
        content: "Masuk dan kelola halaman sales secara penuh sebagai admin dengan filter tanggal.",
      },
    ],
  }),
  component: AksesSalesPage,
});

function parseAnyDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;

  const m = String(dateStr).match(
    /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:[,\s]+(\d{1,2})[:.](\d{1,2}))?/,
  );
  if (m) {
    const day = parseInt(m[1] ?? "1", 10);
    const monthStr = (m[2] ?? "").toLowerCase();
    const year = parseInt(m[3] ?? "2026", 10);
    const hour = m[4] ? parseInt(m[4], 10) : 0;
    const min = m[5] ? parseInt(m[5], 10) : 0;

    const months: Record<string, number> = {
      jan: 0,
      januari: 0,
      feb: 1,
      februari: 1,
      mar: 2,
      maret: 2,
      apr: 3,
      april: 3,
      mei: 4,
      jun: 5,
      juni: 5,
      jul: 6,
      juli: 6,
      agu: 7,
      ags: 7,
      agustus: 7,
      sep: 8,
      september: 8,
      okt: 9,
      oktober: 9,
      nov: 10,
      november: 10,
      des: 11,
      desember: 11,
    };
    const mon = months[monthStr];
    if (mon !== undefined) {
      return new Date(year, mon, day, hour, min);
    }
  }
  return null;
}

function isDateWithinRange(dateStr: string | null | undefined, start?: Date, end?: Date): boolean {
  if (!start && !end) return true;
  const d = parseAnyDate(dateStr);
  if (!d) return false;
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

function AksesSalesPage() {
  const { accounts, customers, followUps, impersonate } = useStore();
  const navigate = useNavigate();

  const now = useMemo(() => new Date(), []);
  const [filterMode, setFilterMode] = useState<AdminFilterMode>("all");
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  const salesAccounts = accounts.filter((a) => a.role === "sales");

  // Detect months with available activity in the database
  const availableMonths = useMemo<AvailableMonth[]>(() => {
    const map = new Map<string, AvailableMonth>();

    followUps.forEach((f) => {
      const d = parseAnyDate(f.at);
      if (d) {
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(key, {
            month: d.getMonth(),
            year: d.getFullYear(),
            label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
            count: 1,
          });
        }
      }
    });

    customers.forEach((c) => {
      const d = parseAnyDate(c.createdAt);
      if (d) {
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(key, {
            month: d.getMonth(),
            year: d.getFullYear(),
            label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
            count: 1,
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [followUps, customers]);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const set = new Set<number>([currentYear - 2, currentYear - 1, currentYear, currentYear + 1]);
    availableMonths.forEach((m) => set.add(m.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [availableMonths]);

  // Determine effective date bounds based on mode & range
  const activeDateBounds = useMemo<{ start?: Date; end?: Date }>(() => {
    if (filterMode === "all") {
      return {};
    }

    if (filterMode === "today") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (filterMode === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (filterMode === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }

    if (filterMode === "month_select") {
      const start = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0);
      const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }

    if (filterMode === "custom" && range?.from) {
      const start = new Date(range.from);
      start.setHours(0, 0, 0, 0);
      const end = range.to ? new Date(range.to) : new Date(range.from);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    return {};
  }, [filterMode, range, selectedMonth, selectedYear, now]);

  // Active range human-readable description
  const activeRangeDescription = useMemo(() => {
    if (filterMode === "all") return "Menampilkan seluruh data tanpa batasan tanggal";
    if (filterMode === "today")
      return `Hari Ini, ${format(now, "dd MMMM yyyy", { locale: idLocale })}`;
    if (filterMode === "week" && activeDateBounds.start && activeDateBounds.end) {
      return `Minggu Ini (${format(activeDateBounds.start, "dd MMM", { locale: idLocale })} - ${format(activeDateBounds.end, "dd MMM yyyy", { locale: idLocale })})`;
    }
    if (filterMode === "month") {
      return `Bulan Ini: ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
    }
    if (filterMode === "month_select") {
      return `Bulan: ${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    }
    if (filterMode === "custom" && activeDateBounds.start && activeDateBounds.end) {
      return `Rentang: ${format(activeDateBounds.start, "dd MMM yyyy", { locale: idLocale })} s/d ${format(activeDateBounds.end, "dd MMM yyyy", { locale: idLocale })}`;
    }
    return "Periode Kustom";
  }, [filterMode, activeDateBounds, now, selectedMonth, selectedYear]);

  // Filtered customer and follow-ups within active date bounds
  const filteredCustomers = useMemo(() => {
    if (!activeDateBounds.start && !activeDateBounds.end) return customers;
    return customers.filter((c) =>
      isDateWithinRange(c.createdAt, activeDateBounds.start, activeDateBounds.end),
    );
  }, [customers, activeDateBounds]);

  const filteredFollowUps = useMemo(() => {
    if (!activeDateBounds.start && !activeDateBounds.end) return followUps;
    return followUps.filter((f) =>
      isDateWithinRange(f.at, activeDateBounds.start, activeDateBounds.end),
    );
  }, [followUps, activeDateBounds]);

  const handleImpersonate = (name: string, displayName: string) => {
    const firstName = name.split(" ")[0];
    const userKey = `Sales · ${firstName}`;

    impersonate(userKey);
    toast.success(`Mengakses sistem sebagai ${displayName}`);
    navigate({ to: "/sales" });
  };

  return (
    <AppShell
      role="admin"
      title="Akses Halaman Sales"
      subtitle="Pantau data customer dan riwayat follow up per petugas sales berdasarkan filter tanggal, bulan, atau rentang kustom."
    >
      <div className="space-y-6">
        {/* Date Filter Component */}
        <AdminDateFilter
          mode={filterMode}
          onModeChange={setFilterMode}
          range={range}
          onRangeChange={setRange}
          selectedMonth={selectedMonth}
          onSelectedMonthChange={setSelectedMonth}
          selectedYear={selectedYear}
          onSelectedYearChange={setSelectedYear}
          availableMonths={availableMonths}
          availableYears={availableYears}
          activeRangeDescription={activeRangeDescription}
          totalCustomersInPeriod={filteredCustomers.length}
          totalFollowUpsInPeriod={filteredFollowUps.length}
        />

        {/* Info Banner */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-amber-800 dark:text-amber-300">
          <div className="flex gap-3">
            <ShieldAlert className="size-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold">Petunjuk Akses Admin</h4>
              <p className="mt-1 text-xs leading-relaxed opacity-90">
                Fitur ini memberikan Anda akses penuh atas akun sales yang dipilih. Anda dapat
                membantu melakukan follow up, melihat riwayat chat/telepon, mengelola kolam minat,
                serta mencatatkan hasil follow up atas nama mereka. Jumlah customer dan follow up di
                bawah otomatis mengikuti filter periode tanggal aktif di atas.
              </p>
            </div>
          </div>
        </div>

        {/* Sales Cards Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {salesAccounts.map((a) => {
            const firstName = a.name.split(" ")[0];
            const userKey = `Sales · ${firstName}`;

            // Match customers and follow ups for this sales
            const salesCustCount = filteredCustomers.filter(
              (c) => isMatchSales(c.owner, userKey) || isMatchSales(c.owner, a.name),
            ).length;

            const salesFollowUps = filteredFollowUps.filter(
              (f) => isMatchSales(f.by, userKey) || isMatchSales(f.by, a.name),
            );
            const salesFuCount = salesFollowUps.length;

            // Follow-up conversion summary
            const interestedCount = salesFollowUps.filter(
              (f) =>
                f.interest === "Tertarik" ||
                f.interest === "Kirim simulasi" ||
                f.outcome === "Chat dibalas" ||
                f.outcome === "Telepon dijawab",
            ).length;

            return (
              <div
                key={a.id}
                className="surface-card flex flex-col justify-between p-5 transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg font-medium text-foreground">{a.name}</h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="size-3" />
                        {a.email}
                      </p>
                    </div>
                    <Badge
                      variant={a.active ? "default" : "secondary"}
                      className={a.active ? "bg-emerald-500 text-white hover:bg-emerald-600" : ""}
                    >
                      {a.active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>

                  {/* Filtered Metrics */}
                  <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border/30 pt-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2.5 bg-muted/40 p-2.5 rounded-lg border border-border/40">
                      <div className="rounded-full bg-primary/10 p-2 text-primary">
                        <Database className="size-4" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-base leading-tight">
                          {salesCustCount}
                        </p>
                        <p className="text-[10px] font-medium text-muted-foreground">Customer</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 bg-muted/40 p-2.5 rounded-lg border border-border/40">
                      <div className="rounded-full bg-primary/10 p-2 text-primary">
                        <PhoneCall className="size-4" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-base leading-tight">
                          {salesFuCount}
                        </p>
                        <p className="text-[10px] font-medium text-muted-foreground">Follow Up</p>
                      </div>
                    </div>
                  </div>

                  {salesFuCount > 0 && (
                    <div className="mt-2.5 flex items-center justify-between text-[11px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-1.5 rounded-md border border-emerald-500/20">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" /> Respons Positif
                      </span>
                      <span className="font-bold">{interestedCount} respons</span>
                    </div>
                  )}
                </div>

                <div className="mt-5 border-t border-border/30 pt-4">
                  <button
                    onClick={() => handleImpersonate(a.name, a.name)}
                    disabled={!a.active}
                    className="flex w-full items-center justify-between rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      <UserCheck className="size-4" />
                      Akses Halaman Sales
                    </span>
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {salesAccounts.length === 0 && (
            <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
              Belum ada akun sales yang terdaftar di sistem.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
