import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  MessageSquareText,
  Table2,
  UserCog,
  ClipboardList,
  NotebookPen,
  Droplets,
  LogOut,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { PendingFollowUpWatcher } from "@/components/PendingFollowUpWatcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const salesNav = [
  { to: "/sales", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { to: "/sales/customers", label: "Data Customer", short: "Customer", icon: Users },
  { to: "/sales/kolam-minat", label: "Kolam Minat", short: "Minat", icon: Droplets },
  { to: "/sales/broadcast", label: "Pesan Broadcast", short: "Pesan", icon: MessageSquareText },
  { to: "/sales/riwayat", label: "Riwayat Follow Up", short: "Riwayat", icon: ClipboardList },
  { to: "/sales/note", label: "Note", short: "Note", icon: NotebookPen },
];

const adminNav = [
  { to: "/admin", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { to: "/admin/data", label: "Database", short: "DB", icon: Table2 },
  { to: "/admin/rekap", label: "Rekap Customer", short: "Rekap", icon: ClipboardList },
  { to: "/admin/pesan", label: "Template Pesan", short: "Pesan", icon: MessageSquareText },
  {
    to: "/admin/pengaturan-broadcast",
    label: "Pengaturan Broadcast",
    short: "Broadcast",
    icon: SlidersHorizontal,
  },
  { to: "/admin/akun", label: "Buat Akun", short: "Akun", icon: UserCog },
  { to: "/admin/akses-sales", label: "Akses Halaman Sales", short: "Akses", icon: ShieldCheck },
];

export function AppShell({
  role,
  title,
  subtitle,
  actions,
  children,
}: {
  role: "sales" | "admin";
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, setRole, dbStatus, impersonating, stopImpersonate } = useStore();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = role === "sales" ? salesNav : adminNav;

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader className="group-data-[collapsible=icon]:px-1">
            <Link to="/" className="block px-2 py-1">
              <p className="font-display text-2xl leading-none text-foreground group-data-[collapsible=icon]:hidden">
                ACC One
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground group-data-[collapsible=icon]:hidden">
                Internal Follow Up
              </p>
              <p className="hidden font-display text-lg leading-none text-foreground group-data-[collapsible=icon]:block">
                A
              </p>
            </Link>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.map((item) => {
                    const active =
                      pathname === item.to ||
                      (item.to !== `/${role}` && pathname.startsWith(item.to));
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link to={item.to}>
                            <item.icon className="size-4" />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter>
            <div className="border-t border-border pt-3 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium text-foreground">{user}</p>
              <p className="text-xs capitalize text-muted-foreground">{role}</p>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Keluar">
                  <Link to="/" onClick={() => setRole(null)}>
                    <LogOut className="size-4" />
                    <span>Keluar</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          {impersonating && (
            <div className="bg-amber-500 text-amber-950 px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between gap-4 shadow-md border-b border-amber-600/20">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-950 animate-pulse shrink-0" />
                <span>
                  Mode Akses Sales: Anda sedang login sebagai{" "}
                  <strong className="font-bold">{user}</strong>
                </span>
              </div>
              <button
                onClick={() => stopImpersonate()}
                className="bg-amber-950 hover:bg-amber-900 text-amber-50 px-3 py-1 rounded-md text-xs font-semibold transition-colors shrink-0"
              >
                Kembali ke Admin
              </button>
            </div>
          )}
          <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
            <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-4 md:px-8 md:py-5">
              <div className="flex min-w-0 items-start gap-2 md:gap-3">
                <SidebarTrigger className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <h1 className="truncate font-display text-xl text-foreground sm:text-2xl md:text-3xl">
                    {title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    {subtitle && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                        {subtitle}
                      </p>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                        dbStatus?.type === "PostgreSQL"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30"
                          : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/30"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          dbStatus?.type === "PostgreSQL"
                            ? "bg-emerald-500 animate-pulse"
                            : "bg-blue-500"
                        }`}
                      />
                      Stack: Express + {dbStatus?.type || "File System"}
                    </span>
                  </div>
                </div>
              </div>
              {actions && (
                <div className="-mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:overflow-visible md:px-0 md:pb-0">
                  {actions}
                </div>
              )}
            </div>
          </header>

          <main className="flex-1 px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">{children}</main>
        </SidebarInset>

        {/* Mobile bottom navigation */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden">
          <ul className="flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
            {nav.map((item) => {
              const active =
                pathname === item.to || (item.to !== `/${role}` && pathname.startsWith(item.to));
              return (
                <li key={item.to} className="min-w-0 flex-1">
                  <Link
                    to={item.to}
                    aria-label={item.label}
                    className={`flex flex-col items-center gap-1 px-0.5 py-2 text-[10px] leading-tight transition-colors ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <item.icon className="size-5 shrink-0" />
                    <span className="w-full truncate text-center">{item.short}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {role === "sales" && <PendingFollowUpWatcher />}
    </SidebarProvider>
  );
}
