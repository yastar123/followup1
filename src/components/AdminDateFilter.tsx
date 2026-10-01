import { useState } from "react";
import { CalendarDays, Filter, RotateCcw, Calendar as CalendarIcon, Check } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AdminFilterMode = "all" | "today" | "week" | "month" | "month_select" | "custom";

export const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export interface AvailableMonth {
  month: number; // 0-11
  year: number;
  label: string;
  count: number;
}

export interface AdminDateFilterProps {
  mode: AdminFilterMode;
  onModeChange: (mode: AdminFilterMode) => void;
  range?: DateRange | undefined;
  onRangeChange: (range: DateRange | undefined) => void;
  selectedMonth: number;
  onSelectedMonthChange: (month: number) => void;
  selectedYear: number;
  onSelectedYearChange: (year: number) => void;
  availableMonths?: AvailableMonth[];
  availableYears?: number[];
  activeRangeDescription?: string;
  totalFollowUpsInPeriod?: number;
  totalCustomersInPeriod?: number;
}

export function AdminDateFilter({
  mode,
  onModeChange,
  range,
  onRangeChange,
  selectedMonth,
  onSelectedMonthChange,
  selectedYear,
  onSelectedYearChange,
  availableMonths = [],
  availableYears = [2024, 2025, 2026, 2027],
  activeRangeDescription,
  totalFollowUpsInPeriod,
  totalCustomersInPeriod,
}: AdminDateFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Form input date strings (YYYY-MM-DD)
  const [inputFrom, setInputFrom] = useState(() =>
    range?.from ? format(range.from, "yyyy-MM-dd") : "",
  );
  const [inputTo, setInputTo] = useState(() =>
    range?.to
      ? format(range.to, "yyyy-MM-dd")
      : range?.from
        ? format(range.from, "yyyy-MM-dd")
        : "",
  );

  const handleSelectPreset = (newMode: AdminFilterMode) => {
    if (newMode === "all") {
      onModeChange("all");
      onRangeChange(undefined);
      setInputFrom("");
      setInputTo("");
    } else if (newMode === "today") {
      const now = new Date();
      onModeChange("today");
      onRangeChange({ from: now, to: now });
      setInputFrom(format(now, "yyyy-MM-dd"));
      setInputTo(format(now, "yyyy-MM-dd"));
    } else if (newMode === "week") {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      onModeChange("week");
      onRangeChange({ from: startOfWeek, to: endOfWeek });
      setInputFrom(format(startOfWeek, "yyyy-MM-dd"));
      setInputTo(format(endOfWeek, "yyyy-MM-dd"));
    } else if (newMode === "month") {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      onModeChange("month");
      onRangeChange({ from: startOfMonth, to: endOfMonth });
      onSelectedMonthChange(now.getMonth());
      onSelectedYearChange(now.getFullYear());
      setInputFrom(format(startOfMonth, "yyyy-MM-dd"));
      setInputTo(format(endOfMonth, "yyyy-MM-dd"));
    } else if (newMode === "month_select") {
      applyMonthFilter(selectedMonth, selectedYear);
    } else if (newMode === "custom") {
      onModeChange("custom");
    }
  };

  const applyMonthFilter = (m: number, y: number) => {
    const from = new Date(y, m, 1, 0, 0, 0);
    const to = new Date(y, m + 1, 0, 23, 59, 59, 999);
    onSelectedMonthChange(m);
    onSelectedYearChange(y);
    onRangeChange({ from, to });
    onModeChange("month_select");
    setInputFrom(format(from, "yyyy-MM-dd"));
    setInputTo(format(to, "yyyy-MM-dd"));
  };

  const handleApplyCustomDates = () => {
    if (!inputFrom) return;
    const fromParts = inputFrom.split("-").map(Number);
    const fromDate = new Date(fromParts[0] ?? 2026, (fromParts[1] ?? 1) - 1, fromParts[2] ?? 1);

    let toDate = fromDate;
    if (inputTo) {
      const toParts = inputTo.split("-").map(Number);
      toDate = new Date(
        toParts[0] ?? 2026,
        (toParts[1] ?? 1) - 1,
        toParts[2] ?? 1,
        23,
        59,
        59,
        999,
      );
    }

    if (fromDate > toDate) {
      onRangeChange({ from: toDate, to: fromDate });
      setInputFrom(format(toDate, "yyyy-MM-dd"));
      setInputTo(format(fromDate, "yyyy-MM-dd"));
    } else {
      onRangeChange({ from: fromDate, to: toDate });
    }
    onModeChange("custom");
  };

  const handleCalendarSelect = (r: DateRange | undefined) => {
    onRangeChange(r);
    if (r?.from) {
      onModeChange("custom");
      setInputFrom(format(r.from, "yyyy-MM-dd"));
      if (r.to) {
        setInputTo(format(r.to, "yyyy-MM-dd"));
      } else {
        setInputTo(format(r.from, "yyyy-MM-dd"));
      }
    }
  };

  const handleReset = () => {
    handleSelectPreset("all");
  };

  const isFilterActive = mode !== "all";

  const getRangeLabel = () => {
    if (activeRangeDescription) return activeRangeDescription;
    if (!range?.from) return "Pilih rentang tanggal";
    const from = format(range.from, "d MMM yyyy", { locale: idLocale });
    if (!range.to || range.to.getTime() === range.from.getTime()) {
      return from;
    }
    return `${from} — ${format(range.to, "d MMM yyyy", { locale: idLocale })}`;
  };

  return (
    <div className="surface-card space-y-4 rounded-xl border border-border p-4 sm:p-5">
      {/* Header bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Filter className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Filter Periode & Rentang Waktu
            </h3>
            <p className="text-xs text-muted-foreground">
              Costum rekapan data berdasarkan bulan tertentu atau rentang tanggal spesifik.
            </p>
          </div>
        </div>

        {isFilterActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-8 self-start gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive sm:self-auto"
          >
            <RotateCcw className="size-3.5" />
            Reset ke Semua Waktu
          </Button>
        )}
      </div>

      {/* Preset tabs */}
      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
        <button
          type="button"
          onClick={() => handleSelectPreset("all")}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors",
            mode === "all"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          )}
        >
          Semua Waktu
        </button>

        <button
          type="button"
          onClick={() => handleSelectPreset("today")}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors",
            mode === "today"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          )}
        >
          Hari Ini
        </button>

        <button
          type="button"
          onClick={() => handleSelectPreset("week")}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors",
            mode === "week"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          )}
        >
          Minggu Ini
        </button>

        <button
          type="button"
          onClick={() => handleSelectPreset("month")}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors",
            mode === "month"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          )}
        >
          Bulan Ini
        </button>

        <button
          type="button"
          onClick={() => {
            onModeChange("month_select");
            applyMonthFilter(selectedMonth, selectedYear);
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors",
            mode === "month_select"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          )}
        >
          <CalendarDays className="size-3.5" />
          Pilih Bulan Tertentu
        </button>

        <button
          type="button"
          onClick={() => onModeChange("custom")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors",
            mode === "custom"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          )}
        >
          <CalendarIcon className="size-3.5" />
          Rentang Tanggal Custom
        </button>
      </div>

      {/* Detail panel when "Pilih Bulan Tertentu" is active */}
      {mode === "month_select" && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="shrink-0 text-xs font-semibold text-foreground">
              Filter Bulan & Tahun:
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {/* Select Bulan */}
              <Select
                value={String(selectedMonth)}
                onValueChange={(val) => {
                  const m = Number(val);
                  applyMonthFilter(m, selectedYear);
                }}
              >
                <SelectTrigger className="h-8.5 w-[150px] bg-background text-xs font-medium">
                  <SelectValue placeholder="Pilih Bulan" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, idx) => (
                    <SelectItem key={name} value={String(idx)} className="text-xs">
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Select Tahun */}
              <Select
                value={String(selectedYear)}
                onValueChange={(val) => {
                  const y = Number(val);
                  applyMonthFilter(selectedMonth, y);
                }}
              >
                <SelectTrigger className="h-8.5 w-[100px] bg-background text-xs font-medium">
                  <SelectValue placeholder="Tahun" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={String(year)} className="text-xs">
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Quick shortcut chips for months found in data */}
              {availableMonths.length > 0 && (
                <div className="ml-0 flex flex-wrap items-center gap-1.5 sm:ml-2">
                  <span className="text-[11px] text-muted-foreground">Tersedia di data:</span>
                  {availableMonths.slice(0, 4).map((item) => {
                    const isCurrent = selectedMonth === item.month && selectedYear === item.year;
                    return (
                      <button
                        key={`${item.year}-${item.month}`}
                        type="button"
                        onClick={() => applyMonthFilter(item.month, item.year)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                          isCurrent
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "bg-background border border-border text-foreground hover:bg-secondary",
                        )}
                      >
                        {item.label} ({item.count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail panel when "Rentang Tanggal Custom" is active */}
      {mode === "custom" && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Dari:</label>
                <Input
                  type="date"
                  value={inputFrom}
                  onChange={(e) => setInputFrom(e.target.value)}
                  className="h-8.5 w-[145px] bg-background text-xs"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Sampai:</label>
                <Input
                  type="date"
                  value={inputTo}
                  onChange={(e) => setInputTo(e.target.value)}
                  className="h-8.5 w-[145px] bg-background text-xs"
                />
              </div>

              <Button
                size="sm"
                onClick={handleApplyCustomDates}
                disabled={!inputFrom}
                className="h-8.5 gap-1 text-xs"
              >
                <Check className="size-3.5" />
                Terapkan
              </Button>
            </div>

            {/* Popover Calendar for visual click-to-select */}
            <div className="flex items-center gap-2">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8.5 gap-1.5 bg-background text-xs font-medium"
                  >
                    <CalendarDays className="size-3.5 text-primary" />
                    Pilih di Kalender
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    numberOfMonths={1}
                    {...(range?.from ? { defaultMonth: range.from } : {})}
                    selected={range}
                    onSelect={handleCalendarSelect}
                    locale={idLocale}
                    initialFocus
                    className="pointer-events-auto p-3"
                  />
                  {range?.from && (
                    <div className="flex items-center justify-between border-t border-border p-3 text-xs">
                      <span className="text-muted-foreground">{getRangeLabel()}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setCalendarOpen(false);
                          handleApplyCustomDates();
                        }}
                      >
                        Selesai
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Info Banner */}
      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-primary" />
          <span>
            {isFilterActive ? (
              <>
                <strong className="font-semibold text-foreground">Filter Aktif:</strong>{" "}
                <span className="text-primary font-medium">{getRangeLabel()}</span>
              </>
            ) : (
              <>
                <strong className="font-semibold text-foreground">Periode:</strong> Menampilkan
                seluruh data kumulatif (Semua Waktu).
              </>
            )}
          </span>
        </div>

        {isFilterActive && (
          <div className="flex items-center gap-3 text-[11px]">
            {totalFollowUpsInPeriod !== undefined && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                {totalFollowUpsInPeriod.toLocaleString("id-ID")} Follow Up
              </span>
            )}
            {totalCustomersInPeriod !== undefined && (
              <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground">
                {totalCustomersInPeriod.toLocaleString("id-ID")} Customer
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
