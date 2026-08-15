import { Progress } from "@/components/ui/progress";
import { Target, Users } from "lucide-react";

export function ProgressBanner({ total, closing }: { total: number; closing: number }) {
  const percent = total > 0 ? Math.round((closing / total) * 100) : 0;

  return (
    <div className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Target className="size-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-medium text-foreground">Progres Follow Up</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {closing} dari {total} customer sudah closing ({percent}%)
          </p>
        </div>
      </div>

      <div className="w-full min-w-[12rem] sm:max-w-xs">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="size-3" /> Database
          </span>
          <span className="font-medium text-foreground">Closing</span>
        </div>
        <Progress value={percent} />
      </div>
    </div>
  );
}
