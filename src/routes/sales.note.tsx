import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { NotebookPen, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Pager } from "@/components/Pager";
import { isMatchSales, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const PAGE_SIZE = 10;

export const Route = createFileRoute("/sales/note")({
  head: () => ({
    meta: [
      { title: "Note Sales — ACC One" },
      {
        name: "description",
        content:
          "Catatan bebas untuk sales: ide, hasil obrolan, reminder, dan rencana follow up berikutnya.",
      },
      { property: "og:title", content: "Note Sales — ACC One" },
      { property: "og:description", content: "Catatan bebas untuk kebutuhan harian sales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotePage,
});

function NotePage() {
  const { user, notes, addNote, updateNote, removeNote } = useStore();
  const list = useMemo(() => {
    return (notes ?? []).filter((n) => !user || !n.by || isMatchSales(n.by, user));
  }, [notes, user]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const reset = () => {
    setTitle("");
    setBody("");
    setEditingId(null);
  };

  const submit = () => {
    if (!title.trim() && !body.trim()) return;
    const payload = { title: title.trim() || "Tanpa judul", body: body.trim() };
    if (editingId) updateNote(editingId, payload);
    else addNote(payload);
    reset();
  };

  return (
    <AppShell role="sales" title="Note" subtitle={`${list.length} catatan tersimpan`}>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <section className="surface-card h-fit space-y-3 p-5">
          <div className="flex items-center gap-2">
            <NotebookPen className="size-4 text-primary" />
            <h2 className="font-display text-xl text-foreground">
              {editingId ? "Ubah catatan" : "Catatan baru"}
            </h2>
          </div>
          <Input
            placeholder="Judul catatan"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Tulis catatan di sini..."
            rows={7}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={submit} className="flex-1">
              {editingId ? "Simpan perubahan" : "Simpan catatan"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={reset}>
                Batal
              </Button>
            )}
          </div>
        </section>

        <section className="space-y-4">
          {list.length === 0 && (
            <p className="surface-card p-6 text-sm text-muted-foreground">
              Belum ada catatan. Tulis catatan pertama kamu di sebelah kiri.
            </p>
          )}
          {pageItems.map((n) => (
            <article key={n.id} className="surface-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-xl text-foreground">{n.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.updatedAt).toLocaleString("id-ID", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {n.by}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Ubah catatan"
                    onClick={() => {
                      setEditingId(n.id);
                      setTitle(n.title);
                      setBody(n.body);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Hapus catatan"
                    onClick={() => {
                      removeNote(n.id);
                      if (editingId === n.id) reset();
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {n.body && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{n.body}</p>
              )}
            </article>
          ))}
          <Pager
            page={page}
            totalPages={totalPages}
            total={list.length}
            from={(page - 1) * PAGE_SIZE + 1}
            to={Math.min(page * PAGE_SIZE, list.length)}
            onPageChange={setPage}
          />
        </section>
      </div>
    </AppShell>
  );
}
