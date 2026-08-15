import { cn } from "@/lib/utils";
import type { Customer } from "@/lib/store";

const styles: Record<Customer["status"], string> = {
  Baru: "border-border bg-secondary text-secondary-foreground",
  Proses: "border-warning/40 bg-warning/15 text-warning-foreground",
  Tertarik: "border-primary/30 bg-accent text-accent-foreground",
  "Tidak Tertarik": "border-destructive/30 bg-destructive/10 text-destructive",
  Closing: "border-success/30 bg-success/15 text-success",
};

export function StatusBadge({ status }: { status: Customer["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[status],
      )}
    >
      {status}
    </span>
  );
}
