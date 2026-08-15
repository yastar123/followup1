import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, MessageSquareText, UserCog, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { rupiah, useStore } from "@/lib/store";

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

function AdminDashboard() {
  const { customers, followUps, accounts, templates } = useStore();
  const closing = customers.filter((c) => c.status === "Closing");
  const perSales = accounts
    .filter((a) => a.role === "sales")
    .map((a) => ({
      name: a.name,
      total: followUps.filter((f) => f.by.includes(a.name.split(" ")[0] ?? a.name)).length,
      interested: followUps.filter(
        (f) => f.by.includes(a.name.split(" ")[0] ?? a.name) && f.interest === "Tertarik",
      ).length,
    }));

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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total customer" value={String(customers.length)} icon={Users} />
        <StatCard
          label="Total follow up"
          value={String(followUps.length)}
          icon={MessageSquareText}
        />
        <StatCard
          label="Closing"
          value={String(closing.length)}
          icon={TrendingUp}
          hint={rupiah(closing.reduce((a, c) => a + c.value, 0))}
        />
        <StatCard
          label="Akun aktif"
          value={String(accounts.filter((a) => a.active).length)}
          icon={UserCog}
          hint={`${templates.length} template pesan`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="surface-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-medium text-foreground">Performa sales</h2>
          </div>
          <ul className="divide-y divide-border">
            {perSales.map((s) => (
              <li key={s.name} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.total} follow up tercatat</p>
                </div>
                <span className="rounded-full border border-primary/30 bg-accent px-3 py-1 text-xs text-accent-foreground">
                  {s.interested} tertarik
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-medium text-foreground">Distribusi status customer</h2>
          </div>
          <ul className="space-y-3 p-5">
            {(["Baru", "Proses", "Tertarik", "Tidak Tertarik", "Closing"] as const).map((s) => {
              const n = customers.filter((c) => c.status === s).length;
              const pct = customers.length ? Math.round((n / customers.length) * 100) : 0;
              return (
                <li key={s}>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{s}</span>
                    <span>
                      {n} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
