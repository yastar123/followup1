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
  const history = followUps.filter((f) => f.customerId === customer.id);

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
                ["Nomor WhatsApp", `+${customer.phone}`],
                ["Perusahaan", customer.company],
                ["Kota", customer.city],
                ["Produk diminati", customer.product],
                ["Nilai potensi", rupiah(customer.value)],
                ["Sumber lead", customer.source],
                ["Sales penanggung jawab", customer.owner],
                ["Catatan", customer.note],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
                  <dd className="mt-1 text-sm text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="surface-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-medium text-foreground">Riwayat follow up</h2>
            </div>
            <ul className="divide-y divide-border">
              {history.map((f) => (
                <li key={f.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {f.channel} · {f.outcome}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(f.at).toLocaleString("id-ID", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-primary">{f.interest}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{f.reason}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tindakan: {f.nextAction} · oleh {f.by}
                  </p>
                </li>
              ))}
              {history.length === 0 && (
                <li className="px-5 py-8 text-sm text-muted-foreground">
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
