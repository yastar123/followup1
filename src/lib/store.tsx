import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Role = "sales" | "admin";

export type Customer = {
  id: string;
  name: string;
  phone: string;
  city: string;
  company: string;
  product: string;
  unit: string;
  segment: string;
  contractNumber: string;
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

export type Account = { id: string; name: string; email: string; role: Role; active: boolean };

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
    },
  ],
  notes: [],
  sheetUrl: "",
  impersonating: false,
};

type Ctx = State & {
  dbStatus: { type: "PostgreSQL" | "File System" | "Local Cache"; connected: boolean };
  setRole: (r: Role | null, userName?: string) => void;
  impersonate: (user: string) => void;
  stopImpersonate: () => void;
  addFollowUp: (f: Omit<FollowUp, "id" | "at" | "by">) => void;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  addCustomers: (c: Customer[]) => void;
  saveTemplate: (t: Template) => void;
  removeTemplate: (id: string) => void;
  addAccount: (a: Omit<Account, "id">) => void;
  toggleAccount: (id: string) => void;
  addNote: (n: { title: string; body: string }) => void;
  updateNote: (id: string, patch: { title: string; body: string }) => void;
  removeNote: (id: string) => void;
  setSheetUrl: (u: string) => void;
};

const StoreContext = createContext<Ctx | null>(null);
const KEY = "acc-followup-state-v2";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [isLoaded, setIsLoaded] = useState(false);
  const [dbStatus, setDbStatus] = useState<{
    type: "PostgreSQL" | "File System" | "Local Cache";
    connected: boolean;
  }>({
    type: "Local Cache",
    connected: false,
  });

  useEffect(() => {
    // 1. Clear obsolete v1 demo cache & load fresh local cache
    try {
      localStorage.removeItem("acc-followup-state-v1");
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...initial, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }

    // 2. Fetch live DB connection status
    fetch("/api/db-status")
      .then((res) => res.json())
      .then((data) => setDbStatus(data))
      .catch((e) => console.warn("Failed to load db status", e));

    // 3. Sync full state from Express / PostgreSQL backend
    fetch("/api/state")
      .then((res) => {
        if (!res.ok) throw new Error("HTTP error " + res.status);
        return res.json();
      })
      .then((serverState) => {
        if (serverState && Array.isArray(serverState.accounts)) {
          setState((prev) => ({ ...prev, ...serverState }));
          setIsLoaded(true);
        } else {
          // If server database is unseeded, initialize it
          fetch("/api/state", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(initial),
          })
            .then(() => setIsLoaded(true))
            .catch((err) => {
              console.warn("Failed to seed database", err);
              setIsLoaded(true);
            });
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

  const patch = useCallback((fn: (s: State) => State) => setState((s) => fn(s)), []);

  const value = useMemo<Ctx>(
    () => ({
      ...state,
      dbStatus,
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
      updateCustomer: (id, p) =>
        patch((s) => ({
          ...s,
          customers: s.customers.map((c) => (c.id === id ? { ...c, ...p } : c)),
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
        patch((s) => ({ ...s, accounts: [...s.accounts, { ...a, id: `a${Date.now()}` }] })),
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
    [state, patch, dbStatus],
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

/** Variabel template — dipetakan dari kolom file Excel yang diimpor di menu Database. */
export const TEMPLATE_VARS = [
  { key: "nama", label: "Nama customer", column: "NAME", example: "Budi Santoso" },
  { key: "no_hp", label: "Nomor WhatsApp", column: "NO_TELP_HP", example: "6281234567890" },
  {
    key: "unit",
    label: "Unit kendaraan (merek + tahun)",
    column: "BRAND + YEAR",
    example: "TOYOTA 2019",
  },
  {
    key: "no_kontrak",
    label: "Nomor kontrak / agreement",
    column: "NO_AGGR",
    example: "1234567890",
  },
  { key: "segmen", label: "Segmen customer", column: "SEGMEN", example: "RETAIL" },
  {
    key: "grup_produk",
    label: "Grup produk / status",
    column: "GROUP_PRODUCT",
    example: "MOBIL BEKAS",
  },
  { key: "cabang", label: "Cabang / handling", column: "HANDLING", example: "JAKARTA" },
  { key: "status", label: "Status follow up saat ini", column: "-", example: "Baru" },
  { key: "sales", label: "Nama sales pengirim", column: "-", example: "Rio Saputra" },
] as const;

export function renderTemplate(body: string, c: Customer, sales: string) {
  return body
    .replaceAll("{{nama}}", c.name)
    .replaceAll("{{no_hp}}", c.phone)
    .replaceAll("{{unit}}", c.unit || c.product)
    .replaceAll("{{no_kontrak}}", c.contractNumber)
    .replaceAll("{{segmen}}", c.segment)
    .replaceAll("{{grup_produk}}", c.company)
    .replaceAll("{{cabang}}", c.city || c.region)
    .replaceAll("{{status}}", c.status)
    .replaceAll("{{sales}}", sales);
}

export const waLink = (phone: string, message: string) =>
  `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
