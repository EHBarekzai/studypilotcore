import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, CreditCard, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createCheckout, getBillingOverview, getPaymentStatus } from "@/lib/billing.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/billing")({
  validateSearch: z.object({ order: z.string().optional(), cancelled: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Billing & plan — StudyPilot" },
      { name: "description", content: "Your StudyPilot plan, usage, limits and crypto payment history." },
      { property: "og:title", content: "Billing & plan — StudyPilot" },
      { property: "og:description", content: "Manage your StudyPilot subscription and usage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingPage,
});

const METRICS: { key: string; label: string }[] = [
  { key: "homework", label: "AI homework requests" },
  { key: "image_questions", label: "Image questions" },
  { key: "flashcards", label: "Flashcards" },
  { key: "quizzes", label: "Quizzes" },
  { key: "ai_plans", label: "AI study plans" },
  { key: "reschedules", label: "Reschedules" },
  { key: "pdf_exports", label: "PDF exports" },
  { key: "ai_insights", label: "AI insights" },
];

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

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function BillingPage() {
  const { order, cancelled } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const overviewFn = useServerFn(getBillingOverview);
  const checkoutFn = useServerFn(createCheckout);
  const statusFn = useServerFn(getPaymentStatus);
  const [busy, setBusy] = useState<string | null>(null);
  const inFlight = useRef(false);

  const query = useQuery({ queryKey: ["billing"], queryFn: () => overviewFn() });

  const orderQuery = useQuery({
    queryKey: ["payment-status", order],
    enabled: !!order,
    queryFn: () => statusFn({ data: { orderId: order! } }),
    refetchInterval: (q) => (["pending", "processing", "underpaid"].includes(q.state.data?.status ?? "pending") ? 8000 : false),
  });

  useEffect(() => {
    const s = orderQuery.data?.status;
    if (s === "paid" || s === "overpaid") qc.invalidateQueries({ queryKey: ["billing"] });
  }, [orderQuery.data?.status, qc]);

  async function checkout(planId: "starter" | "pro" | "ultimate") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(planId);
    try {
      const res = await checkoutFn({ data: { planId } });
      window.location.href = res.checkoutUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start checkout.");
      inFlight.current = false;
      setBusy(null);
    }
  }

  if (query.isLoading) return <AppShell><LoadingState /></AppShell>;
  if (query.error || !query.data)
    return <AppShell><ErrorState description={(query.error as Error)?.message ?? "Could not load billing."} onRetry={() => query.refetch()} /></AppShell>;

  const { subscription: sub, plans, usage, resetsAt, payments } = query.data;
  const current = plans.find((p) => p.id === sub?.plan_id);
  const limits = (current?.limits ?? {}) as Record<string, number | null>;
  const daysLeft = sub ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / 86_400_000)) : 0;

  return (
    <AppShell>
      <PageHeader title="Billing & plan" description="Your subscription, usage and payments." />

      {order && (
        <Card className="mb-4">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm">
              <div className="font-medium">Order {order}</div>
              <div className="text-muted-foreground">
                {cancelled ? "Checkout was closed. " : ""}
                Your plan activates only after the network confirms the payment.
              </div>
            </div>
            <div className="flex items-center gap-2">
              {orderQuery.isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              {orderQuery.data && <PaymentBadge status={orderQuery.data.status} />}
              <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/billing", search: {} })}>Dismiss</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Current plan</div>
            <div className="mt-1 text-xl font-semibold">{current?.name ?? "No plan"}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Status</div>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={sub?.active ? "default" : "destructive"} className="capitalize">{sub?.status ?? "none"}</Badge>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">{sub?.active ? "Renews / ends" : "Ended"}</div>
            <div className="mt-1 font-medium">
              {sub ? new Date(sub.current_period_end).toLocaleDateString() : "—"}
              {sub?.active && <span className="text-sm text-muted-foreground"> · {daysLeft} days left</span>}
            </div>
          </div>
          {!sub?.active && (
            <p className="text-sm text-destructive sm:col-span-3">
              Your trial or plan has ended. Choose a plan below to keep using AI tools and adding new items.
            </p>
          )}
        </CardContent>
      </Card>

      {sub?.active && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">This month's usage</CardTitle>
            <p className="text-sm text-muted-foreground">Resets {new Date(resetsAt).toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {METRICS.map((m) => {
              const used = usage[m.key] ?? 0;
              const limit = limits[m.key];
              const unlimited = limit === null || limit === undefined;
              return (
                <div key={m.key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{m.label}</span>
                    <span className="text-muted-foreground">
                      {used} / {unlimited ? "∞" : limit} {!unlimited && `· ${Math.max(0, limit - used)} left`}
                    </span>
                  </div>
                  <Progress value={unlimited ? 0 : Math.min(100, (used / Math.max(1, limit)) * 100)} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <h2 className="mb-3 text-lg font-semibold">Plans</h2>
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {plans.filter((p) => p.purchasable).map((p) => {
          const l = (p.limits ?? {}) as Record<string, number | string | boolean | null>;
          const isCurrent = sub?.active && sub.plan_id === p.id && sub.status !== "trial";
          const fmt = (v: unknown) => (v === null || v === undefined ? "Unlimited" : String(v));
          return (
            <Card key={p.id} className={cn(isCurrent && "border-primary")}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {p.name}
                  {isCurrent && <Badge>Current</Badge>}
                </CardTitle>
                <div className="text-2xl font-bold">{money(p.price_cents)}<span className="text-sm font-normal text-muted-foreground">/month</span></div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1 text-sm">
                  {[
                    `${fmt(l["homework"])} AI homework requests`,
                    `${fmt(l["image_questions"])} image questions`,
                    `${fmt(l["pdfs"])} PDFs · ${fmt(l["file_mb"])}MB/file`,
                    `${fmt(l["flashcards"])} flashcards`,
                    `${fmt(l["quizzes"])} quizzes · ${fmt(l["quiz_questions"])} questions each`,
                    `${fmt(l["ai_plans"])} AI plans · ${fmt(l["reschedules"])} reschedules`,
                    `${fmt(l["tasks"])} tasks · ${fmt(l["subjects"])} subjects · ${fmt(l["exams"])} exams`,
                    `${fmt(l["pdf_exports"])} PDF exports · ${fmt(l["ai_insights"])} AI insights`,
                    `${l["history_days"] ? `${l["history_days"]}-day` : "Unlimited"} history · ${l["analytics"]} analytics`,
                  ].map((t) => (
                    <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{t}</li>
                  ))}
                </ul>
                <Button className="w-full gap-2" disabled={!!busy} onClick={() => checkout(p.id as "starter" | "pro" | "ultimate")}>
                  {busy === p.id ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                  {isCurrent ? "Renew with crypto" : "Pay with crypto"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-3 text-lg font-semibold">Payment history</h2>
      <Card>
        <CardContent className="divide-y p-0">
          {payments.length === 0 && <p className="p-4 text-sm text-muted-foreground">No payments yet.</p>}
          {payments.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <div>
                <div className="font-medium capitalize">{p.plan_id} · ${Number(p.fiat_amount).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">
                  {p.order_id} · {new Date(p.created_at).toLocaleString()}
                  {p.coin && ` · ${p.coin}${p.chain ? ` on ${p.chain}` : ""}`}
                </div>
                {p.tx_hash && <div className="max-w-xs truncate font-mono text-xs text-muted-foreground">{p.tx_hash}</div>}
              </div>
              <div className="flex items-center gap-2">
                <PaymentBadge status={p.status} />
                {p.status === "pending" && p.checkout_url && (
                  <Button size="sm" variant="outline" asChild><a href={p.checkout_url}>Continue</a></Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
