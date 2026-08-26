import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { UserCheck, ShieldAlert, ArrowRight, Mail, Database, PhoneCall } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/akses-sales")({
  head: () => ({
    meta: [
      { title: "Akses Halaman Sales — ACC One" },
      {
        name: "description",
        content: "Masuk dan kelola halaman sales secara penuh sebagai admin.",
      },
    ],
  }),
  component: AksesSalesPage,
});

function AksesSalesPage() {
  const { accounts, customers, followUps, impersonate } = useStore();
  const navigate = useNavigate();

  const salesAccounts = accounts.filter((a) => a.role === "sales");

  const handleImpersonate = (name: string, displayName: string) => {
    // Generate Owner name format used in store (e.g. "Sales · Rio")
    const firstName = name.split(" ")[0];
    const userKey = `Sales · ${firstName}`;

    impersonate(userKey);
    toast.success(`Mengakses sistem sebagai ${displayName}`);
    navigate({ to: "/sales" });
  };

  return (
    <AppShell
      role="admin"
      title="Akses Halaman Sales"
      subtitle="Pilih salah satu petugas sales di bawah ini untuk mengakses dashboard dan mengelola follow up customer mereka secara penuh."
    >
      <div className="space-y-6">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-amber-800 dark:text-amber-300">
          <div className="flex gap-3">
            <ShieldAlert className="size-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold">Petunjuk Akses Admin</h4>
              <p className="mt-1 text-xs leading-relaxed opacity-90">
                {
                  "Fitur ini memberikan Anda akses penuh atas akun sales yang dipilih. Anda dapat membantu melakukan follow up, melihat riwayat chat/telepon, mengelola kolam minat, serta mencatatkan hasil follow up atas nama mereka. Banner kuning akan muncul di atas halaman untuk mengingatkan Anda sedang dalam mode penyamaran (impersonation)."
                }
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {salesAccounts.map((a) => {
            const firstName = a.name.split(" ")[0];
            const userKey = `Sales · ${firstName}`;
            const myCustomersCount = customers.filter((c) => c.owner === userKey).length;
            const myFollowUpsCount = followUps.filter((f) => f.by === userKey).length;

            return (
              <div
                key={a.id}
                className="surface-card flex flex-col justify-between p-5 transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg font-medium text-foreground">{a.name}</h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mail className="size-3" />
                        {a.email}
                      </p>
                    </div>
                    <Badge
                      variant={a.active ? "default" : "secondary"}
                      className={a.active ? "bg-emerald-500 text-white hover:bg-emerald-600" : ""}
                    >
                      {a.active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border/30 pt-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-primary/10 p-1.5 text-primary">
                        <Database className="size-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{myCustomersCount}</p>
                        <p className="text-[10px]">Customer</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-primary/10 p-1.5 text-primary">
                        <PhoneCall className="size-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{myFollowUpsCount}</p>
                        <p className="text-[10px]">Follow Up</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t border-border/30 pt-4">
                  <button
                    onClick={() => handleImpersonate(a.name, a.name)}
                    disabled={!a.active}
                    className="flex w-full items-center justify-between rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      <UserCheck className="size-4" />
                      Akses Halaman Sales
                    </span>
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {salesAccounts.length === 0 && (
            <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
              Belum ada akun sales yang terdaftar di sistem.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
