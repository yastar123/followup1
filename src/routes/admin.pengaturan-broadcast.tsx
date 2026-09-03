import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  SlidersHorizontal,
  MessageSquare,
  Users,
  CheckCircle2,
  Sparkles,
  Save,
  RotateCcw,
  Eye,
  ExternalLink,
  Search,
  CheckSquare,
  HelpCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore, renderTemplate, type Account, type Template, type Customer } from "@/lib/store";

export const Route = createFileRoute("/admin/pengaturan-broadcast")({
  head: () => ({
    meta: [
      { title: "Pengaturan Broadcast Sales — ACC One" },
      {
        name: "description",
        content:
          "Atur dan tetapkan template pesan broadcast khusus untuk masing-masing petugas sales.",
      },
      { property: "og:title", content: "Pengaturan Broadcast Sales — ACC One" },
      {
        property: "og:description",
        content: "Atur pilihan template pesan broadcast untuk setiap tim sales.",
      },
    ],
  }),
  component: PengaturanBroadcastPage,
});

const sampleCustomer: Customer = {
  id: "preview",
  name: "Budi Santoso",
  contractNumber: "0150057400245421",
  phone: "628123456789",
  postalCode: "34163",
  mod: "3",
  unitType: "AVANZA G",
  year: "2021",
  contractStatus: "03. Open Berjalan 56%-75%",
  segment: "REGULER",
  handling: "JAKARTA UTARA",
  city: "JAKARTA",
  company: "03. Open Berjalan 56%-75%",
  product: "AVANZA G",
  unit: "AVANZA G 2021",
  region: "JAKARTA",
  value: 0,
  source: "Database ACC",
  status: "Baru",
  owner: "Sales",
  note: "",
  createdAt: new Date().toISOString(),
};

