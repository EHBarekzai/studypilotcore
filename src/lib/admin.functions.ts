import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OWNER_EMAIL = "erfanhussainbarekzai@gmail.com";

/** Server-side admin gate: owner email AND super_admin role, verified per request. */
const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const email = String((context.claims as { email?: string }).email ?? "").toLowerCase();
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (email !== OWNER_EMAIL || !isSuper) {
      const { audit } = await import("./payments.server");
      await audit({ category: "security", action: "admin.access_denied", actor_id: context.userId, actor_email: email });
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return next({ context: { admin: supabaseAdmin, adminEmail: email } });
  });

async function log(
  ctx: { userId: string; adminEmail: string },
  action: string,
  extra: { target_user_id?: string | null; reason?: string | null; details?: Record<string, unknown>; category?: "admin" | "subscription" | "security" } = {},
) {
  const { audit } = await import("./payments.server");
  await audit({ category: extra.category ?? "admin", action, actor_id: ctx.userId, actor_email: ctx.adminEmail, ...extra });
}

async function emailMap(admin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"]) {
  const map = new Map<string, { email: string; last_sign_in_at: string | null; created_at: string; banned: boolean }>();
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    for (const u of data?.users ?? []) {
      map.set(u.id, {
        email: u.email ?? "",
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at,
        banned: !!(u as { banned_until?: string }).banned_until && new Date((u as { banned_until?: string }).banned_until!).getTime() > Date.now(),
      });
    }
    if ((data?.users?.length ?? 0) < 1000) break;
  }
  return map;
}

export const adminCheck = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => ({ ok: true }));

/* -------------------------------- overview -------------------------------- */

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { admin } = context;
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const [users, subs, payments, ai, files, recentAi, recentFiles] = await Promise.all([
      emailMap(admin),
      admin.from("subscriptions").select("plan_id, status, current_period_end"),
      admin.from("payments").select("status, fiat_amount, created_at, paid_at").gte("created_at", since),
      admin.from("ai_activity").select("kind, created_at").gte("created_at", since),
      admin.from("study_files").select("size_bytes, mime_type, created_at"),
      admin.from("ai_activity").select("id, user_id, kind, topic, score, total, created_at").order("created_at", { ascending: false }).limit(50),
      admin.from("study_files").select("id, user_id, name, mime_type, size_bytes, created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    const now = Date.now();
    const s = subs.data ?? [];
    const live = (x: { current_period_end: string }) => new Date(x.current_period_end).getTime() > now;
    const paid = (payments.data ?? []).filter((p) => p.status === "paid" || p.status === "overpaid");
    const weekAgo = now - 7 * 86_400_000;
    const userList = [...users.values()];

    const days: { date: string; signups: number; revenue: number; ai: number; uploads: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      days.push({ date: new Date(now - i * 86_400_000).toISOString().slice(0, 10), signups: 0, revenue: 0, ai: 0, uploads: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.date, i]));
    const bump = (iso: string | null, key: "signups" | "revenue" | "ai" | "uploads", by = 1) => {
      const i = iso ? idx.get(iso.slice(0, 10)) : undefined;
      if (i !== undefined) days[i]![key] += by;
    };
    userList.forEach((u) => bump(u.created_at, "signups"));
    paid.forEach((p) => bump(p.paid_at ?? p.created_at, "revenue", Number(p.fiat_amount)));
    (ai.data ?? []).forEach((a) => bump(a.created_at, "ai"));
    (files.data ?? []).forEach((f) => bump(f.created_at, "uploads"));

    const emailOf = (id: string) => users.get(id)?.email ?? id.slice(0, 8);
    const aiByKind: Record<string, number> = {};
    (ai.data ?? []).forEach((a) => (aiByKind[a.kind] = (aiByKind[a.kind] ?? 0) + 1));

    return {
      stats: {
        users: userList.length,
        activeUsers: userList.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > weekAgo).length,
        trials: s.filter((x) => x.status === "trial" && live(x)).length,
        paidSubscribers: s.filter((x) => ["active", "manual"].includes(x.status) && live(x)).length,
        expired: s.filter((x) => !live(x) || x.status === "expired").length,
        payments: (payments.data ?? []).length,
        paidPayments: paid.length,
        revenue: paid.reduce((sum, p) => sum + Number(p.fiat_amount), 0),
        aiRequests: (ai.data ?? []).length,
        uploads: (files.data ?? []).length,
        storageBytes: (files.data ?? []).reduce((sum, f) => sum + Number(f.size_bytes), 0),
      },
      aiByKind,
      series: days,
      recentAi: (recentAi.data ?? []).map((r) => ({ ...r, email: emailOf(r.user_id) })),
      recentFiles: (recentFiles.data ?? []).map((r) => ({ ...r, email: emailOf(r.user_id) })),
    };
  });

