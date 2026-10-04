import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/** Owner account: the only email that may hold admin roles. */
export const OWNER_EMAIL = "erfanhussainbarekzai@gmail.com";

export type UsageMetric =
  | "homework"
  | "image_questions"
  | "pdfs"
  | "flashcards"
  | "quizzes"
  | "ai_plans"
  | "reschedules"
  | "pdf_exports"
  | "ai_insights";

const LABELS: Record<UsageMetric, string> = {
  homework: "AI homework requests",
  image_questions: "image questions",
  pdfs: "PDF uploads",
  flashcards: "flashcards",
  quizzes: "quizzes",
  ai_plans: "AI study plans",
  reschedules: "reschedules",
  pdf_exports: "PDF exports",
  ai_insights: "AI insights",
};

/**
 * Atomically consumes plan usage server-side (as the signed-in user).
 * Throws a friendly error when there is no active plan or the limit is reached.
 */
export async function consumeUsage(
  supabase: SupabaseClient<Database>,
  metric: UsageMetric,
  amount = 1,
) {
  if (amount <= 0) return;
  const { data, error } = await supabase.rpc("consume_usage", { _metric: metric, _amount: amount });
  if (error) throw new Error("Could not check your plan usage. Please retry.");
  const result = (data ?? {}) as { ok?: boolean; reason?: string; limit?: number };
  if (result.ok) return;
  if (result.reason === "no_subscription") {
    throw new Error("Your trial or subscription has ended. Choose a plan in Billing to continue.");
  }
  throw new Error(
    `You've reached your monthly limit of ${result.limit} ${LABELS[metric]}. Upgrade in Billing for more.`,
  );
}

/** Returns the plan limits for the user's active plan, or null when inactive. */
export async function activePlanLimits(supabase: SupabaseClient<Database>, userId: string) {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (!sub || new Date(sub.current_period_end).getTime() <= Date.now() || sub.status === "expired") {
    return null;
  }
  const { data: plan } = await supabase.from("plans").select("id, limits").eq("id", sub.plan_id).maybeSingle();
  return plan ? { planId: plan.id, limits: (plan.limits ?? {}) as Record<string, unknown> } : null;
}

/* -------------------------------- NoHoldPay -------------------------------- */

export const NOHOLDPAY_API = "https://api.noholdpay.com/api/v1";

export function noholdpayKey(mode: "test" | "live") {
  return mode === "live"
    ? process.env["NOHOLDPAY_LIVE_API_KEY"]
    : process.env["NOHOLDPAY_TEST_API_KEY"];
}

export function noholdpayWebhookSecrets() {
  return [process.env["NOHOLDPAY_TEST_WEBHOOK_SECRET"], process.env["NOHOLDPAY_LIVE_WEBHOOK_SECRET"]].filter(
    (s): s is string => !!s,
  );
}

export async function noholdpayRequest<T>(
  mode: "test" | "live",
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const key = noholdpayKey(mode);
  if (!key) throw new Error(`Crypto payments are not configured yet (${mode} mode).`);
  const res = await fetch(`${NOHOLDPAY_API}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[noholdpay] ${res.status} ${path}: ${text.slice(0, 400)}`);
    throw new Error(`Payment provider error (${res.status}). Please try again.`);
  }
  return JSON.parse(text) as T;
}
