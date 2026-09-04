import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { Send, MessageSquare, User, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WaButton } from "@/components/WaButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isMatchSales, renderTemplate, useStore, type Customer } from "@/lib/store";

export const Route = createFileRoute("/sales/broadcast")({
  head: () => ({
    meta: [
      { title: "Pesan Broadcast — ACC One" },
      {
        name: "description",
        content:
          "Pilih template pesan buatan admin dan kirim ke customer satu per satu lewat WhatsApp.",
      },
      { property: "og:title", content: "Pesan Broadcast — ACC One" },
      {
        property: "og:description",
        content: "Kirim template pesan admin ke customer via WhatsApp.",
      },
    ],
  }),
  component: BroadcastPage,
});

const defaultCustomer: Customer = {
  id: "preview",
  name: "Bapak/Ibu Customer",
  contractNumber: "0150057400245421",
  phone: "628123456789",
  postalCode: "34163",
  mod: "3",
  unitType: "AVANZA G",
  year: "2020",
  contractStatus: "03. Open Berjalan 56%-75%",
  segment: "REGULER",
  handling: "JAKARTA",
  city: "JAKARTA",
  company: "03. Open Berjalan 56%-75%",
  product: "AVANZA G",
  unit: "AVANZA G 2020",
  region: "JAKARTA",
  value: 0,
  source: "Database ACC",
  status: "Baru",
  owner: "Sales",
  note: "",
  createdAt: new Date().toISOString(),
};

