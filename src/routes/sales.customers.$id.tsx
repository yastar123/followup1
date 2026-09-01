import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ClipboardPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FollowUpDialog } from "@/components/FollowUpDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { WaButton } from "@/components/WaButton";
import { Button } from "@/components/ui/button";
import { renderTemplate, rupiah, useStore } from "@/lib/store";

export const Route = createFileRoute("/sales/customers/$id")({
  head: () => ({
    meta: [
      { title: "Detail Customer — ACC One" },
      {
        name: "description",
        content: "Detail customer, pesan broadcast yang akan dikirim, dan riwayat follow up.",
      },
      { property: "og:title", content: "Detail Customer — ACC One" },
      { property: "og:description", content: "Detail customer dan riwayat follow up." },
    ],
  }),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const { customers, followUps, templates, user } = useStore();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | undefined>(undefined);

  const customer = customers.find((c) => c.id === id);
  if (!customer) throw notFound();

  const template = templates.find((t) => t.id === templateId) ?? templates[0];

  // Sort follow-ups chronologically (oldest to newest) to get sequence index
  const sortedFollowUps = [...followUps.filter((f) => f.customerId === customer.id)].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  // Attach sequence number (1-based: Follow Up ke-1, ke-2, ke-3)
  const historyWithSeq = sortedFollowUps.map((f, idx) => ({
    ...f,
    seqNumber: idx + 1,
  }));

  // Reverse to show newest on top, or keep chronological
  const displayHistory = [...historyWithSeq].reverse();

  return (
    <AppShell
      role="sales"
      title={customer.name}
      subtitle={`${customer.company} · ${customer.city}`}
      actions={
        <div className="flex gap-2 [&>*]:shrink-0">
          <Button variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
            <ClipboardPlus className="size-4" /> Catat follow up
          </Button>
          <WaButton customer={customer} templateId={template?.id} label="Chat WhatsApp" />
        </div>
      }
    >
      <Link
        to="/sales/customers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali ke data customer
      </Link>

      <div className="mt-5 grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section className="surface-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-foreground">Informasi customer</h2>
              <StatusBadge status={customer.status} />
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                ["Nama Customer (NAMA)", customer.name],
                ["Nomor Kontrak (NO KONTRAK)", customer.contractNumber || "-"],
                ["Nomor WhatsApp / TLP (NO TLP)", customer.phone ? `+${customer.phone}` : "-"],
                ["Kode Pos (KODE POST)", customer.postalCode || "-"],
                ["MOD", customer.mod || "-"],
                [
                  "Tipe Unit (TYPE UNIT)",
                  customer.unitType || customer.product || customer.unit || "-",
                ],
                ["Tahun Kendaraan (TAHUN)", customer.year || "-"],
                ["Status Kontrak (STATUS)", customer.contractStatus || customer.company || "-"],
                ["Segmentasi (SEGMENTASI)", customer.segment || "-"],
                [
                  "Handling / Cabang (HANDLING)",
                  customer.handling || customer.region || customer.city || "-",
                ],
                ["Sales Penanggung Jawab", customer.owner || "Belum ditugaskan"],
              ].map(([k, v]) => (
                <div key={k} className="p-2.5 rounded-lg bg-muted/20 border border-border/40">
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {k}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
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

        <section className="surface-card h-fit p-5 lg:col-span-2">
          <h2 className="text-base font-medium text-foreground">Pesan broadcast</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Template disiapkan admin, otomatis terisi data customer.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                className={
                  (template?.id === t.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary") +
                  " rounded-full border px-3 py-1.5 text-xs transition-colors"
                }
              >
                {t.name}
              </button>
            ))}
          </div>
          <p className="mt-4 whitespace-pre-wrap rounded-lg bg-secondary/70 p-4 text-sm text-foreground">
            {template ? renderTemplate(template.body, customer, user) : "Belum ada template."}
          </p>
          <div className="mt-4">
            <WaButton customer={customer} templateId={template?.id} label="Kirim via WhatsApp" />
          </div>
        </section>
      </div>

      <FollowUpDialog customer={customer} open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}
