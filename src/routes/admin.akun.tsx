import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  UserPlus,
  Users,
  Shield,
  ShieldCheck,
  UserCheck,
  Pencil,
  Trash2,
  Search,
  Phone,
  Mail,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore, type Role, type Account } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/akun")({
  head: () => ({
    meta: [
      { title: "Manajemen Akun — ACC One" },
      {
        name: "description",
        content:
          "Kelola akun pengguna tim Sales dan Admin ACC One, peran hak akses, dan status keaktifan.",
      },
      { property: "og:title", content: "Manajemen Akun — ACC One" },
      { property: "og:description", content: "Kelola akun sales dan admin ACC One." },
    ],
  }),
  component: AkunPage,
});

function AkunPage() {
  const {
    accounts,
    customers,
    user: currentLoggedInUser,
    addAccount,
    updateAccount,
    removeAccount,
    toggleAccount,
    impersonate,
    syncNow,
  } = useStore();

  // Search & Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // Form States for Add / Edit
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState<Role>("sales");
  const [formActive, setFormActive] = useState(true);
  const [formNote, setFormNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const matchSearch =
        search.trim() === "" ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase()) ||
        (a.phone && a.phone.includes(search)) ||
        (a.note && a.note.toLowerCase().includes(search.toLowerCase()));

      const matchRole = roleFilter === "all" || a.role === roleFilter;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && a.active) ||
        (statusFilter === "inactive" && !a.active);

      return matchSearch && matchRole && matchStatus;
    });
  }, [accounts, search, roleFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = accounts.length;
    const salesCount = accounts.filter((a) => a.role === "sales").length;
    const adminCount = accounts.filter((a) => a.role === "admin").length;
    const activeCount = accounts.filter((a) => a.active).length;
    const activePct = total > 0 ? Math.round((activeCount / total) * 100) : 100;

    return { total, salesCount, adminCount, activeCount, activePct };
  }, [accounts]);

  // Customer Assignment Mapping per Sales Name
  const customerCountsByOwner = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of customers) {
      if (c.owner) {
        counts[c.owner] = (counts[c.owner] || 0) + 1;
      }
    }
    return counts;
  }, [customers]);

  // Open Create Modal
  const handleOpenAdd = () => {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormRole("sales");
    setFormActive(true);
    setFormNote("");
    setIsAddOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (account: Account) => {
    setSelectedAccount(account);
    setFormName(account.name);
    setFormEmail(account.email);
    setFormPhone(account.phone || "");
    setFormRole(account.role);
    setFormActive(account.active);
    setFormNote(account.note || "");
    setIsEditOpen(true);
  };

  // Open Delete Confirmation
  const handleOpenDelete = (account: Account) => {
    setSelectedAccount(account);
    setIsDeleteOpen(true);
  };

  // Submit Create Account
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    const cleanEmail = formEmail.trim().toLowerCase();

    if (!cleanName) {
      toast.error("Nama lengkap wajib diisi.");
      return;
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Email tidak valid.");
      return;
    }

    // Check duplicate email
    const duplicate = accounts.some((a) => a.email.toLowerCase() === cleanEmail);
    if (duplicate) {
      toast.error(`Email ${cleanEmail} sudah terdaftar.`);
      return;
    }

    setIsSaving(true);
    try {
      addAccount({
        name: cleanName,
        email: cleanEmail,
        phone: formPhone.trim(),
        role: formRole,
        active: formActive,
        note: formNote.trim(),
        createdAt: new Date().toISOString(),
      });
      await syncNow();
      toast.success(
        `Akun "${cleanName}" (${formRole.toUpperCase()}) berhasil dibuat & disimpan ke database!`,
      );
      setIsAddOpen(false);
    } catch {
      toast.error("Terjadi kendala saat menyimpan akun ke database.");
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Edit Account
  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    const cleanName = formName.trim();
    const cleanEmail = formEmail.trim().toLowerCase();

    if (!cleanName) {
      toast.error("Nama lengkap wajib diisi.");
      return;
    }
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Email tidak valid.");
      return;
    }

    // Check duplicate email with other accounts
    const duplicate = accounts.some(
      (a) => a.id !== selectedAccount.id && a.email.toLowerCase() === cleanEmail,
    );
    if (duplicate) {
      toast.error(`Email ${cleanEmail} sudah digunakan oleh akun lain.`);
      return;
    }

    setIsSaving(true);
    try {
      updateAccount(selectedAccount.id, {
        name: cleanName,
        email: cleanEmail,
        phone: formPhone.trim(),
        role: formRole,
        active: formActive,
        note: formNote.trim(),
      });
      await syncNow();
      toast.success(`Perubahan akun "${cleanName}" berhasil disimpan ke database.`);
      setIsEditOpen(false);
      setSelectedAccount(null);
    } catch {
      toast.error("Gagal memperbarui akun di database.");
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!selectedAccount) return;

    // Safety guard: prevent deleting current active user
    if (selectedAccount.name === currentLoggedInUser) {
      toast.error("Anda tidak dapat menghapus akun yang sedang aktif digunakan.");
      setIsDeleteOpen(false);
      return;
    }

    setIsSaving(true);
    try {
      removeAccount(selectedAccount.id);
      await syncNow();
      toast.success(`Akun "${selectedAccount.name}" berhasil dihapus.`);
    } catch {
      toast.error("Gagal menghapus akun dari database.");
    } finally {
      setIsSaving(false);
      setIsDeleteOpen(false);
      setSelectedAccount(null);
    }
  };

  // Quick Toggle Active Status
  const handleToggle = async (id: string, name: string, currentStatus: boolean) => {
    toggleAccount(id);
    await syncNow();
    toast.success(`Status akun "${name}" diubah menjadi ${!currentStatus ? "Aktif" : "Nonaktif"}.`);
  };

  return (
    <AppShell
      role="admin"
      title="Manajemen Akun"
      subtitle="Kelola dan atur akun pengguna Sales dan Admin ACC One, penetapan peran, serta hak akses."
    >
      <div className="space-y-6">
        {/* Top Summary Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="surface-card p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Akun</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">{stats.total}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Pengguna terdaftar</p>
            </div>
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
          </div>

          <div className="surface-card p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Akun Sales</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                {stats.salesCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Petugas lapangan</p>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <UserCheck className="size-5" />
            </div>
          </div>

          <div className="surface-card p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Administrator</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {stats.adminCount}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Hak akses penuh</p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="size-5" />
            </div>
          </div>

          <div className="surface-card p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Status Aktif</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {stats.activeCount}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({stats.activePct}%)
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Siap bertugas</p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
        </div>

        {/* Controls: Search, Filter, & Add Button */}
        <section className="surface-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <div className="relative min-w-[220px] max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, email, no HP..."
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Role</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="active">Aktif Saja</SelectItem>
                  <SelectItem value="inactive">Nonaktif</SelectItem>
                </SelectContent>
              </Select>

              {(search || roleFilter !== "all" || statusFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setRoleFilter("all");
                    setStatusFilter("all");
                  }}
                  className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset Filter
                </Button>
              )}
            </div>

            <Button onClick={handleOpenAdd} className="gap-1.5 h-9 text-xs font-semibold shadow-sm">
              <UserPlus className="size-4" /> Tambah Akun Baru
            </Button>
          </div>
        </section>

        {/* Account List / Table */}
        <section className="surface-card overflow-hidden">
          <div className="border-b border-border px-5 py-3.5 flex items-center justify-between bg-muted/20">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Daftar Pengguna Sistem</h2>
              <p className="text-xs text-muted-foreground">
                Menampilkan {filteredAccounts.length} dari total {accounts.length} akun
              </p>
            </div>
          </div>

          {filteredAccounts.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="mx-auto size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">Tidak ada akun yang sesuai</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Silakan periksa kata kunci pencarian atau filter yang Anda gunakan.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAdd}
                className="mt-4 gap-1.5 text-xs"
              >
                <UserPlus className="size-3.5" /> Buat Akun Baru
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="px-5 py-3">Pengguna</th>
                    <th className="px-4 py-3">Kontak & Info</th>
                    <th className="px-4 py-3">Peran (Role)</th>
                    <th className="px-4 py-3">Nasabah Dikelola</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAccounts.map((a) => {
                    const assignedCustomers = customerCountsByOwner[a.name] || 0;
                    const isCurrentUser = a.name === currentLoggedInUser;

                    return (
                      <tr
                        key={a.id}
                        className={cn(
                          "transition-colors hover:bg-muted/30",
                          !a.active && "opacity-60 bg-muted/10",
                        )}
                      >
                        {/* Name & Avatar */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase",
                                a.role === "admin"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                  : "bg-primary/10 text-primary",
                              )}
                            >
                              {a.name.slice(0, 2)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-sm text-foreground">
                                  {a.name}
                                </span>
                                {isCurrentUser && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] py-0 px-1.5 bg-background"
                                  >
                                    Anda
                                  </Badge>
                                )}
                              </div>
                              {a.note && (
                                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                                  {a.note}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Email & Phone */}
                        <td className="px-4 py-3.5 space-y-1">
                          <div className="flex items-center gap-1.5 text-foreground font-mono">
                            <Mail className="size-3 text-muted-foreground" />
                            <span>{a.email}</span>
                          </div>
                          {a.phone ? (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="size-3 text-muted-foreground" />
                              <span>{a.phone}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/60 italic">
                              Belum ada No HP
                            </span>
                          )}
                        </td>

                        {/* Role Badge */}
                        <td className="px-4 py-3.5">
                          {a.role === "admin" ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium"
                            >
                              <Shield className="size-3" /> Admin
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="gap-1 border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium"
                            >
                              <UserCheck className="size-3" /> Sales
                            </Badge>
                          )}
                        </td>

                        {/* Assigned Customers */}
                        <td className="px-4 py-3.5">
                          {a.role === "sales" ? (
                            <div className="flex items-center gap-1.5">
                              <Layers className="size-3.5 text-muted-foreground" />
                              <span className="font-semibold text-foreground">
                                {assignedCustomers}
                              </span>
                              <span className="text-muted-foreground text-[11px]">nasabah</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>

                        {/* Status Switch */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={a.active}
                              onCheckedChange={() => handleToggle(a.id, a.name, a.active)}
                            />
                            <span
                              className={cn(
                                "text-[11px] font-medium",
                                a.active
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-muted-foreground",
                              )}
                            >
                              {a.active ? "Aktif" : "Nonaktif"}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Impersonate for Sales */}
                            {a.role === "sales" && a.active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  impersonate(a.name);
                                  toast.success(`Beralih akses sebagai ${a.name}`);
                                }}
                                title="Beralih akses sebagai sales ini"
                                className="h-8 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1"
                              >
                                <UserCheck className="size-3.5" />
                                <span className="hidden md:inline">Masuk</span>
                              </Button>
                            )}

                            {/* Edit Button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(a)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Edit Akun"
                            >
                              <Pencil className="size-3.5" />
                            </Button>

                            {/* More / Delete Menu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44 text-xs">
                                <DropdownMenuLabel>Pilihan Akun</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => handleOpenEdit(a)}
                                  className="gap-2"
                                >
                                  <Pencil className="size-3.5" /> Edit Data
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleToggle(a.id, a.name, a.active)}
                                  className="gap-2"
                                >
                                  <CheckCircle2 className="size-3.5" />
                                  {a.active ? "Nonaktifkan Akun" : "Aktifkan Akun"}
                                </DropdownMenuItem>
                                {a.role === "sales" && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      impersonate(a.name);
                                      toast.success(`Beralih akses sebagai ${a.name}`);
                                    }}
                                    className="gap-2"
                                  >
                                    <UserCheck className="size-3.5 text-primary" /> Masuk Akses
                                    Sales
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleOpenDelete(a)}
                                  disabled={isCurrentUser}
                                  className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                >
                                  <Trash2 className="size-3.5" /> Hapus Akun
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Dialog: Tambah Akun (Create) */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="size-5 text-primary" /> Tambah Akun Pengguna Baru
              </DialogTitle>
              <DialogDescription>
                Daftarkan akun sales atau admin baru ke dalam sistem database ACC One.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitAdd} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="add-name" className="text-xs font-semibold">
                  Nama Lengkap <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="add-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: Rian Prasetyo"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-email" className="text-xs font-semibold">
                  Alamat Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="add-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="rian.prasetyo@acc.co.id"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="add-phone" className="text-xs font-semibold">
                    No. Telepon / WhatsApp
                  </Label>
                  <Input
                    id="add-phone"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="08123456789"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Peran (Role)</Label>
                  <Select value={formRole} onValueChange={(val: Role) => setFormRole(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales Officer</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-note" className="text-xs font-semibold">
                  Catatan / Cabang / Posisi
                </Label>
                <Input
                  id="add-note"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Contoh: Sales Cabang Bandar Jaya"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20">
                <div>
                  <p className="text-xs font-semibold text-foreground">Status Keaktifan Akun</p>
                  <p className="text-[11px] text-muted-foreground">
                    Akun aktif dapat langsung login dan menerima penugasan nasabah
                  </p>
                </div>
                <Switch checked={formActive} onCheckedChange={setFormActive} />
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  disabled={isSaving}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isSaving} className="gap-1.5">
                  {isSaving ? "Menyimpan..." : "Simpan Akun Baru"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog: Edit Akun (Update) */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="size-5 text-primary" /> Edit Data Akun
              </DialogTitle>
              <DialogDescription>
                Perbarui informasi, peran, atau status pengguna terpilih.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitEdit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs font-semibold">
                  Nama Lengkap <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-email" className="text-xs font-semibold">
                  Alamat Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-phone" className="text-xs font-semibold">
                    No. Telepon / WhatsApp
                  </Label>
                  <Input
                    id="edit-phone"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Peran (Role)</Label>
                  <Select value={formRole} onValueChange={(val: Role) => setFormRole(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Sales Officer</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-note" className="text-xs font-semibold">
                  Catatan / Cabang / Posisi
                </Label>
                <Input
                  id="edit-note"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20">
                <div>
                  <p className="text-xs font-semibold text-foreground">Status Keaktifan Akun</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formActive
                      ? "Akun ini aktif dan dapat digunakan"
                      : "Akun dinonaktifkan sementara"}
                  </p>
                </div>
                <Switch checked={formActive} onCheckedChange={setFormActive} />
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditOpen(false);
                    setSelectedAccount(null);
                  }}
                  disabled={isSaving}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={isSaving} className="gap-1.5">
                  {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* AlertDialog: Hapus Akun (Delete) */}
        <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" /> Hapus Akun Pengguna?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  Apakah Anda yakin ingin menghapus akun{" "}
                  <strong className="text-foreground">{selectedAccount?.name}</strong> (
                  <span className="font-mono">{selectedAccount?.email}</span>)?
                </p>
                {selectedAccount && customerCountsByOwner[selectedAccount.name] > 0 && (
                  <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs">
                    Akun ini saat ini tercatat memiliki{" "}
                    <strong>{customerCountsByOwner[selectedAccount.name]} nasabah</strong> yang
                    ditugaskan. Anda dapat menugaskan ulang nasabah tersebut di menu Data & Impor.
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Tindakan ini permanen dan akan menghapus akun dari database sistem.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setIsDeleteOpen(false);
                  setSelectedAccount(null);
                }}
                disabled={isSaving}
              >
                Batal
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isSaving}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isSaving ? "Menghapus..." : "Ya, Hapus Akun"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
}
