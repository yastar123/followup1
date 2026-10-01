import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Role = "sales" | "admin";

export type Customer = {
  id: string;
  name: string; // NAMA
  contractNumber: string; // NO KONTRAK
  phone: string; // NO TLP (normalized 62...)
  postalCode: string; // KODE POST
  mod: string; // MOD
  unitType: string; // TYPE UNIT
  year: string; // TAHUN
  contractStatus: string; // STATUS
  segment: string; // SEGMENTASI
  handling: string; // HANDLING

  // Compatibility and system fields
  city: string;
  company: string;
  product: string;
  unit: string;
  region: string;
  value: number;
  source: string;
  status: "Baru" | "Proses" | "Tertarik" | "Tidak Tertarik" | "Closing";
  owner: string;
  note: string;
  createdAt: string;
};

export type FollowUp = {
  id: string;
  customerId: string;
  channel: "WhatsApp" | "WhatsApp Business" | "Telepon";
  outcome: "Chat dibalas" | "Chat tidak dibalas" | "Telepon dijawab" | "Telepon tidak dijawab";
  interest:
    | "Tertarik"
    | "Tidak Tertarik"
    | "Masih Pertimbangan"
    | "Belum minat"
    | "Pikir-pikir / diskusi"
    | "Kirim simulasi"
    | "Langsung dimatikan";
  reason: string;
  nextAction: string;
  by: string;
  at: string;
};

export type Template = { id: string; name: string; body: string };

export type Account = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  phone?: string;
  note?: string;
  createdAt?: string;
  assignedTemplateIds?: string[];
  defaultTemplateId?: string;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  by: string;
  createdAt: string;
  updatedAt: string;
};

type State = {
  role: Role | null;
  user: string;
  customers: Customer[];
  followUps: FollowUp[];
  templates: Template[];
  accounts: Account[];
  notes: Note[];
  sheetUrl: string;
  impersonating?: boolean;
  isLoaded: boolean;
  isLoading: boolean;
  loadError: string | null;
};

const initial: State = {
  role: null,
  user: "Admin Utama",
  customers: [],
  followUps: [],
  templates: [],
  accounts: [],
  notes: [],
  sheetUrl: "",
  impersonating: false,
  isLoaded: false,
  isLoading: true,
  loadError: null,
};

type Ctx = State & {
  dbStatus: { type: "PostgreSQL" | "File System" | "Server DB"; connected: boolean };
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string; role?: Role }>;
  logout: () => Promise<void>;
  reloadState: () => Promise<void>;
  setRole: (r: Role | null, userName?: string) => void;
  impersonate: (user: string) => void;
  stopImpersonate: () => void;
  addFollowUp: (f: Omit<FollowUp, "id" | "at" | "by">) => Promise<boolean>;
  addCustomer: (c: Omit<Customer, "id"> & { id?: string }) => Promise<Customer | null>;
  updateCustomer: (id: string, patch: Partial<Customer>) => Promise<boolean>;
  removeCustomer: (id: string) => Promise<boolean>;
  deleteCustomers: (ids: string[]) => Promise<number>;
  importCustomers: (customers: Customer[]) => Promise<{ count: number }>;
  saveTemplate: (t: Template) => Promise<boolean>;
  removeTemplate: (id: string) => Promise<boolean>;
  addAccount: (a: Omit<Account, "id"> & { password?: string }) => Promise<boolean>;
  updateAccount: (
    id: string,
    patch: Partial<Omit<Account, "id">> & { password?: string },
  ) => Promise<boolean>;
  removeAccount: (id: string) => Promise<boolean>;
  toggleAccount: (id: string) => Promise<boolean>;
  setSalesBroadcastTemplates: (
    accountId: string,
    assignedTemplateIds: string[],
    defaultTemplateId?: string,
  ) => void;
  setAllSalesBroadcastTemplates: (
    assignedTemplateIds: string[],
    defaultTemplateId?: string,
  ) => void;
  addNote: (n: { title: string; body: string }) => Promise<boolean>;
  updateNote: (id: string, patch: { title: string; body: string }) => Promise<boolean>;
  removeNote: (id: string) => Promise<boolean>;
  setSheetUrl: (u: string) => void;
};

