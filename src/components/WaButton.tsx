import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markPendingFollowUp } from "@/components/PendingFollowUpWatcher";
import { WaTemplateDialog } from "@/components/WaTemplateDialog";
import { renderTemplate, useStore, waLink, type Customer } from "@/lib/store";

export function WaButton({
  customer,
  templateId,
  size = "default",
  label = "WhatsApp",
  chooseTemplate = false,
}: {
  customer: Customer;
  templateId?: string | undefined;
  size?: "sm" | "default" | "lg";
  label?: string;
  chooseTemplate?: boolean;
}) {
  const { templates, user } = useStore();
  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const [open, setOpen] = useState(false);

  const send = () => {
    if (chooseTemplate) {
      setOpen(true);
      return;
    }
    const message = template ? renderTemplate(template.body, customer, user) : "";
    markPendingFollowUp(customer.id, "WhatsApp");
    toast.info("Setelah selesai chat, kembali ke sini untuk mencatat hasil follow up.");
    window.open(waLink(customer.phone, message), "_blank", "noopener");
  };

  return (
    <>
      <Button size={size} onClick={send} className="gap-1.5">
        <MessageCircle className="size-4" />
        {label}
      </Button>
      {chooseTemplate && (
        <WaTemplateDialog customer={customer} open={open} onOpenChange={setOpen} />
      )}
    </>
  );
}
