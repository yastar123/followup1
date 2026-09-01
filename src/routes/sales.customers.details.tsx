import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ClipboardPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CallButton } from "@/components/CallButton";
import { FollowUpDialog } from "@/components/FollowUpDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { WaButton } from "@/components/WaButton";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/sales/customers/details")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? (search["id"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Detail Customer — ACC One" },
      {
        name: "description",
        content: "Detail customer: unit, nomor kontrak, status, wilayah handling, dan aksi kontak.",
      },
      { property: "og:title", content: "Detail Customer — ACC One" },
      { property: "og:description", content: "Detail customer dan aksi WhatsApp atau telepon." },
    ],
  }),
  component: CustomerDetails,
});

function CustomerDetails() {
  const { id } = Route.useSearch();
  const { customers, followUps } = useStore();
  const [open, setOpen] = useState(false);

  const customer = customers.find((c) => c.id === id);

  if (!customer) {
    return (
      <AppShell role="sales" title="Detail Customer" subtitle="Customer tidak ditemukan">
        <div className="surface-card p-6">
          <p className="text-sm text-muted-foreground">
            Data customer tidak ditemukan. Silakan pilih customer dari daftar.
          </p>
          <Button asChild className="mt-4">
            <Link to="/sales/customers">Kembali ke data customer</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  // Sort follow-ups chronologically (oldest to newest) to get sequence index
  const sortedFollowUps = [...followUps.filter((f) => f.customerId === customer.id)].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  const displayHistory = sortedFollowUps
    .map((f, idx) => ({
      ...f,
      seqNumber: idx + 1,
    }))
    .reverse();

  const fields: Array<[string, string]> = [
    ["Nama Customer (NAMA)", customer.name],
    ["Nomor Kontrak (NO KONTRAK)", customer.contractNumber || "-"],
    ["Nomor Telepon (NO TLP)", customer.phone ? `+${customer.phone}` : "-"],
    ["Kode Pos (KODE POST)", customer.postalCode || "-"],
    ["MOD", customer.mod || "-"],
    ["Tipe Unit (TYPE UNIT)", customer.unitType || customer.product || customer.unit || "-"],
    ["Tahun Kendaraan (TAHUN)", customer.year || "-"],
    ["Status Kontrak (STATUS)", customer.contractStatus || customer.company || "-"],
    ["Segmentasi (SEGMENTASI)", customer.segment || "-"],
    ["Handling / Cabang (HANDLING)", customer.handling || customer.region || "-"],
    ["Sales Penanggung Jawab", customer.owner || "Belum ditugaskan"],
  ];

  return (
    <AppShell
      role="sales"
      title={customer.name}
      subtitle={`No. Kontrak: ${customer.contractNumber || "-"} · ${customer.unitType || customer.unit || "-"} (${customer.handling || customer.region || "-"})`}
      actions={
        <div className="flex gap-2 [&>*]:shrink-0">
          <Button variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
            <ClipboardPlus className="size-4" /> Catat follow up
          </Button>
          <WaButton customer={customer} label="WhatsApp" />
          <CallButton customer={customer} label="Telepon Seluler" />
        </div>
      }
    >
      <Link
        to="/sales/customers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke data customer
      </Link>

      <div className="mt-5 space-y-6">
        <section className="surface-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Data Customer &amp; Kontrak (10 Parameter)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Data terverifikasi dari file import database ACC One
              </p>
            </div>
            <StatusBadge status={customer.status} />
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map(([k, v]) => (
              <div key={k} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {k}
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground break-words">{v}</dd>
              </div>
            ))}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status Pipeline Sales
              </dt>
              <dd className="mt-1">
                <StatusBadge status={customer.status} />
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-border">
            <WaButton customer={customer} label="Chat WhatsApp" />
            <CallButton customer={customer} label="Telepon Seluler" />
          </div>
        </section>

        <section className="surface-card">
          <div className="border-b border-border px-5 py-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Hasil Riwayat Follow Up</h2>
            <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
              Total: {displayHistory.length} Follow Up
            </span>
          </div>
          <ul className="divide-y divide-border/60">
            {displayHistory.map((f) => (
              <li key={f.id} className="p-5 hover:bg-muted/20 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-primary text-primary-foreground shadow-xs">
                      Follow Up ke-{f.seqNumber}
                    </span>
                    <span className="text-xs font-medium text-foreground bg-secondary px-2 py-0.5 rounded">
                      {f.channel} · {f.outcome}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {new Date(f.at).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {f.interest && (
                  <p className="text-xs font-semibold text-primary mt-1.5">
                    Respon / Minat: {f.interest}
                  </p>
                )}

                {f.reason && (
                  <div className="mt-2 rounded-lg bg-muted/40 p-3 border border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Catatan & Alasan:
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{f.reason}</p>
                  </div>
                )}

                <div className="mt-2.5 flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/30">
                  <span>
                    Tindakan lanjut:{" "}
                    <strong className="text-foreground">{f.nextAction || "-"}</strong>
                  </span>
                  <span>
                    Dicatat oleh: <strong className="text-foreground">{f.by || "-"}</strong>
                  </span>
                </div>
              </li>
            ))}
            {displayHistory.length === 0 && (
              <li className="px-5 py-8 text-sm text-muted-foreground text-center">
                Belum ada riwayat follow up untuk customer ini.
              </li>
            )}
          </ul>
        </section>
      </div>

      <FollowUpDialog customer={customer} open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}
