import { useEffect, useState } from "react";
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
  const { templates, user } = useStore();
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");

  useEffect(() => {
    if (open) {
      setTemplateId(templates[0]?.id ?? "");
    }
  }, [open, templates]);

  const template = templates.find((t) => t.id === templateId);
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
          {templates.map((t) => (
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
          {templates.length === 0 && (
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
