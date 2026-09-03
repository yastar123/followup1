import { MessageCircle, Building2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markPendingFollowUp } from "@/components/PendingFollowUpWatcher";
import { WaTemplateDialog } from "@/components/WaTemplateDialog";
import { renderTemplate, useStore, waLink, waBusinessLink, type Customer } from "@/lib/store";

export function WaButton({
  customer,
  templateId,
  size = "default",
  label = "WhatsApp",
  chooseTemplate = false,
  isBusiness = false,
  className = "",
}: {
  customer: Customer;
  templateId?: string | undefined;
  size?: "sm" | "default" | "lg";
  label?: string;
  chooseTemplate?: boolean;
  isBusiness?: boolean;
  className?: string;
}) {
  const { templates, user } = useStore();
  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const [open, setOpen] = useState(false);

  const channel = isBusiness ? "WhatsApp Business" : "WhatsApp";

  const send = () => {
    if (chooseTemplate) {
      setOpen(true);
      return;
    }
    const message = template ? renderTemplate(template.body, customer, user) : "";
    markPendingFollowUp(customer.id, channel);
    toast.info(`Setelah selesai chat ${channel}, kembali ke sini untuk mencatat hasil follow up.`);
    const link = isBusiness
      ? waBusinessLink(customer.phone, message)
      : waLink(customer.phone, message);
    window.open(link, "_blank", "noopener");
  };

  return (
    <>
      <Button
        size={size}
        onClick={send}
        className={`gap-1.5 font-medium transition-all ${
          isBusiness
            ? "bg-teal-600 hover:bg-teal-700 text-white shadow-xs dark:bg-teal-600 dark:hover:bg-teal-500 border-0"
            : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs dark:bg-emerald-600 dark:hover:bg-emerald-500 border-0"
        } ${className}`}
      >
        {isBusiness ? (
          <Building2 className="size-3.5 sm:size-4" />
        ) : (
          <MessageCircle className="size-3.5 sm:size-4" />
        )}
        <span>{label}</span>
      </Button>
      {chooseTemplate && (
        <WaTemplateDialog
          customer={customer}
          open={open}
          onOpenChange={setOpen}
          channel={channel}
        />
      )}
    </>
  );
}

export function WaBusinessButton({
  customer,
  templateId,
  size = "default",
  label = "WA Business",
  chooseTemplate = false,
  className = "",
}: {
  customer: Customer;
  templateId?: string | undefined;
  size?: "sm" | "default" | "lg";
  label?: string;
  chooseTemplate?: boolean;
  className?: string;
}) {
  return (
    <WaButton
      customer={customer}
      templateId={templateId}
      size={size}
      label={label}
      chooseTemplate={chooseTemplate}
      isBusiness
      className={className}
    />
  );
}
