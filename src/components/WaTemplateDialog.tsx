import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { markPendingFollowUp } from "@/components/PendingFollowUpWatcher";
import { renderTemplate, useStore, waLink, waBusinessLink, type Customer } from "@/lib/store";

export function WaTemplateDialog({
  customer,
  open,
  onOpenChange,
  channel = "WhatsApp",
}: {
  customer: Customer;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  channel?: "WhatsApp" | "WhatsApp Business";
}) {
  const { templates, accounts, user } = useStore();

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

  const defaultTemplateId = useMemo(() => {
    if (
      currentSalesAccount?.defaultTemplateId &&
      availableTemplates.some((t) => t.id === currentSalesAccount.defaultTemplateId)
    ) {
      return currentSalesAccount.defaultTemplateId;
    }
    return availableTemplates[0]?.id || templates[0]?.id || "";
  }, [currentSalesAccount, availableTemplates, templates]);

  const [templateId, setTemplateId] = useState<string>(defaultTemplateId);

  useEffect(() => {
    if (open) {
      setTemplateId(defaultTemplateId);
    }
  }, [open, defaultTemplateId]);

  const template = availableTemplates.find((t) => t.id === templateId) || availableTemplates[0];
  const message = template ? renderTemplate(template.body, customer, user) : "";

  const send = () => {
    if (!message.trim()) {
      toast.error("Pesan masih kosong.");
      return;
    }
    markPendingFollowUp(customer.id, channel);
    toast.info(`Setelah selesai chat ${channel}, kembali ke sini untuk mencatat hasil follow up.`);
    const link =
      channel === "WhatsApp Business"
        ? waBusinessLink(customer.phone, message)
        : waLink(customer.phone, message);
    window.open(link, "_blank", "noopener");
    onOpenChange(false);
  };

  const isBusiness = channel === "WhatsApp Business";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>
              Kirim {channel} ke {customer.name}
            </DialogTitle>
            {isBusiness && (
              <span className="rounded-full bg-teal-500/15 px-2.5 py-0.5 text-xs font-semibold text-teal-600 dark:text-teal-400">
                Business
              </span>
            )}
          </div>
          <DialogDescription>
            Pilih template pesan broadcast untuk dikirim melalui {channel}.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[260px] space-y-2 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {availableTemplates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTemplateId(t.id)}
              className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                templateId === t.id
                  ? isBusiness
                    ? "border-teal-600 bg-teal-500/10 text-foreground"
                    : "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              <span className="font-medium">{t.name}</span>
              <span className="mt-1 line-clamp-2 block text-xs opacity-80">{t.body}</span>
            </button>
          ))}
          {availableTemplates.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada template pesan.</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-secondary/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Hasil pesan
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
            {message || "Belum ada isi pesan."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={send}
            className={
              isBusiness
                ? "bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600"
                : ""
            }
          >
            Kirim {channel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
