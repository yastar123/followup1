import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Pager } from "@/components/Pager";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { useStore, rupiah } from "@/lib/store";

const PAGE_SIZE = 10;

export const Route = createFileRoute("/sales/kolam-minat")({
  head: () => ({
    meta: [
      { title: "Kolam Minat — ACC One" },
      {
        name: "description",
        content:
          "Kumpulan customer beserta catatan prospek yang diisi sales saat follow up telepon.",
      },
      { property: "og:title", content: "Kolam Minat — ACC One" },
      {
        property: "og:description",
        content: "Data customer dan catatan prospek hasil follow up sales.",
      },
    ],
  }),
  component: InterestPoolPage,
});

function InterestPoolPage() {
  const { followUps, customers } = useStore();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const list = followUps
      .filter((f) => f.reason && f.reason.trim() !== "" && f.reason.trim() !== "-")
      .map((f) => ({ f, c: customers.find((x) => x.id === f.customerId) ?? null }));
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter(({ f, c }) =>
      [c?.name, c?.phone, c?.company, c?.city, f.interest, f.reason]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [followUps, customers, q]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const pageItems = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AppShell
      role="sales"
      title="Kolam Minat"
      subtitle={`${rows.length} prospek tercatat dari hasil follow up`}
      actions={
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama, perusahaan, prospek…"
          className="w-full sm:w-72"
        />
      }
    >
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Perusahaan</th>
                <th className="px-4 py-3 font-medium">Unit / Nilai</th>
                <th className="px-4 py-3 font-medium">Hasil</th>
                <th className="px-4 py-3 font-medium">Prospek</th>
                <th className="px-4 py-3 font-medium">Dicatat</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(({ f, c }) => (
                <tr key={f.id} className="border-b border-border/60 last:border-0 align-top">
                  <td className="px-4 py-3">
                    {c ? (
                      <Link
                        to="/sales/customers/$id"
                        params={{ id: c.id }}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {c.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">Customer</span>
                    )}
                    <p className="text-xs text-muted-foreground">{c?.phone ?? "-"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-foreground">{c?.company ?? "-"}</p>
                    <p className="text-xs text-muted-foreground">{c?.city ?? "-"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-foreground">{c?.unit ?? "-"}</p>
                    <p className="text-xs text-muted-foreground">{c ? rupiah(c.value) : "-"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-muted-foreground">{f.channel}</p>
                    <p className="text-foreground">{f.interest}</p>
                    {c && (
                      <div className="mt-1">
                        <StatusBadge status={c.status} />
                      </div>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-foreground">{f.reason}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(f.at).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    <br />
                    {f.by}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Belum ada prospek. Isi kolom “Prospek” saat follow up customer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 pb-4">
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
