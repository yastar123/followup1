import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, Copy, Eye, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStore, renderTemplate, TEMPLATE_VARS, type Customer } from "@/lib/store";

export const Route = createFileRoute("/admin/pesan")({
  head: () => ({
    meta: [
      { title: "Template Pesan Broadcast — ACC One" },
      {
        name: "description",
        content:
          "Panduan dan contoh membuat template pesan broadcast dengan variabel yang sesuai data Excel di menu Database.",
      },
      { property: "og:title", content: "Template Pesan Broadcast — ACC One" },
      { property: "og:description", content: "Atur template pesan broadcast untuk tim sales." },
    ],
  }),
  component: PesanPage,
});

const CONTOH: { name: string; body: string; kapan: string }[] = [
  {
    name: "Perkenalan Awal",
    kapan: "Kontak pertama ke customer baru hasil impor Excel.",
    body:
      "Selamat pagi Bapak/Ibu {{nama}}, perkenalkan saya {{sales}} dari ACC (Astra Credit Companies) cabang {{cabang}}.\n" +
      "Kami mencatat unit {{unit}} dengan nomor kontrak {{no_kontrak}} atas nama Anda.\n" +
      "Boleh saya bantu informasikan program terbaru kami?",
  },
  {
    name: "Penawaran Pembiayaan Ulang",
    kapan: "Customer dengan kontrak berjalan / segmen tertentu.",
    body:
      "Halo {{nama}}, kontrak {{no_kontrak}} untuk unit {{unit}} berjalan sangat baik.\n" +
      "Khusus customer segmen {{segmen}}, ACC punya program dana tunai dengan proses cepat.\n" +
      "Apakah berkenan saya kirimkan simulasi angsurannya?",
  },
  {
    name: "Follow Up Ulang",
    kapan: "Customer yang statusnya belum closing.",
    body:
      "Selamat siang {{nama}}, menindaklanjuti obrolan kita sebelumnya (status: {{status}}) mengenai {{grup_produk}}.\n" +
      "Apakah ada informasi tambahan yang Bapak/Ibu butuhkan? Saya {{sales}} siap membantu.",
  },
];

const contohCustomer: Customer = {
  id: "preview",
  name: "Budi Santoso",
  phone: "6281234567890",
  city: "JAKARTA",
  company: "MOBIL BEKAS",
  product: "TOYOTA 2019",
  unit: "TOYOTA 2019",
  segment: "RETAIL",
  contractNumber: "1234567890",
  region: "JAKARTA",
  value: 0,
  source: "Excel · OPEN",
  status: "Baru",
  owner: "Sales ACC",
  note: "",
  createdAt: new Date(0).toISOString(),
};

