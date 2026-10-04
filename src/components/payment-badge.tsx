import { cn } from "@/lib/utils";

const STATUS_TEXT: Record<string, { label: string; tone: string }> = {
  pending: { label: "Waiting for payment", tone: "bg-muted text-muted-foreground" },
  processing: { label: "Confirming on-chain", tone: "bg-warning/15 text-warning" },
  paid: { label: "Paid", tone: "bg-success/15 text-success" },
  overpaid: { label: "Paid (overpaid)", tone: "bg-success/15 text-success" },
  underpaid: { label: "Underpaid", tone: "bg-warning/15 text-warning" },
  expired: { label: "Expired", tone: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", tone: "bg-muted text-muted-foreground" },
  failed: { label: "Failed", tone: "bg-destructive/15 text-destructive" },
  refunded: { label: "Refunded", tone: "bg-muted text-muted-foreground" },
};

export function PaymentBadge({ status }: { status: string }) {
  const s = STATUS_TEXT[status] ?? { label: status, tone: "bg-muted text-muted-foreground" };
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", s.tone)}>{s.label}</span>;
}

