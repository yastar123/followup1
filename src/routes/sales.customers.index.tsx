import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CallButton } from "@/components/CallButton";
import { Pager } from "@/components/Pager";
import { PeriodFilter, type DateRange, type Period } from "@/components/PeriodFilter";
import { Input } from "@/components/ui/input";
import { WaButton } from "@/components/WaButton";
import { useStore } from "@/lib/store";

const PAGE_SIZE = 10;

export const Route = createFileRoute("/sales/customers/")({
  head: () => ({
    meta: [
      { title: "Data Customer — ACC One" },
      {
        name: "description",
        content:
          "Daftar customer sales lengkap dengan unit mobil, segmentasi, dan aksi WhatsApp atau telepon.",
      },
      { property: "og:title", content: "Data Customer — ACC One" },
      {
        property: "og:description",
        content: "Daftar customer dengan unit mobil, segmentasi, dan aksi kontak cepat.",
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

function CustomerList() {
  const { customers } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const rows = useMemo(
    () =>
      customers.filter(
        (c) =>
          isInPeriod(c.createdAt, period, range) &&
          `${c.name} ${c.unit} ${c.segment} ${c.phone}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [customers, q, period, range],
  );

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [q, period, range]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AppShell role="sales" title="Data Customer" subtitle={`${rows.length} customer ditampilkan`}>
      <div className="space-y-4">
        <PeriodFilter value={period} onChange={setPeriod} range={range} onRangeChange={setRange} />

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, unit, segmentasi, nomor HP"
            className="pl-9"
          />
        </div>
      </div>

      <div className="surface-card mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Nama Customer</th>
                <th className="px-5 py-3 font-medium">Nomor HP</th>
                <th className="px-5 py-3 font-medium">Unit Mobil</th>
                <th className="px-5 py-3 font-medium">Segmentasi</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate({ to: "/sales/customers/details", search: { id: c.id } })}
                  className="cursor-pointer transition-colors hover:bg-secondary/40"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      to="/sales/customers/details"
                      search={{ id: c.id }}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">+{c.phone}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.unit}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.segment}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <WaButton customer={c} size="sm" chooseTemplate />
                      <CallButton customer={c} size="sm" />
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                    Tidak ada customer yang cocok.
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