/* ---------------------------------- users --------------------------------- */

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((i: unknown) => z.object({ search: z.string().max(200).default(""), filter: z.string().max(30).default("all") }).parse(i))
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const [users, profiles, subs] = await Promise.all([
      emailMap(admin),
      admin.from("profiles").select("id, full_name, account_status, education_level, created_at"),
      admin.from("subscriptions").select("user_id, plan_id, status, current_period_end"),
    ]);
    const subBy = new Map((subs.data ?? []).map((s) => [s.user_id, s]));
    const now = Date.now();
    const q = data.search.trim().toLowerCase();
    return (profiles.data ?? [])
      .map((p) => {
        const sub = subBy.get(p.id);
        const live = sub && new Date(sub.current_period_end).getTime() > now;
        const u = users.get(p.id);
        return {
          id: p.id,
          name: p.full_name,
          email: u?.email ?? "",
          lastSignIn: u?.last_sign_in_at ?? null,
          createdAt: u?.created_at ?? p.created_at,
          accountStatus: p.account_status,
          plan: sub?.plan_id ?? null,
          subStatus: sub ? (live ? sub.status : "expired") : "none",
          periodEnd: sub?.current_period_end ?? null,
        };
      })
      .filter((u) => !q || u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q) || u.id.startsWith(q))
      .filter((u) => {
        if (data.filter === "all") return true;
        if (data.filter === "suspended") return u.accountStatus !== "active";
        return u.subStatus === data.filter;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

export const adminUserDetail = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const id = data.userId;
    const count = (t: "tasks" | "exams" | "subjects" | "study_files" | "study_sessions") =>
      admin.from(t).select("id", { count: "exact", head: true }).eq("user_id", id);
    const [user, profile, sub, payments, ai, files, usage, tasks, exams, subjects, sessions] = await Promise.all([
      admin.auth.admin.getUserById(id),
      admin.from("profiles").select("*").eq("id", id).maybeSingle(),
      admin.from("subscriptions").select("*").eq("user_id", id).maybeSingle(),
      admin.from("payments").select("*").eq("user_id", id).order("created_at", { ascending: false }),
      admin.from("ai_activity").select("kind, topic, score, total, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(30),
      admin.from("study_files").select("name, mime_type, size_bytes, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(30),
      admin.from("usage_counters").select("metric, period_start, count").eq("user_id", id).order("period_start", { ascending: false }).limit(40),
      count("tasks"),
      count("exams"),
      count("subjects"),
      count("study_sessions"),
    ]);
    return {
      email: user.data.user?.email ?? "",
      lastSignIn: user.data.user?.last_sign_in_at ?? null,
      profile: profile.data,
      subscription: sub.data,
      payments: payments.data ?? [],
      ai: ai.data ?? [],
      files: files.data ?? [],
      usage: usage.data ?? [],
      counts: { tasks: tasks.count ?? 0, exams: exams.count ?? 0, subjects: subjects.count ?? 0, sessions: sessions.count ?? 0 },
    };
  });

export const adminSetAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((i: unknown) =>
    z.object({ userId: z.string().uuid(), status: z.enum(["active", "suspended"]), reason: z.string().trim().min(3).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("You cannot suspend the owner account.");
    const { admin } = context;
    const { error } = await admin.from("profiles").update({ account_status: data.status }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await admin.auth.admin.updateUserById(data.userId, { ban_duration: data.status === "suspended" ? "876000h" : "none" });
    await log(context, `user.${data.status === "active" ? "activated" : "suspended"}`, { target_user_id: data.userId, reason: data.reason });
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), reason: z.string().trim().min(3).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("You cannot delete the owner account.");
    const { data: u } = await context.admin.auth.admin.getUserById(data.userId);
    const { error } = await context.admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await log(context, "user.deleted", { target_user_id: data.userId, reason: data.reason, details: { email: u.user?.email } });
    return { ok: true };
  });

/* ------------------------------ subscriptions ----------------------------- */

export const adminChangeSubscription = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((i: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        action: z.enum(["activate", "deactivate", "extend", "shorten", "change_plan"]),
        planId: z.enum(["trial", "starter", "pro", "ultimate"]).optional(),
        days: z.number().int().min(1).max(3650).optional(),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { admin } = context;
    const { data: before } = await admin.from("subscriptions").select("*").eq("user_id", data.userId).maybeSingle();
    const now = Date.now();
    const end = before ? new Date(before.current_period_end).getTime() : now;
    const day = 86_400_000;
    let patch: Record<string, unknown> = {};
    switch (data.action) {
      case "activate":
        patch = {
          plan_id: data.planId ?? before?.plan_id ?? "starter",
          status: "manual",
          started_at: new Date(now).toISOString(),
          current_period_end: new Date(now + (data.days ?? 30) * day).toISOString(),
          cancelled_at: null,
        };
        break;
      case "deactivate":
        patch = { status: "cancelled", current_period_end: new Date(now).toISOString(), cancelled_at: new Date(now).toISOString() };
        break;
      case "extend":
        patch = { current_period_end: new Date(Math.max(end, now) + (data.days ?? 30) * day).toISOString() };
        if (before && new Date(before.current_period_end).getTime() <= now) patch["status"] = "manual";
        break;
      case "shorten":
        patch = { current_period_end: new Date(Math.max(now, end - (data.days ?? 1) * day)).toISOString() };
        break;
      case "change_plan":
        if (!data.planId) throw new Error("Choose a plan.");
        patch = { plan_id: data.planId };
        break;
    }
    // Manual changes only touch the subscription row — payments are never marked paid here.
    const { error } = await admin
      .from("subscriptions")
      .upsert({ user_id: data.userId, plan_id: "starter", current_period_end: new Date(now).toISOString(), ...(before ?? {}), ...patch } as never, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    await log(context, `subscription.manual_${data.action}`, {
      category: "subscription",
      target_user_id: data.userId,
      reason: data.reason,
      details: { before: before ? { plan: before.plan_id, status: before.status, end: before.current_period_end } : null, patch },
    });
    return { ok: true };
  });

/* --------------------------------- payments -------------------------------- */

export const adminListPayments = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((i: unknown) => z.object({ search: z.string().max(200).default(""), status: z.string().max(30).default("all") }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.admin.from("payments").select("*").order("created_at", { ascending: false }).limit(300);
    if (data.status !== "all") q = q.eq("status", data.status);
    const s = data.search.trim().replace(/[,()]/g, "");
    if (s) q = q.or(`order_id.ilike.%${s}%,user_email.ilike.%${s}%,tx_hash.ilike.%${s}%,provider_payment_id.ilike.%${s}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminPaymentEvents = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((i: unknown) => z.object({ paymentId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.admin.from("payment_events").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.paymentId) q = q.eq("payment_id", data.paymentId);
    return (await q).data ?? [];
  });

export const adminResyncPayment = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((i: unknown) => z.object({ paymentId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { syncPayment } = await import("./payments.server");
    const row = await syncPayment(data.paymentId);
    await log(context, "payment.resynced", { details: { payment_id: data.paymentId, status: row?.status } });
    return { status: row?.status };
  });

/* ------------------------------ plans & limits ----------------------------- */

export const adminUpdatePlan = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.enum(["trial", "starter", "pro", "ultimate"]),
        price_cents: z.number().int().min(0).max(100000),
        limits: z.record(z.string(), z.union([z.number().int().min(0), z.null(), z.string().max(20), z.boolean()])),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.id !== "trial" && data.price_cents < 1) throw new Error("Paid plans need a price.");
    const { error } = await context.admin
      .from("plans")
      .update({ price_cents: data.id === "trial" ? 0 : data.price_cents, limits: data.limits as never })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await log(context, "plan.updated", { details: data });
    return { ok: true };
  });

/* ---------------------------- logs & notifications ------------------------- */

export const adminAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((i: unknown) => z.object({ search: z.string().max(200).default(""), category: z.string().max(30).default("all") }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.admin.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
    if (data.category !== "all") q = q.eq("category", data.category);
    const s = data.search.trim().replace(/[,()]/g, "");
    if (s) q = q.or(`action.ilike.%${s}%,reason.ilike.%${s}%,actor_email.ilike.%${s}%`);
    return (await q).data ?? [];
  });

export const adminNotifications = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => (await context.admin.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)).data ?? []);

export const adminSaveNotification = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((i: unknown) =>
    z
      .object({ id: z.string().uuid().optional(), title: z.string().trim().min(1).max(120).optional(), body: z.string().max(1000).optional(), active: z.boolean().optional() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      await context.admin.from("notifications").update({ active: data.active ?? false }).eq("id", data.id);
    } else {
      if (!data.title) throw new Error("Add a title.");
      await context.admin.from("notifications").insert({ title: data.title, body: data.body ?? "", created_by: context.userId });
    }
    await log(context, data.id ? "notification.toggled" : "notification.created", { details: data });
    return { ok: true };
  });

/* --------------------------------- settings -------------------------------- */

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { data } = await context.admin.from("app_settings").select("key, value");
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, Record<string, unknown>>;
    return {
      payments: map["payments"] ?? {},
      system: map["system"] ?? {},
      configured: {
        testKey: !!process.env["NOHOLDPAY_TEST_API_KEY"],
        liveKey: !!process.env["NOHOLDPAY_LIVE_API_KEY"],
        testWebhook: !!process.env["NOHOLDPAY_TEST_WEBHOOK_SECRET"],
        liveWebhook: !!process.env["NOHOLDPAY_LIVE_WEBHOOK_SECRET"],
      },
      ownerEmail: OWNER_EMAIL,
    };
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((i: unknown) =>
    z
      .object({
        payments: z
          .object({
            mode: z.enum(["test", "live"]),
            accepted_coins: z.array(z.string().trim().max(20)).max(30),
            accepted_chains: z.array(z.string().trim().max(30)).max(30),
            restrict_to_accepted: z.boolean(),
          })
          .optional(),
        system: z.object({ maintenance_message: z.string().max(300) }).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    for (const key of ["payments", "system"] as const) {
      if (data[key]) await context.admin.from("app_settings").upsert({ key, value: data[key] as never, updated_at: new Date().toISOString() });
    }
    await log(context, "settings.updated", { details: data });
    return { ok: true };
  });
