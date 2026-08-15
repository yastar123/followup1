import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function SalesProfileCard({ name, role }: { name: string; role: string }) {
  const cleanName = name.replace(/^Sales\s*·\s*/i, "").trim();
  const initials = cleanName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="surface-card flex items-center gap-4 p-5">
      <Avatar className="size-14">
        <AvatarFallback className="bg-primary/10 text-lg font-medium text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div>
        <h2 className="text-lg font-medium text-foreground">{cleanName}</h2>
        <p className="text-sm capitalize text-muted-foreground">{role}</p>
      </div>
    </div>
  );
}
