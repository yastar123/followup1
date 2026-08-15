import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { rupiah, useStore } from "@/lib/store";

export const Route = createFileRoute("/admin/rekap")({
  head: () => ({
    meta: [
      { title: "Rekap Customer — ACC One" },
      {
        name: "description",
        content:
          "Rekap seluruh customer beserta jumlah follow up, hasil terakhir, dan sales penanggung jawab.",
      },
      { property: "og:title", content: "Rekap Customer — ACC One" },
      { property: "og:description", content: "Rekap customer dan hasil follow up terakhir." },
    ],
  }),
  component: RekapPage,
});

function RekapPage() {
  const { customers, followUps } = useStore();
  const [q, setQ] = useState("");
  const rows = customers.filter((c) =>
    `${c.name} ${c.company} ${c.owner}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <AppShell
      role="admin"
      title="Rekap Customer"
      subtitle="Semua customer dan hasil follow up terakhirnya."
    >
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari customer atau sales"
        className="w-full sm:max-w-xs"
      />

      <div className="surface-card mt-6 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-5 py-3 font-medium">Sales</th>
              <th className="px-5 py-3 font-medium">Nilai</th>
              <th className="px-5 py-3 font-medium">Follow up</th>
              <th className="px-5 py-3 font-medium">Hasil terakhir</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => {
              const list = followUps.filter((f) => f.customerId === c.id);
              const last = list[0];
              return (
                <tr key={c.id} className="hover:bg-secondary/40">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.company}</p>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.owner}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{rupiah(c.value)}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{list.length}x</td>
                  <td className="max-w-xs px-5 py-3.5 text-muted-foreground">
                    {last ? `${last.outcome} · ${last.interest}` : "Belum ada"}
                    {last && <p className="line-clamp-1 text-xs opacity-80">{last.reason}</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
