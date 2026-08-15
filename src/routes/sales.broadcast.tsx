import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/sales/broadcast")({
  head: () => ({
    meta: [
      { title: "Pesan Broadcast — ACC One" },
      {
        name: "description",
        content:
          "Pilih template pesan buatan admin dan kirim ke customer satu per satu lewat WhatsApp.",
      },
      { property: "og:title", content: "Pesan Broadcast — ACC One" },
      {
        property: "og:description",
        content: "Kirim template pesan admin ke customer via WhatsApp.",
      },
    ],
  }),
  component: BroadcastPage,
});

function BroadcastPage() {
  const { templates } = useStore();

  return (
    <AppShell
      role="sales"
      title="Pesan Broadcast"
      subtitle="Template hanya bisa diubah admin — sales tinggal memilih dan mengirim."
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="surface-card h-fit p-5 lg:col-span-2">
          <h2 className="text-base font-medium text-foreground">Template tersedia</h2>
          <div className="mt-4 space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="w-full rounded-lg border border-border px-4 py-3 text-left text-sm text-muted-foreground"
              >
                <span className="font-medium">{t.name}</span>
                <span className="mt-1 line-clamp-2 block text-xs opacity-80">{t.body}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