function PengaturanBroadcastPage() {
  const {
    accounts,
    templates,
    customers,
    setSalesBroadcastTemplates,
    setAllSalesBroadcastTemplates,
    impersonate,
    syncNow,
  } = useStore();

  const navigate = useNavigate();

  // Search & Filter
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "custom" | "default">("all");

  // Local draft state for sales configurations: { [accountId]: { templateIds: string[], defaultId: string } }
  const [drafts, setDrafts] = useState<{
    [accountId: string]: { templateIds: string[]; defaultId: string };
  }>({});

  // Global apply batch state
  const [batchTemplateId, setBatchTemplateId] = useState<string>(templates[0]?.id || "");
  const [isApplyingBatch, setIsApplyingBatch] = useState(false);

  // Preview Dialog State
  const [previewData, setPreviewData] = useState<{
    salesName: string;
    template: Template;
  } | null>(null);

  // Sales accounts only
  const salesAccounts = useMemo(() => {
    return accounts.filter((a) => a.role === "sales");
  }, [accounts]);

  // Helper to get effective configuration for a sales account
  const getSalesConfig = (account: Account) => {
    if (drafts[account.id]) {
      return drafts[account.id];
    }
    // If not in draft, read from account
    const assigned = account.assignedTemplateIds;
    const templateIds = assigned && assigned.length > 0 ? assigned : templates.map((t) => t.id);
    const defaultId =
      account.defaultTemplateId && templates.some((t) => t.id === account.defaultTemplateId)
        ? account.defaultTemplateId
        : templateIds[0] || templates[0]?.id || "";

    return { templateIds, defaultId };
  };

  const handleToggleTemplateForSales = (accountId: string, templateId: string) => {
    const account = salesAccounts.find((a) => a.id === accountId);
    if (!account) return;

    const currentConfig = getSalesConfig(account);
    const hasTemplate = currentConfig.templateIds.includes(templateId);

    let newTemplateIds: string[];
    if (hasTemplate) {
      // Don't allow unchecking all templates
      if (currentConfig.templateIds.length <= 1) {
        toast.error("Sales harus memiliki minimal satu template pesan broadcast.");
        return;
      }
      newTemplateIds = currentConfig.templateIds.filter((id) => id !== templateId);
    } else {
      newTemplateIds = [...currentConfig.templateIds, templateId];
    }

    let newDefaultId = currentConfig.defaultId;
    if (!newTemplateIds.includes(newDefaultId)) {
      newDefaultId = newTemplateIds[0] || "";
    }

    setDrafts((prev) => ({
      ...prev,
      [accountId]: {
        templateIds: newTemplateIds,
        defaultId: newDefaultId,
      },
    }));
  };

  const handleSetDefaultTemplate = (accountId: string, defaultId: string) => {
    const account = salesAccounts.find((a) => a.id === accountId);
    if (!account) return;

    const currentConfig = getSalesConfig(account);
    // Ensure the default template is also included in assigned templateIds
    const newTemplateIds = currentConfig.templateIds.includes(defaultId)
      ? currentConfig.templateIds
      : [...currentConfig.templateIds, defaultId];

    setDrafts((prev) => ({
      ...prev,
      [accountId]: {
        templateIds: newTemplateIds,
        defaultId,
      },
    }));
  };

  const handleSelectAllTemplatesForSales = (accountId: string) => {
    const allIds = templates.map((t) => t.id);
    const account = salesAccounts.find((a) => a.id === accountId);
    const currentDefault = account?.defaultTemplateId || allIds[0] || "";

    setDrafts((prev) => ({
      ...prev,
      [accountId]: {
        templateIds: allIds,
        defaultId: currentDefault,
      },
    }));
    toast.info("Semua template diaktifkan untuk sales ini. Jangan lupa simpan perubahan.");
  };

  const handleSaveSalesConfig = async (account: Account) => {
    const config = getSalesConfig(account);
    setSalesBroadcastTemplates(account.id, config.templateIds, config.defaultId);

    // Clean from draft
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[account.id];
      return next;
    });

    toast.success(`Pengaturan broadcast untuk ${account.name} berhasil disimpan.`);
    await syncNow();
  };

  const handleApplyBatchToAll = async () => {
    if (!batchTemplateId) {
      toast.error("Pilih template default terlebih dahulu.");
      return;
    }
    setIsApplyingBatch(true);
    try {
      // Set all sales to have this default template while retaining or giving all templates
      const allIds = templates.map((t) => t.id);
      setAllSalesBroadcastTemplates(allIds, batchTemplateId);
      setDrafts({});
      const targetTemplate = templates.find((t) => t.id === batchTemplateId);
      toast.success(
        `Template "${targetTemplate?.name || "Pilihan"}" berhasil diterapkan ke seluruh tim sales!`,
      );
      await syncNow();
    } catch {
      toast.error("Gagal menerapkan template serentak.");
    } finally {
      setIsApplyingBatch(false);
    }
  };

  const handleResetAllToFullAccess = async () => {
    const allIds = templates.map((t) => t.id);
    setAllSalesBroadcastTemplates(allIds, allIds[0]);
    setDrafts({});
    toast.success("Semua sales telah diatur untuk dapat menggunakan seluruh template.");
    await syncNow();
  };

  const handleTestAsSales = (account: Account) => {
    const firstName = account.name.split(" ")[0];
    const userKey = `Sales · ${firstName}`;
    impersonate(userKey);
    toast.success(`Beralih ke mode ${userKey} — membuka Pesan Broadcast`);
    navigate({ to: "/sales/broadcast" });
  };

  // Filtered sales
  const filteredSales = useMemo(() => {
    return salesAccounts.filter((a) => {
      const matchSearch =
        search.trim() === "" ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase());

      const hasCustomAssignment =
        a.assignedTemplateIds &&
        a.assignedTemplateIds.length > 0 &&
        a.assignedTemplateIds.length < templates.length;

      let matchFilter = true;
      if (filterMode === "custom") matchFilter = Boolean(hasCustomAssignment);
      if (filterMode === "default") matchFilter = !hasCustomAssignment;

      return matchSearch && matchFilter;
    });
  }, [salesAccounts, search, filterMode, templates.length]);

  return (
    <AppShell
      role="admin"
      title="Pengaturan Broadcast Sales"
      subtitle="Pilih dan tentukan template pesan broadcast yang dapat digunakan oleh masing-masing sales dari template yang sudah disediakan admin."
    >
      <div className="space-y-6">
        {/* Top Summary & Highlights */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="surface-card p-4 flex items-center justify-between border-l-4 border-l-primary">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Akun Sales</p>
              <h3 className="text-2xl font-bold font-display text-foreground mt-0.5">
                {salesAccounts.length}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
          </div>

          <div className="surface-card p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Template Tersedia</p>
              <h3 className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400 mt-0.5">
                {templates.length}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <MessageSquare className="size-5" />
            </div>
          </div>

          <div className="surface-card p-4 flex items-center justify-between border-l-4 border-l-amber-500">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pengaturan Khusus</p>
              <h3 className="text-2xl font-bold font-display text-amber-600 dark:text-amber-400 mt-0.5">
                {
                  salesAccounts.filter(
                    (a) =>
                      a.assignedTemplateIds &&
                      a.assignedTemplateIds.length > 0 &&
                      a.assignedTemplateIds.length < templates.length,
                  ).length
                }
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
              <SlidersHorizontal className="size-5" />
            </div>
          </div>

          <div className="surface-card p-4 flex flex-col justify-between">
            <p className="text-xs text-muted-foreground font-medium">Kelola Isi Template</p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mt-2 text-xs font-semibold w-full justify-between"
            >
              <Link to="/admin/pesan">
                <span>Edit / Buat Template</span>
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Global Batch Action Panel */}
        <section className="surface-card p-5 border border-primary/20 bg-primary/5 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <Zap className="size-4 shrink-0" />
              <span>Aksi Cepat: Terapkan Template Serentak ke Seluruh Sales</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetAllToFullAccess}
              className="text-xs text-muted-foreground hover:text-foreground h-8"
            >
              <RotateCcw className="size-3.5 mr-1.5" />
              Reset Semua ke Seluruh Template
            </Button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Jika Anda sedang menjalankan program promosi khusus (misal: penawaran pembiayaan ulang
            atau event tertentu), Anda dapat menetapkan template default yang sama untuk semua sales
            sekaligus.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
            <div className="flex-1 min-w-[240px]">
              <Select value={batchTemplateId} onValueChange={setBatchTemplateId}>
                <SelectTrigger className="bg-background text-xs h-9">
                  <SelectValue placeholder="Pilih template untuk seluruh sales..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleApplyBatchToAll}
              disabled={isApplyingBatch || templates.length === 0}
              className="text-xs font-semibold h-9 shrink-0 gap-1.5 shadow-xs"
            >
              <Sparkles className="size-3.5" />
              Terapkan ke Semua Sales
            </Button>
          </div>
        </section>

        {/* Sales List & Controls */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau email sales..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                Filter:
              </span>
              <Select
                value={filterMode}
                onValueChange={(v) => setFilterMode(v as "all" | "custom" | "default")}
              >
                <SelectTrigger className="w-[180px] h-9 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Sales ({salesAccounts.length})</SelectItem>
                  <SelectItem value="custom">Pengaturan Khusus</SelectItem>
                  <SelectItem value="default">Semua Template Aktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sales Cards */}
          {filteredSales.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {filteredSales.map((account) => {
                const config = getSalesConfig(account);
                const hasDraftChanges = Boolean(drafts[account.id]);
                const isCustomized =
                  config.templateIds.length > 0 && config.templateIds.length < templates.length;

                const defaultTemplate = templates.find((t) => t.id === config.defaultId);
                const assignedCustomersCount = customers.filter(
                  (c) =>
                    c.owner === account.name || c.owner === `Sales · ${account.name.split(" ")[0]}`,
                ).length;

                return (
                  <div
                    key={account.id}
                    className={`surface-card p-5 rounded-xl border flex flex-col justify-between transition-all space-y-4 ${
                      hasDraftChanges
                        ? "border-amber-500/50 bg-amber-500/[0.02] ring-1 ring-amber-500/20"
                        : "border-border"
                    }`}
                  >
                    {/* Sales Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display font-semibold text-base text-foreground">
                            {account.name}
                          </h3>
                          <Badge
                            variant={account.active ? "default" : "secondary"}
                            className="text-[10px] px-1.5 py-0 h-4 font-medium"
                          >
                            {account.active ? "Aktif" : "Nonaktif"}
                          </Badge>
                          {isCustomized && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 font-medium"
                            >
                              Khusus ({config.templateIds.length}/{templates.length})
                            </Badge>
                          )}
                          {hasDraftChanges && (
                            <Badge
                              variant="destructive"
                              className="text-[10px] px-1.5 py-0 h-4 font-medium animate-pulse"
                            >
                              Belum Disimpan
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{account.email}</p>
                        <p className="text-[11px] text-muted-foreground/80 mt-1">
                          Memegang{" "}
                          <strong className="text-foreground">{assignedCustomersCount}</strong>{" "}
                          customer database
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTestAsSales(account)}
                        className="text-xs h-7 px-2 text-primary hover:bg-primary/10 shrink-0"
                        title="Masuk sebagai sales ini untuk mencoba tampilan broadcast"
                      >
                        <ExternalLink className="size-3.5 mr-1" />
                        Uji Sales
                      </Button>
                    </div>

                    {/* Template Default Selector */}
                    <div className="space-y-1.5 bg-muted/30 p-3 rounded-lg border border-border/60">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-semibold text-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5 text-primary" /> Template Utama /
                          Default
                        </label>
                        <span className="text-[10px] text-muted-foreground">
                          Otomatis terpilih saat sales broadcast
                        </span>
                      </div>
                      <Select
                        value={config.defaultId}
                        onValueChange={(val) => handleSetDefaultTemplate(account.id, val)}
                      >
                        <SelectTrigger className="bg-background text-xs h-8">
                          <SelectValue placeholder="Pilih template default..." />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id} className="text-xs">
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Allowed / Assigned Templates Checkboxes */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <MessageSquare className="size-3.5 text-muted-foreground" />
                          Daftar Template yang Boleh Digunakan:
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectAllTemplatesForSales(account.id)}
                          className="text-[11px] h-6 px-1.5 text-muted-foreground hover:text-foreground"
                        >
                          Pilih Semua
                        </Button>
                      </div>

                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {templates.map((t) => {
                          const isChecked = config.templateIds.includes(t.id);
                          const isDefault = config.defaultId === t.id;

                          return (
                            <div
                              key={t.id}
                              className={`p-2.5 rounded-lg border text-xs transition-colors flex items-start justify-between gap-3 ${
                                isDefault
                                  ? "border-primary/50 bg-primary/5"
                                  : isChecked
                                    ? "border-border bg-card hover:bg-muted/30"
                                    : "border-border/40 bg-muted/20 opacity-60"
                              }`}
                            >
                              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                <Checkbox
                                  id={`chk-${account.id}-${t.id}`}
                                  checked={isChecked}
                                  onCheckedChange={() =>
                                    handleToggleTemplateForSales(account.id, t.id)
                                  }
                                  className="mt-0.5 shrink-0"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <label
                                      htmlFor={`chk-${account.id}-${t.id}`}
                                      className="font-medium text-foreground cursor-pointer"
                                    >
                                      {t.name}
                                    </label>
                                    {isDefault && (
                                      <span className="text-[9px] bg-primary/20 text-primary font-semibold px-1 rounded">
                                        Default
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-muted-foreground text-[11px] line-clamp-1 mt-0.5">
                                    {t.body}
                                  </p>
                                </div>
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setPreviewData({
                                    salesName: account.name,
                                    template: t,
                                  })
                                }
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
                                title="Lihat Pratinjau Teks Pesan"
                              >
                                <Eye className="size-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer Save Button */}
                    <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-3">
                      <div className="text-[11px] text-muted-foreground truncate">
                        Default:{" "}
                        <strong className="text-foreground">
                          {defaultTemplate?.name || "Belum dipilih"}
                        </strong>
                      </div>
                      <Button
                        size="sm"
                        disabled={!hasDraftChanges}
                        onClick={() => handleSaveSalesConfig(account)}
                        className={`text-xs h-8 px-3 font-semibold gap-1.5 ${
                          hasDraftChanges ? "shadow-sm" : "opacity-60"
                        }`}
                      >
                        <Save className="size-3.5" />
                        Simpan Pengaturan
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="surface-card p-10 text-center text-muted-foreground rounded-xl border border-dashed text-xs sm:text-sm space-y-3">
              <HelpCircle className="size-8 mx-auto text-muted-foreground/50" />
              <p>Tidak ada sales yang cocok dengan pencarian atau filter Anda.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setFilterMode("all");
                }}
              >
                Reset Filter
              </Button>
            </div>
          )}
        </div>

        {/* Interactive Live Message Preview Dialog */}
        <Dialog open={Boolean(previewData)} onOpenChange={(open) => !open && setPreviewData(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Eye className="size-4 text-primary" />
                Pratinjau Pesan Broadcast Sales
              </DialogTitle>
              <DialogDescription className="text-xs">
                Simulasi pesan WhatsApp saat dikirimkan oleh{" "}
                <strong className="text-foreground">{previewData?.salesName}</strong> ke customer.
              </DialogDescription>
            </DialogHeader>

            {previewData && (
              <div className="space-y-3 pt-2">
                <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Nama Template:</span>
                    <strong className="text-foreground">{previewData.template.name}</strong>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pengirim (Sales):</span>
                    <strong className="text-foreground">{previewData.salesName}</strong>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Format Teks WhatsApp yang Dihasilkan:
                  </label>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs font-sans leading-relaxed text-foreground whitespace-pre-wrap shadow-inner">
                    {renderTemplate(
                      previewData.template.body,
                      sampleCustomer,
                      previewData.salesName,
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
