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
  channel: "WhatsApp" | "Telepon";
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
  password?: string;
  phone?: string;
  note?: string;
  createdAt?: string;
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
};

const initial: State = {
  role: null,
  user: "Admin Utama",
  customers: [],
  followUps: [],
  templates: [
    {
      id: "t1",
      name: "Perkenalan Awal",
      body: "Selamat pagi Bapak/Ibu {{nama}}, saya {{sales}} dari ACC (Astra Credit Companies) cabang {{cabang}}. Terkait unit {{unit}} dengan nomor kontrak {{no_kontrak}}, boleh saya bantu jelaskan program terbaru kami?",
    },
    {
      id: "t2",
      name: "Penawaran Pembiayaan Ulang",
      body: "Halo {{nama}}, kontrak {{no_kontrak}} untuk unit {{unit}} Anda di ACC sudah berjalan baik. Kami ada program pembiayaan khusus segmen {{segmen}}. Apakah berkenan saya kirimkan simulasinya?",
    },
  ],
  accounts: [
    {
      id: "a_admin",
      name: "Admin Utama",
      email: (import.meta.env.VITE_ADMIN_EMAIL || "admin@acc.co.id").replace(/['"]/g, "").trim(),
      role: "admin",
      active: true,
      password: (import.meta.env.VITE_ADMIN_PASSWORD || "password123").replace(/['"]/g, "").trim(),
    },
  ],
  notes: [],
  sheetUrl: "",
  impersonating: false,
};

type Ctx = State & {
  dbStatus: { type: "PostgreSQL" | "File System" | "Local Cache"; connected: boolean };
  syncNow: (customState?: State) => Promise<boolean>;
  setRole: (r: Role | null, userName?: string) => void;
  impersonate: (user: string) => void;
  stopImpersonate: () => void;
  addFollowUp: (f: Omit<FollowUp, "id" | "at" | "by">) => void;
  addCustomer: (c: Omit<Customer, "id"> & { id?: string }) => void;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  removeCustomer: (id: string) => void;
  deleteCustomers: (ids: string[]) => void;
  clearAllCustomers: () => void;
  addCustomers: (c: Customer[]) => State;
  saveTemplate: (t: Template) => void;
  removeTemplate: (id: string) => void;
  addAccount: (a: Omit<Account, "id">) => void;
  updateAccount: (id: string, patch: Partial<Omit<Account, "id">>) => void;
  removeAccount: (id: string) => void;
  toggleAccount: (id: string) => void;
  addNote: (n: { title: string; body: string }) => void;
  updateNote: (id: string, patch: { title: string; body: string }) => void;
  removeNote: (id: string) => void;
  setSheetUrl: (u: string) => void;
};

const StoreContext = createContext<Ctx | null>(null);
const KEY = "acc-followup-state-v3";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [isLoaded, setIsLoaded] = useState(false);
  const stateRef = useRef<State>(initial);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [dbStatus, setDbStatus] = useState<{
    type: "PostgreSQL" | "File System" | "Local Cache";
    connected: boolean;
  }>({
    type: "Local Cache",
    connected: false,
  });

  useEffect(() => {
    // 1. Clear legacy caches & load local storage state first
    try {
      localStorage.removeItem("acc-followup-state-v1");
      localStorage.removeItem("acc-followup-state-v2");
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const restored: State = {
          ...initial,
          ...parsed,
          customers: Array.isArray(parsed.customers) ? parsed.customers : [],
          followUps: Array.isArray(parsed.followUps) ? parsed.followUps : [],
          notes: Array.isArray(parsed.notes) ? parsed.notes : [],
        };
        setState(restored);
        stateRef.current = restored;
      }
    } catch {
      /* ignore */
    }

    // 2. Fetch live DB connection status
    fetch("/api/db-status")
      .then((res) => res.json())
      .then((data) => setDbStatus(data))
      .catch((e) => console.warn("Failed to load db status", e));

    // 3. Sync full state from backend (PostgreSQL / Server File)
    fetch("/api/state")
      .then((res) => {
        if (!res.ok) throw new Error("HTTP error " + res.status);
        return res.json();
      })
      .then((serverState) => {
        if (serverState && Array.isArray(serverState.accounts)) {
          setState((prev) => {
            const serverCusts = Array.isArray(serverState.customers) ? serverState.customers : [];
            const prevCusts = Array.isArray(prev.customers) ? prev.customers : [];
            // Preserve local customers if server returned empty list to prevent accidental wipe on refresh
            const finalCustomers = serverCusts.length > 0 ? serverCusts : prevCusts;

            const next: State = {
              ...prev,
              ...serverState,
              customers: finalCustomers,
              followUps: Array.isArray(serverState.followUps) ? serverState.followUps : [],
              notes: Array.isArray(serverState.notes) ? serverState.notes : [],
            };
            stateRef.current = next;
            return next;
          });
          setIsLoaded(true);
        } else {
          setIsLoaded(true);
        }
      })
      .catch((err) => {
        console.warn("Could not load state from backend database, using local storage cache:", err);
        setIsLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }

    // Debounce backend state saves to protect connection pools
    const timer = setTimeout(() => {
      fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      }).catch((err) => console.warn("Auto-sync to backend database failed:", err));
    }, 500);

    return () => clearTimeout(timer);
  }, [state, isLoaded]);

  const patch = useCallback((fn: (s: State) => State): State => {
    const nextState = fn(stateRef.current);
    stateRef.current = nextState;
    setState(nextState);
    return nextState;
  }, []);

  const syncNow = useCallback(async (customState?: State): Promise<boolean> => {
    const stateToSync = customState || stateRef.current;
    try {
      localStorage.setItem(KEY, JSON.stringify(stateToSync));
    } catch {
      /* ignore */
    }
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stateToSync),
      });
      const data = await res.json();
      return Boolean(data?.success || data?.ok);
    } catch (err) {
      console.warn("Manual sync to backend database failed:", err);
      return false;
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      dbStatus,
      syncNow,
      setRole: (role, userName) =>
        patch((s) => ({
          ...s,
          role,
          user: userName || (role === "admin" ? "Admin Utama" : "Petugas Sales"),
          impersonating: false,
        })),
      impersonate: (user) => patch((s) => ({ ...s, role: "sales", user, impersonating: true })),
      stopImpersonate: () =>
        patch((s) => ({ ...s, role: "admin", user: "Admin Utama", impersonating: false })),
      addFollowUp: (f) =>
        patch((s) => ({
          ...s,
          followUps: [
            { ...f, id: `f${Date.now()}`, at: new Date().toISOString(), by: s.user },
            ...s.followUps,
          ],
          customers: s.customers.map((c) => {
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
        })),
      addCustomer: (c) =>
        patch((s) => ({
          ...s,
          customers: [
            {
              ...c,
              id: c.id || `c${Date.now()}`,
              createdAt: c.createdAt || new Date().toISOString(),
            },
            ...s.customers,
          ],
        })),
      updateCustomer: (id, p) =>
        patch((s) => ({
          ...s,
          customers: s.customers.map((c) => (c.id === id ? { ...c, ...p } : c)),
        })),
      removeCustomer: (id) =>
        patch((s) => ({
          ...s,
          customers: s.customers.filter((c) => c.id !== id),
        })),
      deleteCustomers: (ids) =>
        patch((s) => ({
          ...s,
          customers: s.customers.filter((c) => !ids.includes(c.id)),
        })),
      clearAllCustomers: () =>
        patch((s) => ({
          ...s,
          customers: [],
        })),
      addCustomers: (list) =>
        patch((s) => ({
          ...s,
          customers: [
            ...list.map((c) => ({ ...c, createdAt: c.createdAt || new Date().toISOString() })),
            ...s.customers,
          ],
        })),
      saveTemplate: (t) =>
        patch((s) => ({
          ...s,
          templates: s.templates.some((x) => x.id === t.id)
            ? s.templates.map((x) => (x.id === t.id ? t : x))
            : [...s.templates, t],
        })),
      removeTemplate: (id) =>
        patch((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) })),
      addAccount: (a) =>
        patch((s) => ({
          ...s,
          accounts: [
            ...s.accounts,
            { ...a, id: `a${Date.now()}`, createdAt: a.createdAt || new Date().toISOString() },
          ],
        })),
      updateAccount: (id, p) =>
        patch((s) => ({
          ...s,
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...p } : a)),
        })),
      removeAccount: (id) =>
        patch((s) => ({
          ...s,
          accounts: s.accounts.filter((a) => a.id !== id),
        })),
      toggleAccount: (id) =>
        patch((s) => ({
          ...s,
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, active: !a.active } : a)),
        })),
      setSheetUrl: (sheetUrl) => patch((s) => ({ ...s, sheetUrl })),
      addNote: (n) =>
        patch((s) => ({
          ...s,
          notes: [
            {
              ...n,
              id: `n${Date.now()}`,
              by: s.user,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            ...(s.notes ?? []),
          ],
        })),
      updateNote: (id, p) =>
        patch((s) => ({
          ...s,
          notes: (s.notes ?? []).map((n) =>
            n.id === id ? { ...n, ...p, updatedAt: new Date().toISOString() } : n,
          ),
        })),
      removeNote: (id) =>
        patch((s) => ({ ...s, notes: (s.notes ?? []).filter((n) => n.id !== id) })),
    }),
    [state, patch, dbStatus, syncNow],
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
