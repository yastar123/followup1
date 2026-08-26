import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`surface-card p-4 sm:p-5 transition-all duration-150 ${
        onClick
          ? "cursor-pointer hover:border-primary/60 hover:shadow-md hover:bg-accent/30 active:scale-[0.98]"
          : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:text-xs font-semibold">
          {label}
        </p>
        <Icon className="size-4 text-primary" />
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <p className="font-display text-2xl text-foreground sm:text-3xl font-bold">{value}</p>
        {onClick && (
          <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded transition-colors">
            Lihat &rarr;
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
