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
  const rows = customers.filter((c) => {
    const searchTerms = [
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
    return !q.trim() || searchTerms.includes(q.trim().toLowerCase());
  });

  return (
    <AppShell
      role="admin"
      title="Rekap Customer"
      subtitle="Semua customer dan hasil follow up terakhirnya."
    >
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari customer, no. kontrak, unit, sales…"
        className="w-full sm:max-w-xs"
      />

      <div className="surface-card mt-6 overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Customer &amp; No. Kontrak</th>
              <th className="px-5 py-3 font-medium">Unit Kendaraan</th>
              <th className="px-5 py-3 font-medium">Segmentasi &amp; Handling</th>
              <th className="px-5 py-3 font-medium">Sales PIC</th>
              <th className="px-5 py-3 font-medium">Follow Up</th>
              <th className="px-5 py-3 font-medium">Hasil Terakhir</th>
              <th className="px-5 py-3 font-medium">Status Kontrak</th>
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
                    <div className="text-primary font-semibold text-xs">{c.segment || "-"}</div>
                    <div className="text-[11px]">{c.handling || c.region || "-"}</div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.owner}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{list.length}x</td>
                  <td className="max-w-xs px-5 py-3.5 text-muted-foreground">
                    {last ? (
                      <div>
                        <span className="font-medium text-foreground text-xs">{last.outcome}</span>{" "}
                        · <span className="text-xs">{last.interest}</span>
                        {last.reason && (
                          <p className="line-clamp-1 text-xs opacity-80">{last.reason}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Belum ada</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                      {c.contractStatus || c.company || "-"}
                    </span>
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
