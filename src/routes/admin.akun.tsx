import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useStore, type Role } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/akun")({
  head: () => ({
    meta: [
      { title: "Buat Akun — ACC One" },
      {
        name: "description",
        content: "Buat dan kelola akun sales maupun admin beserta status aktifnya.",
      },
      { property: "og:title", content: "Buat Akun — ACC One" },
      { property: "og:description", content: "Kelola akun sales dan admin." },
    ],
  }),
  component: AkunPage,
});

function AkunPage() {
  const { accounts, addAccount, toggleAccount } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("sales");

  const submit = () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Nama dan email wajib diisi.");
      return;
    }
    addAccount({ name: name.trim(), email: email.trim(), role, active: true });
    setName("");
    setEmail("");
    toast.success("Akun berhasil dibuat.");
  };

  return (
    <AppShell role="admin" title="Buat Akun" subtitle="Kelola akses tim sales dan admin.">
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="surface-card h-fit p-5 lg:col-span-2">
          <h2 className="text-base font-medium text-foreground">Akun baru</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="n">Nama lengkap</Label>
              <Input
                id="n"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dewi Anggraini"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e">Email</Label>
              <Input
                id="e"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dewi@acc.co.id"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(["sales", "admin"] as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm capitalize transition-colors",
                      role === r
                        ? "border-primary bg-accent font-medium text-accent-foreground"
                        : "border-border text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={submit} className="gap-1.5">
              <UserPlus className="size-4" /> Buat akun
            </Button>
          </div>
        </section>

        <section className="surface-card lg:col-span-3">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-medium text-foreground">Daftar akun</h2>
          </div>
          <ul className="divide-y divide-border">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.email} · <span className="capitalize">{a.role}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {a.active ? "Aktif" : "Nonaktif"}
                  </span>
                  <Switch checked={a.active} onCheckedChange={() => toggleAccount(a.id)} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