const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  // Purge legacy data caches from localStorage on initialization
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("acc_data_cache_v5");
      localStorage.removeItem("acc_data_cache_v4");
      localStorage.removeItem("acc_data_cache");
    } catch {
      /* ignore */
    }
  }

  const [state, setState] = useState<State>(initial);
  const stateRef = useRef<State>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [dbStatus, setDbStatus] = useState<{
    type: "PostgreSQL" | "File System" | "Server DB";
    connected: boolean;
  }>({
    type: "PostgreSQL",
    connected: false,
  });

  const loadServerState = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, loadError: null }));

      // 1. Check current session
      const authRes = await fetch("/api/auth/me", { credentials: "include" });
      if (!authRes.ok) {
        setState((prev) => ({
          ...prev,
          role: null,
          user: "",
          isLoaded: true,
          isLoading: false,
          loadError: null,
        }));
        return;
      }

      const authData = await authRes.json();
      const currentUserRole = authData?.user?.role as Role;
      const currentUserName = authData?.user?.name || "Admin Utama";

      // 2. Fetch DB status
      fetch("/api/db-status", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setDbStatus(d))
        .catch(() => {});

      // 3. Fetch state
      const stateRes = await fetch("/api/state", { credentials: "include" });
      if (!stateRes.ok) {
        throw new Error("Gagal mengambil data dari server");
      }

      const data = await stateRes.json();

      setState((prev) => ({
        ...prev,
        role: currentUserRole,
        user:
          currentUserRole === "sales"
            ? `Sales · ${currentUserName.split(" ")[0]}`
            : currentUserName,
        customers: Array.isArray(data.customers) ? data.customers : [],
        followUps: Array.isArray(data.followUps) ? data.followUps : [],
        templates: Array.isArray(data.templates) ? data.templates : [],
        accounts: Array.isArray(data.accounts) ? data.accounts : [],
        notes: Array.isArray(data.notes) ? data.notes : [],
        isLoaded: true,
        isLoading: false,
        loadError: null,
      }));
    } catch (err: unknown) {
      console.error("[Store] Error loading state:", err);
      setState((prev) => ({
        ...prev,
        isLoaded: true,
        isLoading: false,
        loadError: (err as Error)?.message || "Gagal terhubung ke database server",
      }));
    }
  }, []);

  useEffect(() => {
    loadServerState();
  }, [loadServerState]);

  const login = useCallback(
    async (
      email: string,
      password: string,
    ): Promise<{ success: boolean; error?: string; role?: Role }> => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data?.error || "Gagal masuk ke sistem." };
        }

        const user = data.user;
        const role = user.role as Role;
        const userName = role === "sales" ? `Sales · ${user.name.split(" ")[0]}` : user.name;

        setState((prev) => ({
          ...prev,
          role,
          user: userName,
          loadError: null,
        }));

        await loadServerState();
        return { success: true, role };
      } catch {
        return { success: false, error: "Terjadi kesalahan jaringan." };
      }
    },
    [loadServerState],
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    setState({
      ...initial,
      isLoaded: true,
      isLoading: false,
    });
  }, []);

  // Granular Customer Actions
  const addCustomer = useCallback(
    async (c: Omit<Customer, "id"> & { id?: string }): Promise<Customer | null> => {
      const fullCustomer: Customer = {
        ...c,
        id: c.id || `c${Date.now()}`,
        createdAt: c.createdAt || new Date().toISOString(),
      };
      try {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(fullCustomer),
        });
        if (!res.ok) throw new Error("Gagal menyimpan customer");
        setState((prev) => ({
          ...prev,
          customers: [fullCustomer, ...prev.customers],
        }));
        return fullCustomer;
      } catch (e) {
        console.error(e);
        return null;
      }
    },
    [],
  );

  const updateCustomer = useCallback(
    async (id: string, patch: Partial<Customer>): Promise<boolean> => {
      const existing = stateRef.current.customers.find((c) => c.id === id);
      if (!existing) return false;
      const merged = { ...existing, ...patch };
      try {
        const res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(merged),
        });
        if (!res.ok) throw new Error("Gagal memperbarui customer");
        setState((prev) => ({
          ...prev,
          customers: prev.customers.map((c) => (c.id === id ? merged : c)),
        }));
        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    },
    [],
  );

  const removeCustomer = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Gagal menghapus customer");
      setState((prev) => ({
        ...prev,
        customers: prev.customers.filter((c) => c.id !== id),
        followUps: prev.followUps.filter((f) => f.customerId !== id),
      }));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, []);

  const deleteCustomers = useCallback(async (ids: string[]): Promise<number> => {
    if (!ids.length) return 0;
    try {
      const res = await fetch("/api/customers/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData?.error || "Gagal menghapus customer batch");
      }
      const idSet = new Set(ids);
      setState((prev) => ({
        ...prev,
        customers: prev.customers.filter((c) => !idSet.has(c.id)),
        followUps: prev.followUps.filter((f) => !idSet.has(f.customerId)),
      }));
      return ids.length;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, []);

  const importCustomers = useCallback(
    async (customers: Customer[]): Promise<{ count: number }> => {
      if (!customers.length) return { count: 0 };
      const res = await fetch("/api/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ customers }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData?.error || "Gagal mengimpor data customer");
      }
      const data = await res.json();
      await loadServerState();
      return { count: data.count || customers.length };
    },
    [loadServerState],
  );

  // Follow-ups
  const addFollowUp = useCallback(
    async (f: Omit<FollowUp, "id" | "at" | "by">): Promise<boolean> => {
      const fullFollowUp: FollowUp = {
        ...f,
        id: `f${Date.now()}`,
        at: new Date().toISOString(),
        by: stateRef.current.user,
      };

      try {
        const res = await fetch("/api/followups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(fullFollowUp),
        });
        if (!res.ok) throw new Error("Gagal menyimpan follow up");

        setState((prev) => ({
          ...prev,
          followUps: [fullFollowUp, ...prev.followUps],
          customers: prev.customers.map((c) => {
            if (c.id !== f.customerId) return c;
            const notConnected =
              f.outcome === "Telepon tidak dijawab" || f.outcome === "Chat tidak dibalas";
            if (notConnected) return c;
            return {
              ...c,
              status:
                f.interest === "Tertarik" || f.interest === "Kirim simulasi"
                  ? "Tertarik"
                  : f.interest === "Tidak Tertarik" ||
                      f.interest === "Belum minat" ||
                      f.interest === "Langsung dimatikan"
                    ? "Tidak Tertarik"
                    : "Proses",
            };
          }),
        }));
        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    },
    [],
  );

  // Templates
  const saveTemplate = useCallback(async (t: Template): Promise<boolean> => {
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(t),
      });
      if (!res.ok) throw new Error("Gagal menyimpan template");
      setState((prev) => ({
        ...prev,
        templates: prev.templates.some((x) => x.id === t.id)
          ? prev.templates.map((x) => (x.id === t.id ? t : x))
          : [...prev.templates, t],
      }));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, []);

  const removeTemplate = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Gagal menghapus template");
      setState((prev) => ({
        ...prev,
        templates: prev.templates.filter((t) => t.id !== id),
      }));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, []);

  // Accounts
  const addAccount = useCallback(
    async (a: Omit<Account, "id"> & { password?: string }): Promise<boolean> => {
      const fullAccount = {
        ...a,
        id: `a${Date.now()}`,
        createdAt: a.createdAt || new Date().toISOString(),
      };
      try {
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(fullAccount),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData?.error || "Gagal menambah akun");
        }
        setState((prev) => ({
          ...prev,
          accounts: [...prev.accounts, fullAccount],
        }));
        return true;
      } catch (e) {
        console.error(e);
        throw e;
      }
    },
    [],
  );

  const updateAccount = useCallback(
    async (
      id: string,
      patch: Partial<Omit<Account, "id">> & { password?: string },
    ): Promise<boolean> => {
      const existing = stateRef.current.accounts.find((a) => a.id === id);
      if (!existing) return false;
      const merged = { ...existing, ...patch, id };
      try {
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(merged),
        });
        if (!res.ok) throw new Error("Gagal memperbarui akun");
        setState((prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        }));
        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    },
    [],
  );

  const removeAccount = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/accounts/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData?.error || "Gagal menghapus akun");
      }
      setState((prev) => ({
        ...prev,
        accounts: prev.accounts.filter((a) => a.id !== id),
      }));
      return true;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }, []);

  const toggleAccount = useCallback(
    async (id: string): Promise<boolean> => {
      const existing = stateRef.current.accounts.find((a) => a.id === id);
      if (!existing) return false;
      return updateAccount(id, { active: !existing.active });
    },
    [updateAccount],
  );

  // Notes
  const addNote = useCallback(async (n: { title: string; body: string }): Promise<boolean> => {
    const fullNote: Note = {
      ...n,
      id: `n${Date.now()}`,
      by: stateRef.current.user,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(fullNote),
      });
      if (!res.ok) throw new Error("Gagal menambah catatan");
      setState((prev) => ({
        ...prev,
        notes: [fullNote, ...(prev.notes ?? [])],
      }));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, []);

  const updateNote = useCallback(
    async (id: string, patch: { title: string; body: string }): Promise<boolean> => {
      const existing = stateRef.current.notes.find((n) => n.id === id);
      if (!existing) return false;
      const merged = { ...existing, ...patch, updatedAt: new Date().toISOString() };
      try {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(merged),
        });
        if (!res.ok) throw new Error("Gagal memperbarui catatan");
        setState((prev) => ({
          ...prev,
          notes: (prev.notes ?? []).map((n) => (n.id === id ? merged : n)),
        }));
        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    },
    [],
  );

  const removeNote = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/notes/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Gagal menghapus catatan");
      setState((prev) => ({
        ...prev,
        notes: (prev.notes ?? []).filter((n) => n.id !== id),
      }));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      dbStatus,
      login,
      logout,
      reloadState: loadServerState,
      setRole: (role, userName) => {
        const assignedUser = userName || (role === "admin" ? "Admin Utama" : "Petugas Sales");
        setState((s) => ({
          ...s,
          role,
          user: assignedUser,
          impersonating: false,
        }));
      },
      impersonate: (user) => {
        setState((s) => ({ ...s, role: "sales", user, impersonating: true }));
      },
      stopImpersonate: () => {
        setState((s) => ({ ...s, role: "admin", user: "Admin Utama", impersonating: false }));
      },
      addFollowUp,
      addCustomer,
      updateCustomer,
      removeCustomer,
      deleteCustomers,
      importCustomers,
      saveTemplate,
      removeTemplate,
      addAccount,
      updateAccount,
      removeAccount,
      toggleAccount,
      setSalesBroadcastTemplates: (accountId, assignedTemplateIds, defaultTemplateId) =>
        setState((s) => ({
          ...s,
          accounts: s.accounts.map((a) =>
            a.id === accountId
              ? {
                  ...a,
                  assignedTemplateIds,
                  defaultTemplateId:
                    defaultTemplateId || assignedTemplateIds[0] || a.defaultTemplateId,
                }
              : a,
          ),
        })),
      setAllSalesBroadcastTemplates: (assignedTemplateIds, defaultTemplateId) =>
        setState((s) => ({
          ...s,
          accounts: s.accounts.map((a) =>
            a.role === "sales"
              ? {
                  ...a,
                  assignedTemplateIds,
                  defaultTemplateId:
                    defaultTemplateId || assignedTemplateIds[0] || a.defaultTemplateId,
                }
              : a,
          ),
        })),
      setSheetUrl: (sheetUrl) => setState((s) => ({ ...s, sheetUrl })),
      addNote,
      updateNote,
      removeNote,
    }),
    [
      state,
      dbStatus,
      login,
      logout,
      loadServerState,
      addFollowUp,
      addCustomer,
      updateCustomer,
      removeCustomer,
      deleteCustomers,
      importCustomers,
      saveTemplate,
      removeTemplate,
      addAccount,
      updateAccount,
      removeAccount,
      toggleAccount,
      addNote,
      updateNote,
      removeNote,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

/** Variabel template — dipetakan dari 10 kolom file Excel yang diimpor di menu Database. */
export const TEMPLATE_VARS = [
  { key: "nama", label: "Nama customer (NAMA)", column: "NAMA", example: "SAPARUDIN" },
  {
    key: "no_kontrak",
    label: "Nomor kontrak (NO KONTRAK)",
    column: "NO KONTRAK",
    example: "0150057400245421",
  },
  {
    key: "no_tlp",
    label: "Nomor telepon / WA (NO TLP)",
    column: "NO TLP",
    example: "085267475365",
  },
  { key: "kode_pos", label: "Kode pos (KODE POST)", column: "KODE POST", example: "34163" },
  { key: "mod", label: "MOD (MOD)", column: "MOD", example: "3" },
  { key: "type_unit", label: "Tipe unit (TYPE UNIT)", column: "TYPE UNIT", example: "KIJANG" },
  { key: "tahun", label: "Tahun kendaraan (TAHUN)", column: "TAHUN", example: "2001" },
  {
    key: "unit",
    label: "Unit & Tahun lengkap (TYPE UNIT + TAHUN)",
    column: "TYPE UNIT + TAHUN",
    example: "KIJANG 2001",
  },
  {
    key: "status_kontrak",
    label: "Status kontrak ACC (STATUS)",
    column: "STATUS",
    example: "03. Open Berjalan 56%-75%",
  },
  {
    key: "segmentasi",
    label: "Segmentasi (SEGMENTASI)",
    column: "SEGMENTASI",
    example: "SOLITAIRE",
  },
  {
    key: "handling",
    label: "Cabang / Handling (HANDLING)",
    column: "HANDLING",
    example: "BANDARJAYA",
  },
  { key: "status", label: "Status follow up sales", column: "-", example: "Baru" },
  { key: "sales", label: "Nama sales pengirim", column: "-", example: "Rio Saputra" },
] as const;

export function renderTemplate(body: string, c: Customer, sales: string) {
  return body
    .replaceAll("{{nama}}", c.name || "")
    .replaceAll("{{no_kontrak}}", c.contractNumber || "")
    .replaceAll("{{no_tlp}}", c.phone || "")
    .replaceAll("{{no_hp}}", c.phone || "")
    .replaceAll("{{kode_pos}}", c.postalCode || "")
    .replaceAll("{{kode_post}}", c.postalCode || "")
    .replaceAll("{{mod}}", c.mod || "")
    .replaceAll("{{type_unit}}", c.unitType || c.unit || "")
    .replaceAll("{{tipe_unit}}", c.unitType || c.unit || "")
    .replaceAll("{{tahun}}", c.year || "")
    .replaceAll("{{unit}}", c.unit || `${c.unitType} ${c.year}`.trim() || c.product || "")
    .replaceAll("{{status_kontrak}}", c.contractStatus || c.company || "")
    .replaceAll("{{segmentasi}}", c.segment || "")
    .replaceAll("{{segmen}}", c.segment || "")
    .replaceAll("{{handling}}", c.handling || c.region || c.city || "")
    .replaceAll("{{cabang}}", c.handling || c.region || c.city || "")
    .replaceAll("{{grup_produk}}", c.contractStatus || c.company || "")
    .replaceAll("{{status}}", c.status || "")
    .replaceAll("{{sales}}", sales || "");
}

export const waLink = (phone: string, message: string) =>
  `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

export const waBusinessLink = (phone: string, message: string) =>
  `https://api.whatsapp.com/send?phone=${phone.replace(/\D/g, "")}&text=${encodeURIComponent(message)}`;

export const normalizeSalesName = (name?: string | null) => {
  if (!name) return "";
  return name
    .replace(/^Sales\s*[·\-\s]\s*/i, "")
    .split("@")[0]
    .trim()
    .toLowerCase();
};

export const isMatchSales = (target?: string | null, salesUser?: string | null) => {
  if (!salesUser) return true;
  if (!target) return false;
  if (target === salesUser) return true;
  const cleanTarget = normalizeSalesName(target);
  const cleanUser = normalizeSalesName(salesUser);
  if (!cleanTarget || !cleanUser) return false;
  return (
    cleanTarget === cleanUser ||
    target.toLowerCase().includes(cleanUser) ||
    salesUser.toLowerCase().includes(cleanTarget)
  );
};
