import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markPendingFollowUp } from "@/components/PendingFollowUpWatcher";
import type { Customer } from "@/lib/store";

export const telLink = (phone: string) => `tel:+${phone.replace(/\D/g, "")}`;

export function CallButton({
  customer,
  size = "default",
  label = "Telepon",
}: {
  customer: Customer;
  size?: "sm" | "default" | "lg";
  label?: string;
}) {
  return (
    <Button asChild size={size} variant="outline" className="gap-1.5">
      <a
        href={telLink(customer.phone)}
        onClick={(e) => {
          e.stopPropagation();
          markPendingFollowUp(customer.id, "Telepon");
        }}
      >
        <Phone className="size-4" />
        {label}
      </a>
    </Button>
  );
}
