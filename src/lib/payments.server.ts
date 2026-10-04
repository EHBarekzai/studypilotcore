import { createHmac, timingSafeEqual } from "crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { noholdpayRequest, noholdpayWebhookSecrets } from "./billing.server";

/** Provider status -> StudyPilot payment status. */
const STATUS_MAP: Record<string, string> = {
  pending: "pending",
  awaiting_payment: "pending",
  payment_detected: "processing",
  confirming: "processing",
  confirmed: "paid",
  overpaid: "overpaid",
  underpaid: "underpaid",
  expired: "expired",
  expired_underpaid: "underpaid",
  expired_reorged: "failed",
  cancelled: "cancelled",
  failed: "failed",
  refunded: "refunded",
  refund_requested: "refund_requested",
};

const EVENT_STATUS: Record<string, string> = {
  "payment.awaiting": "pending",
  "payment.detected": "processing",
  "payment.confirming": "processing",
  "payment.confirmed": "paid",
  "payment.overpaid": "overpaid",
  "payment.underpaid": "underpaid",
  "payment.expired": "expired",
  "payment.expired_underpaid": "underpaid",
  "payment.expired_reorged": "failed",
  "payment.cancelled": "cancelled",
  "payment.failed": "failed",
  "payment.refunded": "refunded",
  "payment.refund_requested": "refund_requested",
};

