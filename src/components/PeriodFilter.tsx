import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type Period = "today" | "week" | "month" | "all" | "custom";
export type { DateRange };

const options: { value: Period; label: string }[] = [
  { value: "today", label: "Hari Ini" },
  { value: "week", label: "Minggu Ini" },
  { value: "month", label: "Bulan Ini" },
  { value: "all", label: "Semua" },
];

function formatRange(range?: DateRange) {
  if (!range?.from) return "Pilih rentang tanggal";
  const from = format(range.from, "d MMM yyyy", { locale: idLocale });
  if (!range.to) return `${from} — ...`;
  return `${from} — ${format(range.to, "d MMM yyyy", { locale: idLocale })}`;
}

export function PeriodFilter({
  value,
  onChange,
  range,
  onRangeChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
  range?: DateRange | undefined;
  onRangeChange?: ((r: DateRange | undefined) => void) | undefined;
}) {
  const handleSelect = (r: DateRange | undefined) => {
    onRangeChange?.(r);
    if (r?.from) onChange("custom");
  };

  return (
    <div className="surface-card flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="size-4" />
        <span>Periode</span>
      </div>
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              value === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            {opt.label}
          </button>
        ))}

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={value === "custom" ? "default" : "secondary"}
              size="sm"
              className="h-auto rounded-full px-3.5 py-1.5 text-xs font-medium"
            >
              <CalendarDays className="size-3.5" />
              {value === "custom" ? formatRange(range) : "Rentang Tanggal"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              numberOfMonths={1}
              {...(range?.from ? { defaultMonth: range.from } : {})}
              selected={range}
              onSelect={handleSelect}
              locale={idLocale}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            {range?.from && (
              <div className="flex items-center justify-between gap-2 border-t border-border p-3">
                <span className="text-xs text-muted-foreground">{formatRange(range)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    onRangeChange?.(undefined);
                    onChange("all");
                  }}
                >
                  Reset
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