function PesanPage() {
  const { templates, saveTemplate, removeTemplate } = useStore();
  const [name, setName] = useState("");
  const [body, setBody] = useState("Selamat pagi Bapak/Ibu {{nama}}, ");

  const preview = useMemo(() => renderTemplate(body, contohCustomer, "Sales ACC"), [body]);

  const unknownVars = useMemo(() => {
    const known = new Set(TEMPLATE_VARS.map((v) => v.key));
    const found = [...body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]!);
    return [...new Set(found.filter((f) => !known.has(f as never)))];
  }, [body]);

  const insertVar = (key: string) => setBody((b) => `${b}{{${key}}}`);

  const add = () => {
    if (!name.trim() || !body.trim()) {
      toast.error("Nama dan isi pesan wajib diisi.");
      return;
    }
    if (unknownVars.length) {
      toast.error(`Variabel tidak dikenal: ${unknownVars.map((v) => `{{${v}}}`).join(", ")}`);
      return;
    }
    saveTemplate({ id: `t${Date.now()}`, name: name.trim(), body: body.trim() });
    setName("");
    setBody("Selamat pagi Bapak/Ibu {{nama}}, ");
    toast.success("Template pesan disimpan.");
  };

  return (
    <AppShell
      role="admin"
      title="Template Pesan Broadcast"
      subtitle="Buat template sekali, dipakai seluruh sales saat broadcast WhatsApp"
    >
      <div className="space-y-6">
        {/* Tutorial */}
        <section className="surface-card p-5">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <h2 className="text-base font-medium text-foreground">Cara membuat template</h2>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
                <li>Tulis nama template yang jelas, contoh: “Perkenalan Awal”.</li>
                <li>
                  Tulis isi pesan seperti chat WhatsApp biasa, lalu sisipkan variabel dengan format{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-foreground">{"{{nama}}"}</code>
                  . Klik tombol variabel di bawah agar tidak salah ketik.
                </li>
                <li>
                  Variabel otomatis diganti data asli tiap customer dari file Excel yang diimpor di
                  menu <strong className="text-foreground">Database</strong>.
                </li>
                <li>
                  Cek hasilnya di kotak Pratinjau, lalu simpan. Sales tinggal pilih template saat
                  broadcast.
                </li>
              </ol>
              <p className="mt-3 text-sm text-muted-foreground">
                Tips: hindari huruf kapital semua, sertakan nama sales dan asal perusahaan (ACC) di
                kalimat pertama, dan akhiri dengan satu pertanyaan agar customer membalas.
              </p>
            </div>
          </div>
        </section>

        {/* Daftar variabel */}
        <section className="surface-card p-5">
          <h2 className="text-base font-medium text-foreground">Variabel yang tersedia</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya variabel di bawah ini yang dikenali sistem — semuanya diambil dari kolom file
            Excel di menu Database.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Variabel</th>
                  <th className="py-2 pr-4">Arti</th>
                  <th className="py-2 pr-4">Kolom Excel</th>
                  <th className="py-2 pr-4">Contoh isi</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {TEMPLATE_VARS.map((v) => (
                  <tr key={v.key} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs text-foreground">{`{{${v.key}}}`}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{v.label}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                      {v.column}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{v.example}</td>
                    <td className="py-2 text-right">
                      <Button variant="ghost" size="sm" onClick={() => insertVar(v.key)}>
                        Sisipkan
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Editor */}
          <section className="surface-card h-fit p-5 lg:col-span-2">
            <h2 className="text-base font-medium text-foreground">Buat template baru</h2>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tname">Nama template</Label>
                <Input
                  id="tname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Perkenalan Awal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tbody">Isi pesan</Label>
                <Textarea
                  id="tbody"
                  rows={7}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
              {unknownVars.length > 0 && (
                <p className="text-sm text-destructive">
                  Variabel {unknownVars.map((v) => `{{${v}}}`).join(", ")} tidak ada di database dan
                  tidak akan terisi.
                </p>
              )}
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Eye className="size-3.5" /> Pratinjau (data contoh)
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{preview}</p>
              </div>
              <Button onClick={add} className="gap-1.5">
                <Plus className="size-4" /> Simpan template
              </Button>
            </div>
          </section>

          {/* Contoh + daftar template */}
          <section className="space-y-4 lg:col-span-3">
            <div className="surface-card p-5">
              <h2 className="text-base font-medium text-foreground">Contoh template siap pakai</h2>
              <div className="mt-4 space-y-4">
                {CONTOH.map((c) => (
                  <div key={c.name} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.kapan}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          setName(c.name);
                          setBody(c.body);
                          toast.success("Contoh dimuat ke editor.");
                        }}
                      >
                        <Copy className="size-3.5" /> Pakai
                      </Button>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                      {c.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <h2 className="px-1 text-base font-medium text-foreground">Template aktif</h2>
            {templates.map((t) => (
              <div key={t.id} className="surface-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <Input
                    value={t.name}
                    onChange={(e) => saveTemplate({ ...t, name: e.target.value })}
                    className="max-w-xs border-transparent bg-transparent px-0 font-display text-xl shadow-none focus-visible:border-input focus-visible:px-3"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      removeTemplate(t.id);
                      toast.success("Template dihapus.");
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <Textarea
                  rows={4}
                  value={t.body}
                  onChange={(e) => saveTemplate({ ...t, body: e.target.value })}
                  className="mt-3"
                />
                <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                  Pratinjau: {renderTemplate(t.body, contohCustomer, "Sales ACC")}
                </p>
              </div>
            ))}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
