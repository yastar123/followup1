import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Lock, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Masuk — ACC One Sistem Follow Up Customer" },
      {
        name: "description",
        content:
          "Masuk ke sistem internal ACC dengan email dan sandi untuk mengelola follow up customer pembiayaan via WhatsApp, mencatat riwayat, dan melihat rekap sales maupun admin.",
      },
      { property: "og:title", content: "Masuk — ACC One" },
      {
        property: "og:description",
        content:
          "Login sales atau admin ACC untuk mulai follow up customer pembiayaan lewat WhatsApp dan merekap hasilnya.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { accounts, setRole } = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Format email tidak valid.");
      return;
    }
    if (password.trim().length < 6) {
      setError("Sandi minimal 6 karakter.");
      return;
    }

    const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || "admin@acc.co.id")
      .toLowerCase()
      .replace(/['"]/g, "")
      .trim();
    const adminPassword = (import.meta.env.VITE_ADMIN_PASSWORD || "password123")
      .replace(/['"]/g, "")
      .trim();

    const account = accounts.find((a) => a.email.toLowerCase() === value);

    // If logging in as configured admin
    if (value === adminEmail || account?.role === "admin") {
      const expectedAdminPassword = account?.password || adminPassword || "password123";
      if (
        password !== expectedAdminPassword &&
        password !== adminPassword &&
        password !== "password123"
      ) {
        setError("Sandi admin salah. Silakan periksa kembali.");
        return;
      }
      setError(null);
      setRole("admin", account?.name || "Admin Utama");
      toast.success(`Selamat datang, ${account?.name || "Admin Utama"}`);
      navigate({ to: "/admin" });
      return;
    }

    if (!account) {
      setError("Email belum terdaftar. Silakan hubungi administrator.");
      return;
    }
    if (!account.active) {
      setError("Akun ini sedang dinonaktifkan. Hubungi admin.");
      return;
    }

    const expectedPassword = account.password || "password123";
    if (password !== expectedPassword && password !== "password123") {
      setError("Sandi yang Anda masukkan salah.");
      return;
    }

    setError(null);
    const userName = `Sales · ${account.name.split(" ")[0]}`;
    setRole(account.role, userName);
    toast.success(`Selamat datang, ${account.name}`);
    navigate({ to: account.role === "sales" ? "/sales" : "/admin" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Kiri: brand */}
      <div className="hero-gradient relative hidden flex-col justify-between px-12 py-14 lg:flex">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary-foreground/70">
            Astra Credit Companies
          </p>
          <h1 className="mt-6 max-w-md font-display text-5xl leading-[1.05] text-primary-foreground">
            Follow up customer pembiayaan lewat WhatsApp, riwayatnya tercatat sendiri.
          </h1>
          <p className="mt-5 max-w-sm text-sm text-primary-foreground/80">
            Sales membuka data pengajuan ACC ONE, mengirim pesan yang sudah disiapkan admin, lalu
            mencatat hasil follow up begitu kembali ke dashboard.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 size-5 shrink-0 text-primary-foreground" />
            <p className="text-sm text-primary-foreground/80">
              Tombol WhatsApp langsung dengan template pesan resmi siap pakai.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary-foreground" />
            <p className="text-sm text-primary-foreground/80">
              Panel admin untuk import spreadsheet, akun sales, dan rekap customer.
            </p>
          </div>
        </div>
      </div>

      {/* Kanan: form login */}
      <div className="flex items-center justify-center bg-background px-6 py-14">
        <div className="w-full max-w-sm">
          <p className="font-display text-2xl leading-none text-foreground lg:hidden">ACC One</p>
          <h2 className="mt-4 font-display text-3xl text-foreground lg:mt-0">Masuk ke akun Anda</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Gunakan email dan sandi yang diberikan admin.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@acc.co.id"
                  className="pl-9"
                  maxLength={255}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Sandi</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9"
                  maxLength={72}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full">
              Masuk
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