function BroadcastPage() {
  const { templates, customers, accounts, user } = useStore();

  // Find sales account matching logged in / impersonated user
  const currentSalesAccount = useMemo(() => {
    if (!user) return null;
    return (
      accounts.find(
        (a) =>
          a.name === user ||
          user === `Sales · ${a.name.split(" ")[0]}` ||
          user.toLowerCase().includes(a.name.toLowerCase()) ||
          a.id === user,
      ) || null
    );
  }, [accounts, user]);

  // Determine allowed/assigned templates for this sales user
  const availableTemplates = useMemo(() => {
    if (!currentSalesAccount || !currentSalesAccount.assignedTemplateIds) {
      return templates;
    }
    const assigned = currentSalesAccount.assignedTemplateIds;
    if (!Array.isArray(assigned) || assigned.length === 0) {
      return templates;
    }
    const filtered = templates.filter((t) => assigned.includes(t.id));
    return filtered.length > 0 ? filtered : templates;
  }, [templates, currentSalesAccount]);

  // Initial default template id
  const defaultTemplateId = useMemo(() => {
    if (
      currentSalesAccount?.defaultTemplateId &&
      availableTemplates.some((t) => t.id === currentSalesAccount.defaultTemplateId)
    ) {
      return currentSalesAccount.defaultTemplateId;
    }
    return availableTemplates[0]?.id || templates[0]?.id || "";
  }, [currentSalesAccount, availableTemplates, templates]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(defaultTemplateId);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  const myCustomers = useMemo(() => {
    return customers.filter((c) => isMatchSales(c.owner, user));
  }, [customers, user]);

  // Sync selectedTemplateId when defaultTemplateId changes
  useEffect(() => {
    if (defaultTemplateId && !availableTemplates.some((t) => t.id === selectedTemplateId)) {
      setSelectedTemplateId(defaultTemplateId);
    }
  }, [defaultTemplateId, availableTemplates, selectedTemplateId]);

  const activeTemplate = useMemo(
    () =>
      availableTemplates.find((t) => t.id === selectedTemplateId) ||
      availableTemplates[0] ||
      templates[0],
    [availableTemplates, templates, selectedTemplateId],
  );

  const targetCustomers = myCustomers.length > 0 ? myCustomers : customers;

  const activeCustomer = useMemo(() => {
    if (selectedCustomerId) {
      const found = targetCustomers.find((c) => c.id === selectedCustomerId);
      if (found) return found;
    }
    return targetCustomers[0] || defaultCustomer;
  }, [targetCustomers, selectedCustomerId]);

  const renderedPreview = useMemo(() => {
    if (!activeTemplate) return "";
    return renderTemplate(activeTemplate.body, activeCustomer, user || "Sales ACC");
  }, [activeTemplate, activeCustomer, user]);

  const isCustomAssigned =
    currentSalesAccount?.assignedTemplateIds &&
    currentSalesAccount.assignedTemplateIds.length > 0 &&
    currentSalesAccount.assignedTemplateIds.length < templates.length;

  return (
    <AppShell
      role="sales"
      title="Pesan Broadcast"
      subtitle="Template standar resmi dari admin — pilih template dan kirim pesan terpersonalisasi ke customer via WhatsApp."
    >
      <div className="space-y-4">
        {/* Banner if admin set custom template assignment */}
        {isCustomAssigned && (
          <div className="bg-primary/10 border border-primary/20 text-foreground px-4 py-2.5 rounded-lg flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary shrink-0" />
              <span>
                Admin telah menetapkan{" "}
                <strong className="font-semibold">
                  {availableTemplates.length} template khusus
                </strong>{" "}
                untuk akun sales Anda.
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] bg-background">
              Khusus {currentSalesAccount?.name}
            </Badge>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Template Selection */}
          <section className="surface-card p-5 lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" /> Template Pesan Resmi
              </h2>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {availableTemplates.length} template
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Template ini dikelola langsung oleh admin untuk memastikan standar komunikasi resmi
              ACC One.
            </p>

            <div className="space-y-2.5 pt-2">
              {availableTemplates.map((t) => {
                const isSelected = activeTemplate?.id === t.id;
                const isDefault = currentSalesAccount?.defaultTemplateId === t.id;

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(t.id)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all text-xs ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xs"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">{t.name}</span>
                        {isDefault && (
                          <span className="text-[9px] bg-primary/15 text-primary font-semibold px-1 rounded">
                            Utama
                          </span>
                        )}
                      </div>
                      {isSelected && <CheckCircle2 className="size-4 text-primary shrink-0" />}
                    </div>
                    <p className="text-muted-foreground line-clamp-2 leading-relaxed">{t.body}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Right Column: Preview & Direct Send */}
          <section className="surface-card p-5 lg:col-span-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Send className="size-4 text-emerald-600" /> Pratinjau & Pengiriman
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Variabel (nama, no kontrak, tipe unit, cabang, dsb.) terisi otomatis sesuai
                  customer.
                </p>
              </div>
            </div>

            {/* Customer Picker */}
            {targetCustomers.length > 0 && (
              <div className="space-y-1.5 bg-muted/20 p-3.5 rounded-lg border border-border/60">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <User className="size-3.5 text-primary" /> Target Customer Penerima
                </label>
                <Select
                  value={selectedCustomerId || targetCustomers[0]?.id}
                  onValueChange={setSelectedCustomerId}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Pilih customer target..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {targetCustomers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} · {c.unitType || c.unit || "Unit"} ({c.contractNumber || c.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Customer Summary Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-md bg-muted/30 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">NAMA</span>
                <span className="font-semibold text-foreground truncate block">
                  {activeCustomer.name}
                </span>
              </div>
              <div className="p-2.5 rounded-md bg-muted/30 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">
                  NO KONTRAK
                </span>
                <span className="font-mono text-muted-foreground truncate block">
                  {activeCustomer.contractNumber || "-"}
                </span>
              </div>
              <div className="p-2.5 rounded-md bg-muted/30 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">UNIT</span>
                <span className="font-semibold text-primary truncate block">
                  {activeCustomer.unitType || activeCustomer.unit || "-"}
                </span>
              </div>
              <div className="p-2.5 rounded-md bg-muted/30 border border-border/40">
                <span className="text-[10px] text-muted-foreground block font-medium">
                  HANDLING
                </span>
                <span className="font-medium text-foreground truncate block">
                  {activeCustomer.handling || activeCustomer.region || "-"}
                </span>
              </div>
            </div>

            {/* Live Rendered WhatsApp Message Box */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tampilan Pesan WhatsApp yang Akan Terkirim
              </label>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs font-sans leading-relaxed text-foreground whitespace-pre-wrap shadow-inner relative">
                {renderedPreview}
              </div>
            </div>

            {/* Action button */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Nomor WhatsApp: <strong className="text-foreground">+{activeCustomer.phone}</strong>
              </span>
              {activeCustomer.id !== "preview" ? (
                <WaButton
                  customer={activeCustomer}
                  templateId={activeTemplate?.id}
                  label="Buka WhatsApp & Kirim Pesan Ini"
                />
              ) : (
                <Button disabled variant="outline" className="gap-2">
                  Impor customer dari data admin untuk mengirim
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
