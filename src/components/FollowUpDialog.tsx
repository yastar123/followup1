import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useStore, type Customer, type FollowUp } from "@/lib/store";

type Step = "connect" | "result";

const resultOptions: FollowUp["interest"][] = [
  "Belum minat",
  "Pikir-pikir / diskusi",
  "Kirim simulasi",
  "Langsung dimatikan",
];

export function FollowUpDialog({
  customer,
  channel = "Telepon",
  open,
  onOpenChange,
}: {
  customer: Customer | null;
  channel?: FollowUp["channel"];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { addFollowUp } = useStore();
  const [step, setStep] = useState<Step>("connect");
  const [result, setResult] = useState<FollowUp["interest"] | null>(null);
  const [prospect, setProspect] = useState("");

  useEffect(() => {
    if (open) {
      setStep("connect");
      setResult(null);
      setProspect("");
    }
  }, [open, customer?.id]);

  if (!customer) return null;

  const isChat = channel === "WhatsApp" || channel === "WhatsApp Business";
  const connectedOutcome: FollowUp["outcome"] = isChat ? "Chat dibalas" : "Telepon dijawab";
  const notConnectedOutcome: FollowUp["outcome"] = isChat
    ? "Chat tidak dibalas"
    : "Telepon tidak dijawab";
  const title = `Hasil follow up (${channel})`;

  const close = () => onOpenChange(false);

  const saveNotConnected = (customReason?: string) => {
    addFollowUp({
      customerId: customer.id,
      channel,
      outcome: notConnectedOutcome,
      interest: "Masih Pertimbangan",
      reason: customReason || (isChat ? "Tidak ada nomor WA" : "-"),
      nextAction: "-",
    });
    toast.info(
      isChat
        ? "Hasil WhatsApp tercatat: Tidak ada nomor WA"
        : "Hasil telepon tercatat: tidak terhubung",
    );
    close();
  };

  const saveResult = () => {
    if (!result) return;
    addFollowUp({
      customerId: customer.id,
      channel,
      outcome: connectedOutcome,
      interest: result,
      reason: prospect.trim() || "-",
      nextAction: "-",
    });
    toast.success(`Hasil ${isChat ? "chat" : "telepon"} tercatat`);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription>
            {customer.name} · {customer.phone}
          </DialogDescription>
        </DialogHeader>

        {step === "connect" ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>{isChat ? "Status pengiriman pesan:" : "Apakah terhubung?"}</Label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Button onClick={() => setStep("result")}>
                  {isChat ? "Terkirim" : "Terhubung"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => saveNotConnected(isChat ? "Tidak ada nomor WA" : undefined)}
                >
                  {isChat ? "Tidak ada nomor wa" : "Tidak terhubung"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Pilih hasil percakapan</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {resultOptions.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setResult(o)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-xs transition-colors",
                      result === o
                        ? o === "Belum minat" || o === "Langsung dimatikan"
                          ? "border-destructive bg-destructive/10 font-medium text-destructive"
                          : "border-primary bg-accent font-medium text-accent-foreground"
                        : "border-border text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prospek">Prospek</Label>
              <Input
                id="prospek"
                value={prospect}
                onChange={(e) => setProspect(e.target.value)}
                placeholder="Contoh: minta simulasi DP 25%, dokumen menyusul"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "connect" ? (
            <Button variant="ghost" onClick={close}>
              Nanti saja
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep("connect")}>
                Kembali
              </Button>
              <Button onClick={saveResult} disabled={!result}>
                Simpan
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
