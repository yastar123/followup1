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
import { renderTemplate, useStore, waLink, type Customer } from "@/lib/store";

export function WaTemplateDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer;
  open: boolean;
  onOpenChange: (v: boolean) => void;
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
    markPendingFollowUp(customer.id, "WhatsApp");
    toast.info("Setelah selesai chat, kembali ke sini untuk mencatat hasil follow up.");
    window.open(waLink(customer.phone, message), "_blank", "noopener");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kirim WhatsApp ke {customer.name}</DialogTitle>
          <DialogDescription>
            Pilih template pesan broadcast, lalu lihat hasil pesannya.
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
                  ? "border-primary bg-primary/10 text-foreground"
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
          <Button onClick={send}>Kirim WhatsApp</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
