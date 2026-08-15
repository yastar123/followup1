import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:text-xs">
          {label}
        </p>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-3 font-display text-2xl text-foreground sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
