import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Database, PhoneOutgoing, PhoneOff, CircleHelp, ThumbsDown, PhoneCall } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { ProgressBanner } from "@/components/ProgressBanner";
import { SalesProfileCard } from "@/components/SalesProfileCard";
import { PeriodFilter, type Period, type DateRange } from "@/components/PeriodFilter";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/sales/")({
  head: () => ({
    meta: [
      { title: "Dashboard Sales — ACC One" },
      {
        name: "description",
        content: "Ringkasan target, customer aktif, dan hasil follow up harian sales.",
      },
      { property: "og:title", content: "Dashboard Sales — ACC One" },
      { property: "og:description", content: "Ringkasan target dan hasil follow up sales." },
    ],
  }),
  component: SalesDashboard,
});

const connectedOutcomes = new Set(["Chat dibalas", "Telepon dijawab"]);

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
  if (period === "today") {
    return d.toDateString() === now.toDateString();
  }
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

function SalesDashboard() {
  const [period, setPeriod] = useState<Period>("all");
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const { user, customers, followUps } = useStore();

  const myCustomers = customers.filter((c) => c.owner === user);

  const followUpsInPeriod = followUps.filter((f) => isInPeriod(f.at, period, range));
  const latestFollowUpInPeriodByCustomer = new Map<string, (typeof followUps)[number]>();
  for (const f of followUpsInPeriod) {
    const existing = latestFollowUpInPeriodByCustomer.get(f.customerId);
    if (!existing || new Date(f.at) > new Date(existing.at)) {
      latestFollowUpInPeriodByCustomer.set(f.customerId, f);
    }
  }

  const activeCustomers = myCustomers.filter(
    (c) => isInPeriod(c.createdAt, period, range) || latestFollowUpInPeriodByCustomer.has(c.id),
  );

  const totalDatabase = activeCustomers.length;
  const sudahFollowUp = activeCustomers.filter((c) =>
    latestFollowUpInPeriodByCustomer.has(c.id),
  ).length;
  const belumFollowUp = totalDatabase - sudahFollowUp;

  const terhubung = activeCustomers.filter((c) => {
    const f = latestFollowUpInPeriodByCustomer.get(c.id);
    return f ? connectedOutcomes.has(f.outcome) : false;
  }).length;

  const tidakTerhubung = activeCustomers.filter((c) => {
    const f = latestFollowUpInPeriodByCustomer.get(c.id);
    return f ? !connectedOutcomes.has(f.outcome) : false;
  }).length;

  const tidakMinat = activeCustomers.filter((c) => c.status === "Tidak Tertarik").length;
  const closing = activeCustomers.filter((c) => c.status === "Closing").length;

  return (
    <AppShell
      role="sales"
      title="Dashboard Sales"
      subtitle="Pantau progres follow up customer Anda hari ini."
    >
      <div className="space-y-4">
        <SalesProfileCard name={user} role="sales" />
        <PeriodFilter value={period} onChange={setPeriod} range={range} onRangeChange={setRange} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label="Total Database"
          value={String(totalDatabase)}
          icon={Database}
          hint="Customer aktif di periode ini"
        />
        <StatCard
          label="Sudah Follow Up"
          value={String(sudahFollowUp)}
          icon={PhoneOutgoing}
          hint="Sudah ada riwayat follow up"
        />
        <StatCard
          label="Belum Follow Up"
          value={String(belumFollowUp)}
          icon={CircleHelp}
          hint="Belum dihubungi sales"
        />
        <StatCard
          label="Terhubung"
          value={String(terhubung)}
          icon={PhoneCall}
          hint="Chat/telepon dijawab"
        />
        <StatCard
          label="Tidak terhubung"
          value={String(tidakTerhubung)}
          icon={PhoneOff}
          hint="Chat/telepon tidak dijawab"
        />
        <StatCard
          label="Tidak Minat"
          value={String(tidakMinat)}
          icon={ThumbsDown}
          hint="Customer menolak"
        />
      </div>

      <div className="mt-6">
        <ProgressBanner total={totalDatabase} closing={closing} />
      </div>
    </AppShell>
  );
}
