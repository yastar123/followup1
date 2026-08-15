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
  const { customers } = useStore();
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

  const fields: Array<[string, string]> = [
    ["Nama Customer", customer.name],
    ["Nomor HP", `+${customer.phone}`],
    ["Unit", customer.unit],
    ["Nomor Kontrak", customer.contractNumber],
    ["Wilayah Handling", customer.region],
  ];

  return (
    <AppShell
      role="sales"
      title={customer.name}
      subtitle={`${customer.unit} · ${customer.segment}`}
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

      <section className="surface-card mt-5 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-foreground">Informasi customer</h2>
          <StatusBadge status={customer.status} />
        </div>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          {fields.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
              <dd className="mt-1 text-sm text-foreground">{v}</dd>
            </div>
          ))}
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Status</dt>
            <dd className="mt-1">
              <StatusBadge status={customer.status} />
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          <WaButton customer={customer} label="Chat WhatsApp" />
          <CallButton customer={customer} label="Telepon Seluler" />
        </div>
      </section>

      <FollowUpDialog customer={customer} open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}
