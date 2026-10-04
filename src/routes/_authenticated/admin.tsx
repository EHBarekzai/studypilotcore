import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader, StatCard } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  adminAuditLogs,
  adminChangeSubscription,
  adminCheck,
  adminDeleteUser,
  adminGetSettings,
  adminListPayments,
  adminListUsers,
  adminNotifications,
  adminOverview,
  adminPaymentEvents,
  adminResyncPayment,
  adminSaveNotification,
  adminSaveSettings,
  adminSetAccountStatus,
  adminUpdatePlan,
  adminUserDetail,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { PaymentBadge } from "@/components/payment-badge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — StudyPilot" },
      { name: "description", content: "StudyPilot owner administration panel." },
      { property: "og:title", content: "Admin — StudyPilot" },
      { property: "og:description", content: "StudyPilot owner administration panel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

function AdminPage() {
  const check = useServerFn(adminCheck);
  const q = useQuery({ queryKey: ["admin", "check"], queryFn: () => check(), retry: false });
  if (q.isLoading) return <AppShell><LoadingState /></AppShell>;
  if (q.error) return <AppShell><ErrorState title="Admins only" description="This area is restricted to the StudyPilot owner." /></AppShell>;
  return (
    <AppShell>
      <PageHeader title="Admin panel" description="Owner-only controls for StudyPilot." />
      <Tabs defaultValue="dashboard" className="mt-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {["dashboard", "users", "payments", "activity", "plans", "notifications", "audit", "settings"].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t === "audit" ? "Security & audit" : t}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="dashboard"><Dashboard /></TabsContent>
        <TabsContent value="users"><Users /></TabsContent>
        <TabsContent value="payments"><Payments /></TabsContent>
        <TabsContent value="activity"><Activity /></TabsContent>
        <TabsContent value="plans"><Plans /></TabsContent>
        <TabsContent value="notifications"><Notifications /></TabsContent>
        <TabsContent value="audit"><Audit /></TabsContent>
        <TabsContent value="settings"><Settings /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

function useOverview() {
  const fn = useServerFn(adminOverview);
  return useQuery({ queryKey: ["admin", "overview"], queryFn: () => fn() });
}

/* -------------------------------- dashboard ------------------------------- */

function Dashboard() {
  const q = useOverview();
  const [range, setRange] = useState<"daily" | "weekly" | "monthly">("daily");
  const chart = useMemo(() => {
    const s = q.data?.series ?? [];
    if (range === "daily") return s.slice(-14).map((d) => ({ ...d, label: d.date.slice(5) }));
    const size = range === "weekly" ? 7 : 30;
    const out: { label: string; signups: number; revenue: number; ai: number; uploads: number }[] = [];
    for (let i = s.length; i > 0; i -= size) {
      const chunk = s.slice(Math.max(0, i - size), i);
      out.unshift({
        label: chunk[0]?.date.slice(5) ?? "",
        signups: chunk.reduce((a, b) => a + b.signups, 0),
        revenue: chunk.reduce((a, b) => a + b.revenue, 0),
        ai: chunk.reduce((a, b) => a + b.ai, 0),
        uploads: chunk.reduce((a, b) => a + b.uploads, 0),
      });
    }
    return out;
  }, [q.data, range]);
  if (q.isLoading) return <LoadingState />;
  if (q.error || !q.data) return <ErrorState description={errMsg(q.error)} onRetry={() => q.refetch()} />;
  const s = q.data.stats;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Users" value={s.users} />
        <StatCard label="Active (7d)" value={s.activeUsers} />
        <StatCard label="On trial" value={s.trials} />
        <StatCard label="Paid subscribers" value={s.paidSubscribers} />
        <StatCard label="Expired" value={s.expired} />
        <StatCard label="Payments (90d)" value={`${s.paidPayments}/${s.payments}`} />
        <StatCard label="Revenue (90d)" value={`$${s.revenue.toFixed(2)}`} />
        <StatCard label="AI requests (90d)" value={s.aiRequests} />
        <StatCard label="Uploads" value={s.uploads} />
        <StatCard label="Storage" value={`${(s.storageBytes / 1048576).toFixed(1)} MB`} />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Analytics</CardTitle>
          <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {(["signups", "revenue", "ai", "uploads"] as const).map((k) => (
            <div key={k}>
              <div className="mb-2 text-sm font-medium capitalize">{k === "ai" ? "AI usage" : k}</div>
              <div className="h-40">
                <ResponsiveContainer>
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" fontSize={10} />
                    <YAxis fontSize={10} allowDecimals={k === "revenue"} width={32} />
                    <Tooltip />
                    <Bar dataKey={k} fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------------------------- users --------------------------------- */

function Users() {
  const fn = useServerFn(adminListUsers);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin", "users", search, filter], queryFn: () => fn({ data: { search, filter } }) });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search name, email or ID" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "trial", "active", "manual", "cancelled", "expired", "suspended"].map((f) => (
              <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {q.isLoading ? <LoadingState /> : q.error ? <ErrorState description={errMsg(q.error)} /> : (
        <Card>
          <CardContent className="divide-y p-0">
            {q.data!.length === 0 && <p className="p-4 text-sm text-muted-foreground">No users match.</p>}
            {q.data!.map((u) => (
              <button key={u.id} onClick={() => setSelected(u.id)} className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left text-sm hover:bg-muted/50">
                <div>
                  <div className="font-medium">{u.name || u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.email} · joined {new Date(u.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  {u.accountStatus !== "active" && <Badge variant="destructive">Suspended</Badge>}
                  <Badge variant="secondary" className="capitalize">{u.plan ?? "none"} · {u.subStatus}</Badge>
                  {u.periodEnd && <span className="text-xs text-muted-foreground">until {new Date(u.periodEnd).toLocaleDateString()}</span>}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
      <UserDialog userId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function UserDialog({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const detailFn = useServerFn(adminUserDetail);
  const statusFn = useServerFn(adminSetAccountStatus);
  const deleteFn = useServerFn(adminDeleteUser);
  const subFn = useServerFn(adminChangeSubscription);
  const q = useQuery({ queryKey: ["admin", "user", userId], enabled: !!userId, queryFn: () => detailFn({ data: { userId: userId! } }) });
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<"activate" | "deactivate" | "extend" | "shorten" | "change_plan">("extend");
  const [plan, setPlan] = useState<"starter" | "pro" | "ultimate" | "trial">("starter");
  const [days, setDays] = useState(30);
  useEffect(() => setReason(""), [userId]);

  const run = useMutation({
    mutationFn: async (kind: "sub" | "suspend" | "activate" | "delete") => {
      if (reason.trim().length < 3) throw new Error("Enter a reason (at least 3 characters).");
      if (kind === "sub") return subFn({ data: { userId: userId!, action, planId: plan, days, reason } });
      if (kind === "delete") {
        if (!window.confirm("Permanently delete this user and their study data?")) return;
        await deleteFn({ data: { userId: userId!, reason } });
        onClose();
        return;
      }
      return statusFn({ data: { userId: userId!, status: kind === "suspend" ? "suspended" : "active", reason } });
    },
    onSuccess: () => {
      toast.success("Saved and logged.");
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const d = q.data;
  const sub = d?.subscription;
  const daysLeft = sub ? Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / 86_400_000) : 0;
  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{d?.profile?.full_name || d?.email || "User"}</DialogTitle></DialogHeader>
        {q.isLoading || !d ? <LoadingState /> : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Email:</span> {d.email}</div>
              <div><span className="text-muted-foreground">Account:</span> {d.profile?.account_status}</div>
              <div><span className="text-muted-foreground">Last sign-in:</span> {fmtDate(d.lastSignIn)}</div>
              <div><span className="text-muted-foreground">Education:</span> {d.profile?.education_level ?? "—"}</div>
              <div><span className="text-muted-foreground">Tasks / exams:</span> {d.counts.tasks} / {d.counts.exams}</div>
              <div><span className="text-muted-foreground">Subjects / sessions:</span> {d.counts.subjects} / {d.counts.sessions}</div>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Subscription</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {sub ? (
                  <>
                    <div className="capitalize">{sub.plan_id} · {sub.status} · {daysLeft > 0 ? `${daysLeft} days left` : "expired"}</div>
                    <div className="text-muted-foreground">Started {fmtDate(sub.started_at)} · ends/renews {fmtDate(sub.current_period_end)}</div>
                    <div className="text-muted-foreground">Last payment: {d.payments.find((p) => p.id === sub.last_payment_id)?.order_id ?? "—"}</div>
                  </>
                ) : <div>No subscription.</div>}
              </CardContent>
            </Card>

            <div className="space-y-2 rounded-lg border p-3">
              <Label>Reason (required, saved to audit log)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} />
              <div className="flex flex-wrap items-end gap-2">
                <Select value={action} onValueChange={(v) => setAction(v as typeof action)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activate">Activate</SelectItem>
                    <SelectItem value="deactivate">Deactivate</SelectItem>
                    <SelectItem value="extend">Extend</SelectItem>
                    <SelectItem value="shorten">Shorten</SelectItem>
                    <SelectItem value="change_plan">Change plan</SelectItem>
                  </SelectContent>
                </Select>
                {(action === "activate" || action === "change_plan") && (
                  <Select value={plan} onValueChange={(v) => setPlan(v as typeof plan)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["trial", "starter", "pro", "ultimate"].map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {["activate", "extend", "shorten"].includes(action) && (
                  <Input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} className="w-24" aria-label="Days" />
                )}
                <Button size="sm" disabled={run.isPending} onClick={() => run.mutate("sub")}>Apply</Button>
              </div>
              <p className="text-xs text-muted-foreground">Manual changes never mark crypto payments as paid.</p>
              <div className="flex flex-wrap gap-2 pt-2">
                {d.profile?.account_status === "active" ? (
                  <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate("suspend")}>Suspend</Button>
                ) : (
                  <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate("activate")}>Reactivate</Button>
                )}
                <Button size="sm" variant="destructive" disabled={run.isPending} onClick={() => run.mutate("delete")}>Delete user</Button>
              </div>
            </div>

            <Section title="Payment history" empty={!d.payments.length}>
              {d.payments.map((p) => (
                <div key={p.id} className="flex justify-between gap-2 py-1">
                  <span>{p.order_id} · {p.plan_id} · ${Number(p.fiat_amount).toFixed(2)} {p.coin ? `· ${p.coin}` : ""}</span>
                  <PaymentBadge status={p.status} />
                </div>
              ))}
            </Section>
            <Section title="Usage" empty={!d.usage.length}>
              {d.usage.map((u) => <div key={`${u.metric}${u.period_start}`}>{u.period_start} · {u.metric}: {u.count}</div>)}
            </Section>
            <Section title="AI activity" empty={!d.ai.length}>
              {d.ai.map((a, i) => <div key={i}>{fmtDate(a.created_at)} · {a.kind} {a.topic ? `· ${a.topic}` : ""}</div>)}
            </Section>
            <Section title="Files" empty={!d.files.length}>
              {d.files.map((f, i) => <div key={i}>{f.name} · {(Number(f.size_bytes) / 1048576).toFixed(1)} MB</div>)}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 font-medium">{title}</div>
      <div className="max-h-40 overflow-y-auto text-xs text-muted-foreground">{empty ? "None" : children}</div>
    </div>
  );
}

/* --------------------------------- payments -------------------------------- */

function Payments() {
  const fn = useServerFn(adminListPayments);
  const eventsFn = useServerFn(adminPaymentEvents);
  const resync = useServerFn(adminResyncPayment);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [eventsFor, setEventsFor] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin", "payments", search, status], queryFn: () => fn({ data: { search, status } }) });
  const ev = useQuery({ queryKey: ["admin", "events", eventsFor], enabled: !!eventsFor, queryFn: () => eventsFn({ data: { paymentId: eventsFor! } }) });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Order, email, tx hash" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "pending", "processing", "paid", "overpaid", "underpaid", "expired", "cancelled", "failed", "refunded"].map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {q.isLoading ? <LoadingState /> : q.error ? <ErrorState description={errMsg(q.error)} /> : !q.data!.length ? <EmptyState title="No payments yet" /> : (
        <Card>
          <CardContent className="divide-y p-0">
            {q.data!.map((p) => (
              <div key={p.id} className="space-y-1 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{p.order_id} · <span className="capitalize">{p.plan_id}</span> · ${Number(p.fiat_amount).toFixed(2)} {p.fiat_currency}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{p.environment}</Badge>
                    <PaymentBadge status={p.status} />
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.user_email ?? "—"} · created {fmtDate(p.created_at)} · paid {fmtDate(p.paid_at)} · {p.coin ?? "—"} {p.chain ? `on ${p.chain}` : ""} {p.amount_received ? `· received ${p.amount_received}` : ""}
                </div>
                {p.tx_hash && <div className="truncate font-mono text-xs">{p.tx_hash}</div>}
                {p.provider_payment_id && <div className="truncate font-mono text-xs text-muted-foreground">NoHoldPay ID {p.provider_payment_id}</div>}
                {p.error && <div className="text-xs text-destructive">{p.error}</div>}
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEventsFor(p.id)}>Webhook events</Button>
                  {p.provider_payment_id && (
                    <Button size="sm" variant="ghost" className="gap-1" onClick={async () => {
                      try { const r = await resync({ data: { paymentId: p.id } }); toast.success(`Verified status: ${r.status}`); qc.invalidateQueries({ queryKey: ["admin", "payments"] }); }
                      catch (e) { toast.error(errMsg(e)); }
                    }}><RefreshCw className="size-3" />Verify with NoHoldPay</Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Dialog open={!!eventsFor} onOpenChange={(o) => !o && setEventsFor(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Webhook events</DialogTitle></DialogHeader>
          {ev.isLoading ? <LoadingState /> : !ev.data?.length ? <p className="text-sm text-muted-foreground">No events received.</p> : ev.data.map((e) => (
            <div key={e.id} className="rounded border p-2 text-xs">
              <div className="flex justify-between font-medium"><span>{e.event}</span><span>{fmtDate(e.created_at)}</span></div>
              <div>{e.processed ? "Processed" : "Not processed"} {e.error && <span className="text-destructive">· {e.error}</span>}</div>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all text-muted-foreground">{JSON.stringify(e.payload, null, 1)}</pre>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* --------------------------------- activity -------------------------------- */

function Activity() {
  const q = useOverview();
  if (q.isLoading) return <LoadingState />;
  if (q.error || !q.data) return <ErrorState description={errMsg(q.error)} />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-base">AI usage (90 days)</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {Object.entries(q.data.aiByKind).map(([k, v]) => <div key={k} className="flex justify-between capitalize"><span>{k}</span><span>{v}</span></div>)}
          <div className="pt-3 font-medium">Recent</div>
          <div className="max-h-80 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {q.data.recentAi.map((a) => <div key={a.id}>{fmtDate(a.created_at)} · {a.email} · {a.kind}{a.topic ? ` · ${a.topic}` : ""}</div>)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Recent files</CardTitle></CardHeader>
        <CardContent className="max-h-96 space-y-1 overflow-y-auto text-xs text-muted-foreground">
          {q.data.recentFiles.length === 0 && "No uploads yet."}
          {q.data.recentFiles.map((f) => <div key={f.id}>{fmtDate(f.created_at)} · {f.email} · {f.name} · {(Number(f.size_bytes) / 1048576).toFixed(1)} MB</div>)}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------------------------- plans ---------------------------------- */

function Plans() {
  const qc = useQueryClient();
  const save = useServerFn(adminUpdatePlan);
  const q = useQuery({ queryKey: ["admin", "plans"], queryFn: async () => (await supabase.from("plans").select("*").order("sort_order")).data ?? [] });
  const [drafts, setDrafts] = useState<Record<string, { price: string; limits: string }>>({});
  useEffect(() => {
    if (q.data) setDrafts(Object.fromEntries(q.data.map((p) => [p.id, { price: (p.price_cents / 100).toFixed(2), limits: JSON.stringify(p.limits, null, 2) }])));
  }, [q.data]);
  if (q.isLoading) return <LoadingState />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {q.data?.map((p) => (
        <Card key={p.id}>
          <CardHeader><CardTitle className="text-base">{p.name}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {p.id !== "trial" && (
              <div><Label>Monthly price (USD)</Label><Input value={drafts[p.id]?.price ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: { ...d[p.id]!, price: e.target.value } }))} /></div>
            )}
            <div>
              <Label>Limits (null = unlimited)</Label>
              <Textarea rows={10} className="font-mono text-xs" value={drafts[p.id]?.limits ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: { ...d[p.id]!, limits: e.target.value } }))} />
            </div>
            <Button size="sm" onClick={async () => {
              try {
                const dft = drafts[p.id]!;
                await save({ data: { id: p.id as "starter", price_cents: Math.round(Number(dft.price) * 100), limits: JSON.parse(dft.limits) } });
                toast.success("Plan saved");
                qc.invalidateQueries({ queryKey: ["admin", "plans"] });
              } catch (e) { toast.error(errMsg(e)); }
            }}>Save</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------ notifications ------------------------------ */

function Notifications() {
  const qc = useQueryClient();
  const list = useServerFn(adminNotifications);
  const save = useServerFn(adminSaveNotification);
  const q = useQuery({ queryKey: ["admin", "notifications"], queryFn: () => list() });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const submit = async (payload: { id?: string; title?: string; body?: string; active?: boolean }) => {
    try { await save({ data: payload }); qc.invalidateQueries({ queryKey: ["admin", "notifications"] }); toast.success("Saved"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Send announcement to all users</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Message" value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} />
          <Button size="sm" onClick={async () => { await submit({ title, body }); setTitle(""); setBody(""); }}>Publish</Button>
        </CardContent>
      </Card>
      {q.data?.map((n) => (
        <Card key={n.id}>
          <CardContent className="flex items-start justify-between gap-3 p-4 text-sm">
            <div><div className="font-medium">{n.title}</div><div className="text-muted-foreground">{n.body}</div><div className="text-xs text-muted-foreground">{fmtDate(n.created_at)}</div></div>
            <Switch checked={n.active} onCheckedChange={(v) => submit({ id: n.id, active: v })} aria-label="Visible" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ----------------------------------- audit --------------------------------- */

function Audit() {
  const fn = useServerFn(adminAuditLogs);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const q = useQuery({ queryKey: ["admin", "audit", search, category], queryFn: () => fn({ data: { search, category } }) });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search action, reason, actor" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "admin", "subscription", "payment", "security"].map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {q.isLoading ? <LoadingState /> : (
        <Card>
          <CardContent className="divide-y p-0">
            {!q.data?.length && <p className="p-4 text-sm text-muted-foreground">No entries.</p>}
            {q.data?.map((l) => (
              <div key={l.id} className="p-3 text-xs">
                <div className="flex justify-between gap-2"><span className="font-medium">{l.action}</span><span className="text-muted-foreground">{fmtDate(l.created_at)}</span></div>
                <div className="text-muted-foreground">
                  <Badge variant="outline" className="mr-1">{l.category}</Badge>
                  {l.actor_email ?? "system"}{l.target_user_id ? ` → ${l.target_user_id.slice(0, 8)}` : ""}{l.reason ? ` · "${l.reason}"` : ""}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* --------------------------------- settings -------------------------------- */

const PROD_WEBHOOK = "https://project--967f9264-bba7-4772-9106-31bf359cbc65.lovable.app/api/public/webhooks/noholdpay";

function Settings() {
  const qc = useQueryClient();
  const get = useServerFn(adminGetSettings);
  const save = useServerFn(adminSaveSettings);
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => get() });
  const [mode, setMode] = useState<"test" | "live">("test");
  const [coins, setCoins] = useState("");
  const [chains, setChains] = useState("");
  const [restrict, setRestrict] = useState(false);
  const [maintenance, setMaintenance] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => {
    if (!q.data) return;
    const p = q.data.payments as { mode?: "test" | "live"; accepted_coins?: string[]; accepted_chains?: string[]; restrict_to_accepted?: boolean };
    setMode(p.mode ?? "test");
    setCoins((p.accepted_coins ?? []).join(", "));
    setChains((p.accepted_chains ?? []).join(", "));
    setRestrict(!!p.restrict_to_accepted);
    setMaintenance(String((q.data.system as { maintenance_message?: string }).maintenance_message ?? ""));
  }, [q.data]);
  if (q.isLoading || !q.data) return <LoadingState />;
  const c = q.data.configured;
  const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const copy = (url: string) => navigator.clipboard.writeText(url).then(() => toast.success("Webhook URL copied"));
  const urls = [PROD_WEBHOOK, ...(origin && !PROD_WEBHOOK.startsWith(origin) ? [`${origin}/api/public/webhooks/noholdpay`] : [])];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4" />Admin settings</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>Owner / Super Admin: <span className="font-medium">{q.data.ownerEmail}</span></div>
          <div>
            <Label>NoHoldPay webhook URL</Label>
            {urls.map((u, i) => (
              <div key={u} className="mt-1 flex gap-2">
                <Input readOnly value={u} className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={() => copy(u)} aria-label="Copy URL"><Copy className="size-4" /></Button>
                {i === 0 && <span className="self-center text-xs text-muted-foreground">Live site</span>}
              </div>
            ))}
            <p className="mt-1 text-xs text-muted-foreground">Paste this into NoHoldPay → API Keys → Webhook settings. The live URL works once the app is published.</p>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {[["Test API key", c.testKey], ["Test webhook secret", c.testWebhook], ["Live API key", c.liveKey], ["Live webhook secret", c.liveWebhook]].map(([k, v]) => (
              <div key={String(k)}>{String(k)}: <Badge variant={v ? "default" : "outline"}>{v ? "Configured" : "Missing"}</Badge></div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Payment settings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Label>Environment</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "test" | "live")}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="test">Test</SelectItem><SelectItem value="live">Live</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Default coins (comma separated, e.g. USDT, USDC, BTC)</Label><Input value={coins} onChange={(e) => setCoins(e.target.value)} /></div>
          <div><Label>Default networks (e.g. tron, ethereum, solana)</Label><Input value={chains} onChange={(e) => setChains(e.target.value)} /></div>
          <div className="flex items-center gap-2"><Switch checked={restrict} onCheckedChange={setRestrict} /><Label>Only allow these coins/networks</Label></div>
          <Button size="sm" onClick={async () => {
            if (mode === "live" && !(c.liveKey && c.liveWebhook)) { toast.error("Add the live API key and webhook secret first."); return; }
            try { await save({ data: { payments: { mode, accepted_coins: split(coins), accepted_chains: split(chains), restrict_to_accepted: restrict } } }); toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin", "settings"] }); }
            catch (e) { toast.error(errMsg(e)); }
          }}>Save payment settings</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">System settings</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Label>Banner message shown to all users (leave empty to hide)</Label>
          <Input value={maintenance} maxLength={300} onChange={(e) => setMaintenance(e.target.value)} />
          <Button size="sm" onClick={async () => {
            try { await save({ data: { system: { maintenance_message: maintenance } } }); toast.success("Saved"); }
            catch (e) { toast.error(errMsg(e)); }
          }}>Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}
