import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Everything the Billing page needs; prices and limits come from the database. */
export const getBillingOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const period = new Date();
    const periodStart = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), 1));
    const resetsAt = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 1));
    const [sub, plans, usage, payments, notes] = await Promise.all([
      supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("plans").select("*").order("sort_order"),
      supabase
        .from("usage_counters")
        .select("metric, count")
        .eq("user_id", userId)
        .eq("period_start", periodStart.toISOString().slice(0, 10)),
      supabase
        .from("payments")
        .select("id, order_id, plan_id, fiat_amount, fiat_currency, coin, chain, tx_hash, status, created_at, paid_at, checkout_url")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("notifications").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(3),
    ]);
    const s = sub.data;
    const active = !!s && new Date(s.current_period_end).getTime() > Date.now() && s.status !== "expired";
    return {
      subscription: s ? { ...s, status: active ? s.status : "expired", active } : null,
      plans: plans.data ?? [],
      usage: Object.fromEntries((usage.data ?? []).map((u) => [u.metric, u.count])) as Record<string, number>,
      resetsAt: resetsAt.toISOString(),
      payments: payments.data ?? [],
      notifications: notes.data ?? [],
    };
  });

/** Creates a unique order + NoHoldPay payment and returns the hosted checkout URL. */
export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ planId: z.enum(["starter", "pro", "ultimate"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { noholdpayRequest } = await import("./billing.server");
    const { audit } = await import("./payments.server");

    const { data: profile } = await context.supabase.from("profiles").select("account_status").eq("id", context.userId).single();
    if (profile?.account_status !== "active") throw new Error("Your account is suspended.");

    const { data: plan } = await supabaseAdmin.from("plans").select("*").eq("id", data.planId).single();
    if (!plan || !plan.purchasable) throw new Error("That plan is not available.");

    const { data: setting } = await supabaseAdmin.from("app_settings").select("value").eq("key", "payments").maybeSingle();
    const cfg = (setting?.value ?? {}) as {
      mode?: "test" | "live";
      accepted_coins?: string[];
      accepted_chains?: string[];
      restrict_to_accepted?: boolean;
    };
    const mode = cfg.mode === "live" ? "live" : "test";

    // Reuse a still-open checkout for the same plan to avoid duplicate orders.
    const { data: open } = await supabaseAdmin
      .from("payments")
      .select("order_id, checkout_url, created_at")
      .eq("user_id", context.userId)
      .eq("plan_id", plan.id)
      .eq("status", "pending")
      .eq("environment", mode)
      .gte("created_at", new Date(Date.now() - 20 * 60_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (open?.checkout_url) return { checkoutUrl: open.checkout_url, orderId: open.order_id };

    const orderId = `SP-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const amount = (plan.price_cents / 100).toFixed(2);
    const email = (context.claims as { email?: string }).email ?? null;
    const { data: row, error } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: context.userId,
        user_email: email,
        order_id: orderId,
        environment: mode,
        plan_id: plan.id,
        fiat_amount: Number(amount),
        fiat_currency: plan.currency,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not start checkout. Please retry.");

    const origin = new URL(getRequest().url).origin;
    try {
      const coins = cfg.accepted_coins?.filter(Boolean) ?? [];
      const chains = cfg.accepted_chains?.filter(Boolean) ?? [];
      const remote = await noholdpayRequest<{ id: string; checkout_url: string; status: string }>(mode, "/payments", {
        method: "POST",
        body: {
          fiat_amount: amount,
          fiat_currency: plan.currency,
          order_id: orderId,
          description: `StudyPilot ${plan.name} — 1 month`,
          ...(email ? { customer_email: email } : {}),
          success_url: `${origin}/billing?order=${orderId}`,
          cancel_url: `${origin}/billing?order=${orderId}&cancelled=1`,
          ...(coins.length ? { accepted_coins: coins } : {}),
          ...(chains.length ? { accepted_chains: chains } : {}),
          ...((coins.length || chains.length) && cfg.restrict_to_accepted ? { restrict_to_accepted: true } : {}),
        },
      });
      await supabaseAdmin
        .from("payments")
        .update({ provider_payment_id: remote.id, checkout_url: remote.checkout_url })
        .eq("id", row.id);
      await audit({ category: "payment", action: "checkout.created", actor_id: context.userId, target_user_id: context.userId, details: { order_id: orderId, plan: plan.id, mode } });
      return { checkoutUrl: remote.checkout_url, orderId };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout failed";
      await supabaseAdmin.from("payments").update({ status: "failed", error: message }).eq("id", row.id);
      throw new Error(message);
    }
  });

/** Status for the return page. Re-verifies with NoHoldPay; never trusts the redirect. */
export const getPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().min(4).max(80) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("payments")
      .select("id, status, plan_id")
      .eq("order_id", data.orderId)
      .maybeSingle();
    if (!row) throw new Error("Order not found.");
    if (["pending", "processing", "underpaid"].includes(row.status)) {
      try {
        const { syncPayment } = await import("./payments.server");
        const synced = await syncPayment(row.id);
        return { status: synced?.status ?? row.status, planId: row.plan_id };
      } catch {
        /* provider unreachable — fall back to stored status */
      }
    }
    return { status: row.status, planId: row.plan_id };
  });

/** Counts one PDF export against the plan before the browser prints the report. */
export const consumePdfExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { consumeUsage } = await import("./billing.server");
    await consumeUsage(context.supabase, "pdf_exports");
    return { ok: true };
  });