export function verifyNoholdpaySignature(rawBody: string, header: string | null) {
  if (!header) return false;
  const t = header.match(/t=(\d+)/)?.[1];
  const v1s = (header.match(/v1=([a-f0-9]+)/g) ?? []).map((s) => s.slice(3));
  if (!t || !v1s.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  for (const secret of noholdpayWebhookSecrets()) {
    const expected = Buffer.from(createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex"), "hex");
    for (const v of v1s) {
      const got = Buffer.from(v, "hex");
      if (got.length === expected.length && timingSafeEqual(got, expected)) return true;
    }
  }
  return false;
}

export async function audit(entry: {
  category: "admin" | "payment" | "subscription" | "security";
  action: string;
  actor_id?: string | null;
  actor_email?: string | null;
  target_user_id?: string | null;
  reason?: string | null;
  details?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("audit_logs").insert({ ...entry, details: (entry.details ?? {}) as never });
}

/** Activates or renews the plan for a verified paid payment. Idempotent. */
async function activateFromPayment(paymentId: string) {
  const { data: claimed } = await supabaseAdmin
    .from("payments")
    .update({ activated_at: new Date().toISOString() })
    .eq("id", paymentId)
    .is("activated_at", null)
    .in("status", ["paid", "overpaid"])
    .select("id, user_id, plan_id")
    .maybeSingle();
  if (!claimed?.user_id) return false;

  const { data: plan } = await supabaseAdmin.from("plans").select("period_days").eq("id", claimed.plan_id).single();
  const days = plan?.period_days ?? 30;
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_id, status, current_period_end")
    .eq("user_id", claimed.user_id)
    .maybeSingle();

  const now = Date.now();
  const end = sub ? new Date(sub.current_period_end).getTime() : 0;
  // Same paid plan still running -> extend from its end; otherwise start fresh now.
  const renewing = sub && sub.plan_id === claimed.plan_id && sub.status === "active" && end > now;
  const base = renewing ? end : now;
  const periodEnd = new Date(base + days * 86_400_000).toISOString();

  await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: claimed.user_id,
      plan_id: claimed.plan_id,
      status: "active",
      ...(renewing ? {} : { started_at: new Date(now).toISOString() }),
      current_period_end: periodEnd,
      cancelled_at: null,
      last_payment_id: claimed.id,
    },
    { onConflict: "user_id" },
  );
  await audit({
    category: "subscription",
    action: renewing ? "subscription.renewed" : "subscription.activated",
    target_user_id: claimed.user_id,
    details: { payment_id: claimed.id, plan: claimed.plan_id, period_end: periodEnd },
  });
  return true;
}

type ProviderPayment = {
  id: string;
  status: string;
  order_id?: string | null;
  fiat_amount?: string;
  fiat_currency?: string;
  selected_chain?: string;
  chain_id?: string;
  coin_symbol?: string;
  tx_hash?: string;
  amount_received?: string;
  display_amount_received?: string;
};

/**
 * Re-fetches the payment from NoHoldPay (never trusting the webhook body or a
 * browser redirect alone), stores the verified state, and activates on paid.
 */
export async function syncPayment(paymentRowId: string) {
  const { data: row } = await supabaseAdmin.from("payments").select("*").eq("id", paymentRowId).single();
  if (!row?.provider_payment_id) return row;
  const remote = await noholdpayRequest<ProviderPayment>(
    row.environment === "live" ? "live" : "test",
    `/payments/${row.provider_payment_id}`,
  );
  let status = STATUS_MAP[remote.status] ?? row.status;
  let error: string | null = null;
  if ((status === "paid" || status === "overpaid") && remote.order_id && remote.order_id !== row.order_id) {
    status = "failed";
    error = "Order ID mismatch from provider";
  }
  if (
    (status === "paid" || status === "overpaid") &&
    (String(remote.fiat_currency ?? "USD").toUpperCase() !== row.fiat_currency ||
      Number(remote.fiat_amount ?? 0) + 0.001 < Number(row.fiat_amount))
  ) {
    status = "underpaid";
    error = "Provider amount lower than plan price";
  }
  const paid = status === "paid" || status === "overpaid";
  await supabaseAdmin
    .from("payments")
    .update({
      status,
      error,
      coin: remote.coin_symbol ?? row.coin,
      chain: remote.chain_id ?? remote.selected_chain ?? row.chain,
      tx_hash: remote.tx_hash ?? row.tx_hash,
      amount_received: remote.display_amount_received ?? remote.amount_received ?? row.amount_received,
      paid_at: paid && !row.paid_at ? new Date().toISOString() : row.paid_at,
    })
    .eq("id", row.id);
  if (paid) await activateFromPayment(row.id);
  if (status === "failed" && row.activated_at) {
    await audit({
      category: "security",
      action: "payment.reversed_after_activation",
      target_user_id: row.user_id,
      details: { payment_id: row.id, provider_status: remote.status },
    });
  }
  return { ...row, status };
}

export async function handleWebhookEvent(event: {
  id: string;
  event: string;
  data?: Record<string, unknown> | undefined;
}) {
  const data = event.data ?? {};
  const providerId = String(data["payment_id"] ?? "");

  // Idempotency: a unique provider event id means duplicates are ignored.
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("payment_events")
    .insert({ provider_event_id: event.id, event: event.event, payload: event as never })
    .select("id")
    .maybeSingle();
  if (insertError) {
    if (insertError.code === "23505") return { duplicate: true };
    throw new Error(insertError.message);
  }

  try {
    const { data: payment } = providerId
      ? await supabaseAdmin.from("payments").select("id, status").eq("provider_payment_id", providerId).maybeSingle()
      : { data: null };
    if (!payment) throw new Error(`Unknown payment ${providerId || "(none)"}`);

    const hinted = EVENT_STATUS[event.event];
    if (hinted && !["paid", "overpaid", "failed"].includes(hinted)) {
      await supabaseAdmin
        .from("payments")
        .update({
          status: hinted,
          tx_hash: (data["tx_hash"] as string) ?? undefined,
          coin: (data["coin_symbol"] as string) ?? undefined,
          chain: (data["chain_id"] as string) ?? undefined,
        })
        .eq("id", payment.id)
        .not("status", "in", "(paid,overpaid)");
    } else {
      await syncPayment(payment.id);
    }
    await supabaseAdmin.from("payment_events").update({ processed: true, payment_id: payment.id }).eq("id", inserted!.id);
    await audit({ category: "payment", action: event.event, details: { payment_id: payment.id, event_id: event.id } });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabaseAdmin.from("payment_events").update({ error: message }).eq("id", inserted!.id);
    // Allow a retry from the provider by removing the dedupe marker when processing failed.
    if (!message.startsWith("Unknown payment")) {
      await supabaseAdmin.from("payment_events").update({ provider_event_id: `${event.id}:failed:${Date.now()}` }).eq("id", inserted!.id);
      throw err;
    }
    return { ignored: true };
  }
}
