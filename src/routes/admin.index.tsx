import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, MessageSquareText, UserCog, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import {
  AdminDateFilter,
  type AdminFilterMode,
  MONTH_NAMES,
  type AvailableMonth,
} from "@/components/AdminDateFilter";
import { isMatchSales, rupiah, useStore } from "@/lib/store";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Dashboard Admin — ACC One" },
      {
        name: "description",
        content: "Ringkasan performa tim sales, konversi customer, dan aktivitas follow up.",
      },
      { property: "og:title", content: "Dashboard Admin — ACC One" },
      {
        property: "og:description",
        content: "Ringkasan performa tim sales dan konversi customer.",
      },
    ],
  }),
  component: AdminDashboard,
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

function AdminDashboard() {
  const { customers, followUps, accounts, templates } = useStore();

  const now = useMemo(() => new Date(), []);
  const [filterMode, setFilterMode] = useState<AdminFilterMode>("all");
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    return new Date().getMonth();
  });
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

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
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }

    if (filterMode === "month_select") {
      const start = new Date(selectedYear, selectedMonth, 1, 0, 0, 0);
      const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }

    if (filterMode === "custom") {
      if (!range?.from) return {};
      const start = new Date(range.from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(range.to ?? range.from);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    return {};
  }, [filterMode, range, selectedMonth, selectedYear, now]);

  const isFilterActive =
    filterMode !== "all" && Boolean(activeDateBounds.start || activeDateBounds.end);

  // Description string for active period
  const activeRangeDescription = useMemo(() => {
    if (!isFilterActive) return "Semua Waktu";
    if (filterMode === "today")
      return `Hari Ini (${format(now, "d MMM yyyy", { locale: idLocale })})`;
    if (filterMode === "week") return "Minggu Ini";
    if (filterMode === "month")
      return `Bulan Ini (${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()})`;
    if (filterMode === "month_select") {
      return `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    }
    if (filterMode === "custom" && activeDateBounds.start) {
      const fromStr = format(activeDateBounds.start, "d MMM yyyy", { locale: idLocale });
      if (
        !activeDateBounds.end ||
        activeDateBounds.end.getTime() === activeDateBounds.start.getTime()
      ) {
        return fromStr;
      }
      return `${fromStr} — ${format(activeDateBounds.end, "d MMM yyyy", { locale: idLocale })}`;
    }
    return "Rentang Kustom";
  }, [isFilterActive, filterMode, selectedMonth, selectedYear, activeDateBounds, now]);

  // Filtered follow ups
  const filteredFollowUps = useMemo(() => {
    if (!isFilterActive) return followUps;
    return followUps.filter((f) =>
      isDateWithinRange(f.at, activeDateBounds.start, activeDateBounds.end),
    );
  }, [followUps, isFilterActive, activeDateBounds]);

  // Customer IDs that have interactions during the selected period
  const customerIdsWithFollowUpInPeriod = useMemo(() => {
    const set = new Set<string>();
    filteredFollowUps.forEach((f) => {
      if (f.customerId) set.add(f.customerId);
    });
    return set;
  }, [filteredFollowUps]);

  // Filtered customers (created in period OR has follow up interaction in period)
  const filteredCustomers = useMemo(() => {
    if (!isFilterActive) return customers;
    return customers.filter(
      (c) =>
        customerIdsWithFollowUpInPeriod.has(c.id) ||
        isDateWithinRange(c.createdAt, activeDateBounds.start, activeDateBounds.end),
    );
  }, [customers, isFilterActive, customerIdsWithFollowUpInPeriod, activeDateBounds]);

  const closing = useMemo(() => {
    if (!isFilterActive) return customers.filter((c) => c.status === "Closing");
    return filteredCustomers.filter((c) => c.status === "Closing");
  }, [customers, filteredCustomers, isFilterActive]);

  // Sales performance in the selected period
  const perSales = useMemo(() => {
    return accounts
      .filter((a) => a.role === "sales")
      .map((a) => {
        const salesFollowUps = filteredFollowUps.filter((f) => isMatchSales(f.by, a.name));
        return {
          name: a.name,
          total: salesFollowUps.length,
          interested: salesFollowUps.filter((f) => f.interest === "Tertarik").length,
        };
      });
  }, [accounts, filteredFollowUps]);

  return (
    <AppShell
      role="admin"
      title="Dashboard Admin"
      subtitle="Kontrol data, pesan, dan akun tim sales."
      actions={
        <Button asChild variant="outline" className="shrink-0">
          <Link to="/admin/data">Kelola data</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Date and Period Filter */}
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
          totalFollowUpsInPeriod={filteredFollowUps.length}
          totalCustomersInPeriod={filteredCustomers.length}
        />

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard
            label={isFilterActive ? "Customer aktif / tercatat" : "Total customer"}
            value={filteredCustomers.length.toLocaleString("id-ID")}
            icon={Users}
            hint={
              isFilterActive
                ? `Dari total ${customers.length.toLocaleString("id-ID")} customer database`
                : "Semua data customer"
            }
          />
          <StatCard
            label="Total follow up"
            value={filteredFollowUps.length.toLocaleString("id-ID")}
            icon={MessageSquareText}
            hint={
              isFilterActive
                ? `Periode: ${activeRangeDescription}`
                : `${followUps.length.toLocaleString("id-ID")} riwayat tercatat`
            }
          />
          <StatCard
            label="Closing"
            value={closing.length.toLocaleString("id-ID")}
            icon={TrendingUp}
            hint={rupiah(closing.reduce((a, c) => a + (c.value || 0), 0))}
          />
          <StatCard
            label="Akun aktif"
            value={String(accounts.filter((a) => a.active).length)}
            icon={UserCog}
            hint={`${templates.length} template pesan`}
          />
        </div>

        {/* Detailed Sections */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Sales Performance Card */}
          <section className="surface-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-medium text-foreground">Performa sales</h2>
                <p className="text-xs text-muted-foreground">
                  Aktivitas follow up dan hasil respon per tim sales
                </p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {activeRangeDescription}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {perSales.length === 0 ? (
                <li className="px-5 py-6 text-center text-sm text-muted-foreground">
                  Belum ada akun sales terdaftar.
                </li>
              ) : (
                perSales.map((s) => (
                  <li key={s.name} className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.total.toLocaleString("id-ID")} follow up tercatat
                      </p>
                    </div>
                    <span className="rounded-full border border-primary/30 bg-accent px-3 py-1 text-xs text-accent-foreground">
                      {s.interested.toLocaleString("id-ID")} tertarik
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          {/* Customer Status Distribution */}
          <section className="surface-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-medium text-foreground">
                  Distribusi status customer
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isFilterActive
                    ? `${filteredCustomers.length.toLocaleString("id-ID")} customer di periode ini`
                    : `${customers.length.toLocaleString("id-ID")} total customer`}
                </p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {activeRangeDescription}
              </span>
            </div>
            <ul className="space-y-3 p-5">
              {(["Baru", "Proses", "Tertarik", "Tidak Tertarik", "Closing"] as const).map((s) => {
                const n = filteredCustomers.filter((c) => c.status === s).length;
                const pct = filteredCustomers.length
                  ? Math.round((n / filteredCustomers.length) * 100)
                  : 0;
                return (
                  <li key={s}>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{s}</span>
                      <span>
                        {n.toLocaleString("id-ID")} · {pct}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
