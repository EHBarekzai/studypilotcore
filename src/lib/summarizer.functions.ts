import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildUserContent, callGateway, sanitizeText } from "./tutor.functions";

/**
 * PDF Summarizer. Limits (enabled, monthly quota, max MB) come from the plan row
 * and are enforced by the `consume_pdf_summary` RPC, separate from other PDF limits.
 */

const MAX_TEXT = 200_000;

export type SummaryStatus = {
  active: boolean;
  plan?: string;
  enabled?: boolean;
  limit?: number | null;
  max_mb?: number | null;
  used?: number;
  period_start?: string;
  resets_on?: string;
};

export type SummaryResult = {
  title: string;
  overview: string;
  key_points: string[];
  chapters: { title: string; summary: string }[];
  definitions: { term: string; definition: string }[];
  concepts: string[];
  study_notes: string[];
};

export const getSummarizerStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("pdf_summary_status");
    if (error) throw new Error("Could not load your summary allowance.");
    return data as SummaryStatus;
  });

const list = (v: unknown, max: number, len = 400) =>
  Array.isArray(v) ? v.slice(0, max).map((x) => sanitizeText(x, len)).filter(Boolean) : [];

export const summarizePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { text?: string; storagePath?: string; fileName?: string; scope?: string; detail?: string }) => ({
      text: typeof input?.text === "string" ? input.text.trim().slice(0, MAX_TEXT) : "",
      storagePath: typeof input?.storagePath === "string" ? input.storagePath.slice(0, 400) : "",
      fileName: sanitizeText(input?.fileName, 160) || "document.pdf",
      scope: sanitizeText(input?.scope, 200),
      detail: input?.detail === "detailed" ? "detailed" : "concise",
    }),
  )
  .handler(async ({ data, context }) => {
    if (!data.text && !data.storagePath) throw new Error("Upload a PDF or paste some text first.");

    let fileBlob: Blob | null = null;
    if (data.storagePath) {
      if (!data.storagePath.startsWith(`${context.userId}/summaries/`) || data.storagePath.includes("..")) {
        throw new Error("Invalid file reference. Upload the PDF again.");
      }
      const { data: blob, error } = await context.supabase.storage.from("study-uploads").download(data.storagePath);
      if (error || !blob) throw new Error("The uploaded PDF could not be read. Upload it again.");
      const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
      if (String.fromCharCode(...head) !== "%PDF-") throw new Error("That file is not a valid PDF.");
      fileBlob = blob;
    }

    // Quota + size + plan access, atomically on the server.
    const { data: quota, error: qErr } = await context.supabase.rpc("consume_pdf_summary", {
      _size_bytes: fileBlob?.size ?? 0,
    });
    if (qErr) throw new Error("Could not check your plan usage. Please retry.");
    const q = (quota ?? {}) as { ok?: boolean; reason?: string; limit?: number; max_mb?: number; period_start?: string };
    if (!q.ok) {
      if (q.reason === "no_subscription") throw new Error("Your trial or subscription has ended. Choose a plan in Billing.");
      if (q.reason === "disabled") throw new Error("PDF Summarizer isn't included in your plan. Upgrade in Billing.");
      if (q.reason === "too_large") throw new Error(`This PDF is larger than your plan allows (${q.max_mb} MB).`);
      throw new Error(`You've used all ${q.limit} PDF summaries for this billing cycle. Upgrade in Billing for more.`);
    }

    const refund = async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("refund_pdf_summary", { _user_id: context.userId, _period: q.period_start! });
    };

    const system = [
      "You are a study-notes assistant. Summarize the provided document accurately, using only its content.",
      data.scope ? `Only cover this part of the document: ${data.scope}.` : "Cover the whole document.",
      data.detail === "detailed" ? "Be thorough." : "Be concise.",
      "Output ONLY JSON:",
      '{"title":"","overview":"","key_points":[""],"chapters":[{"title":"","summary":""}],"definitions":[{"term":"","definition":""}],"concepts":[""],"study_notes":[""]}',
      "Rules: overview 2-4 sentences; 5-12 key_points; chapters follow the document's sections (max 20);",
      "definitions only for terms defined or central in the text (max 20); concepts max 12; study_notes are revision-ready bullet notes (max 15).",
    ].join(" ");

    let parsed: Record<string, unknown>;
    try {
      const content = fileBlob
        ? await buildUserContent(data.text || "Summarize the attached PDF.", [
            { name: data.fileName, mimeType: "application/pdf", storagePath: data.storagePath },
          ], context.supabase)
        : data.text;
      parsed = await callGateway(system, content);
    } catch (e) {
      await refund();
      throw e;
    } finally {
      if (data.storagePath) await context.supabase.storage.from("study-uploads").remove([data.storagePath]);
    }

    const result: SummaryResult = {
      title: sanitizeText(parsed["title"], 160) || data.fileName,
      overview: sanitizeText(parsed["overview"], 1500),
      key_points: list(parsed["key_points"], 15),
      chapters: (Array.isArray(parsed["chapters"]) ? parsed["chapters"] : []).slice(0, 25).map((c) => {
        const r = c as Record<string, unknown>;
        return { title: sanitizeText(r["title"], 160), summary: sanitizeText(r["summary"], 1500) };
      }).filter((c) => c.title || c.summary),
      definitions: (Array.isArray(parsed["definitions"]) ? parsed["definitions"] : []).slice(0, 25).map((d) => {
        const r = d as Record<string, unknown>;
        return { term: sanitizeText(r["term"], 120), definition: sanitizeText(r["definition"], 600) };
      }).filter((d) => d.term && d.definition),
      concepts: list(parsed["concepts"], 15, 200),
      study_notes: list(parsed["study_notes"], 20),
    };
    if (!result.overview && !result.key_points.length) {
      await refund();
      throw new Error("No summary could be produced from that document. Try another file.");
    }

    await context.supabase.from("pdf_summaries").insert({
      user_id: context.userId,
      title: result.title,
      source_name: data.storagePath ? data.fileName : "Pasted text",
      scope: data.scope || null,
      result: result as never,
    });
    return result;
  });
