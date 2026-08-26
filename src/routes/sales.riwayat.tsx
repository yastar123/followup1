import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Pager } from "@/components/Pager";
import { useStore } from "@/lib/store";

const PAGE_SIZE = 10;

export const Route = createFileRoute("/sales/riwayat")({
  head: () => ({
    meta: [
      { title: "Riwayat Follow Up — ACC One" },
      {
        name: "description",
        content:
          "Catatan lengkap hasil follow up: chat dibalas, telepon dijawab, minat, dan alasannya.",
      },
      { property: "og:title", content: "Riwayat Follow Up — ACC One" },
      { property: "og:description", content: "Catatan lengkap hasil follow up sales." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { followUps, customers } = useStore();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(followUps.length / PAGE_SIZE));
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = followUps.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AppShell
      role="sales"
      title="Riwayat Follow Up"
      subtitle={`${followUps.length} catatan tersimpan`}
    >
      <ol className="relative space-y-4 border-l border-border pl-6">
        {pageItems.map((f) => {
          const c = customers.find((x) => x.id === f.customerId);
          return (
            <li key={f.id} className="surface-card relative p-5">
              <span className="absolute -left-[31px] top-6 size-2.5 rounded-full bg-primary" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                {c ? (
                  <Link
                    to="/sales/customers/$id"
                    params={{ id: c.id }}
                    className="font-display text-xl text-foreground hover:text-primary"
                  >
                    {c.name}
                  </Link>
                ) : (
                  <span className="font-display text-xl text-foreground">Customer</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {isMounted
                    ? new Date(f.at).toLocaleString("id-ID", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {f.channel} · {f.outcome} · <span className="text-primary">{f.interest}</span>
              </p>
              <p className="mt-3 text-sm text-foreground">{f.reason}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Tindakan lanjut: {f.nextAction} · dicatat oleh {f.by}
              </p>
            </li>
          );
        })}
        {followUps.length === 0 && (
          <li className="text-sm text-muted-foreground">Belum ada riwayat follow up.</li>
        )}
      </ol>

      <div className="mt-6">
        <Pager
          page={page}
          totalPages={totalPages}
          total={followUps.length}
          from={(page - 1) * PAGE_SIZE + 1}
          to={Math.min(page * PAGE_SIZE, followUps.length)}
          onPageChange={setPage}
        />
      </div>
    </AppShell>
  );
}
