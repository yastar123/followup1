import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, PhoneCall } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Pager } from "@/components/Pager";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

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
  const navigate = useNavigate();
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
          placeholder="Cari nama customer, prospek…"
          className="w-full sm:w-72"
        />
      }
    >
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm [&_td]:whitespace-normal [&_th]:whitespace-nowrap">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground bg-muted/30">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Customer</th>
                <th className="px-5 py-3.5 font-semibold">Prospek / Catatan Minat</th>
                <th className="px-5 py-3.5 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {pageItems.map(({ f, c }) => {
                const customerId = c?.id || f.customerId;
                return (
                  <tr
                    key={f.id}
                    onClick={() =>
                      navigate({
                        to: "/sales/customers/$id",
                        params: { id: customerId },
                      })
                    }
                    className="group cursor-pointer transition-colors hover:bg-accent/40"
                  >
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-2">
                        {c ? (
                          <Link
                            to="/sales/customers/$id"
                            params={{ id: c.id }}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-base text-foreground group-hover:text-primary transition-colors"
                          >
                            {c.name}
                          </Link>
                        ) : (
                          <span className="font-semibold text-base text-foreground">Customer</span>
                        )}
                        {c?.status && <StatusBadge status={c.status} />}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
                        <PhoneCall className="size-3 text-primary shrink-0" />
                        <span>+{c?.phone ?? "-"}</span>
                        {c?.city && <span>· {c.city}</span>}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary mb-1">
                        {f.interest || "Minat Prospek"}
                      </div>
                      <p className="text-sm text-foreground font-medium">{f.reason}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(f.at).toLocaleString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · oleh {f.by}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-middle text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-xs font-medium text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate({
                            to: "/sales/customers/$id",
                            params: { id: customerId },
                          });
                        }}
                      >
                        <span>Lihat Follow Up</span>
                        <ChevronRight className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    Belum ada prospek tercatat di kolam minat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 pb-4 pt-2">
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
