import { useEffect, useState } from "react";
import { useStore, type FollowUp } from "@/lib/store";
import { FollowUpDialog } from "@/components/FollowUpDialog";

const PENDING_KEY = "acc-pending-customer";

type Pending = { id: string; channel: FollowUp["channel"] };

export function markPendingFollowUp(customerId: string, channel: FollowUp["channel"] = "WhatsApp") {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ id: customerId, channel }));
  } catch {
    /* ignore */
  }
}

function readPending(): Pending | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === "string") {
      return {
        id: parsed.id,
        channel: parsed.channel === "Telepon" ? "Telepon" : "WhatsApp",
      };
    }
    if (raw && raw !== "null") return { id: raw, channel: "WhatsApp" };
  } catch {
    /* ignore */
  }
  return null;
}

export function PendingFollowUpWatcher() {
  const { customers } = useStore();
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      setPending(readPending());
    };
    const t = setTimeout(check, 600);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  const customer = customers.find((c) => c.id === pending?.id) ?? null;

  return (
    <FollowUpDialog
      customer={customer}
      channel={pending?.channel ?? "WhatsApp"}
      open={Boolean(customer)}
      onOpenChange={(v) => {
        if (!v) {
          localStorage.removeItem(PENDING_KEY);
          setPending(null);
        }
      }}
    />
  );
}
