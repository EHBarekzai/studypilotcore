import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProgressInsights = {
  headline: string;
  strengths: string[];
  gaps: { subject: string; issue: string }[];
  actions: string[];
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "strengths", "gaps", "actions"],
  properties: {
    headline: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    gaps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["subject", "issue"],
        properties: { subject: { type: "string" }, issue: { type: "string" } },
      },
    },
    actions: { type: "array", items: { type: "string" } },
  },
};

function errorMessage(status: number) {
  if (status === 402) return "Out of AI credits. Top up to get new insights.";
  if (status === 403) return "AI is disabled or blocked for this workspace.";
  if (status === 429) return "AI is busy right now. Wait a moment and retry.";
  if (status === 401) return "AI is not configured correctly.";
  if (status >= 500) return "AI is temporarily unavailable. Please retry.";
  return `AI request failed (${status}).`;
}

export const generateProgressInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { summary: string }) => {
    const summary = typeof input?.summary === "string" ? input.summary.slice(0, 8000) : "";
    if (!summary) throw new Error("No study data to analyze yet.");
    return { summary };
  })
  .handler(async ({ data }): Promise<ProgressInsights> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        Authorization: `Bearer ${apiKey}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions:
          "You are a supportive study coach. Analyze the student's study stats (JSON) and give concise, specific, personalized insights grounded only in the numbers. headline: 1 sentence. strengths: 2-3 items. gaps: up to 3 weak subjects/habits with the concrete issue. actions: 3-4 short, actionable next steps (mention subjects, minutes, exams). Each item under 25 words.",
        input: [{ role: "user", content: data.summary }],
        text: { format: { type: "json_schema", name: "insights", strict: true, schema: SCHEMA } },
      }),
    }).catch(() => null);

    if (!res) throw new Error("Could not reach the AI service. Retry.");
    if (!res.ok || !res.body) throw new Error(errorMessage(res.status));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as { type?: string; delta?: string };
          if (evt.type === "response.output_text.delta" && evt.delta) text += evt.delta;
          if (evt.type === "response.failed" || evt.type === "error")
            throw new Error("AI could not generate insights. Retry.");
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("AI")) throw e;
        }
      }
    }

    try {
      const parsed = JSON.parse(text) as ProgressInsights;
      return {
        headline: String(parsed.headline ?? ""),
        strengths: (parsed.strengths ?? []).slice(0, 3).map(String),
        gaps: (parsed.gaps ?? []).slice(0, 3).map((g) => ({
          subject: String(g.subject),
          issue: String(g.issue),
        })),
        actions: (parsed.actions ?? []).slice(0, 4).map(String),
      };
    } catch {
      throw new Error("AI returned an unexpected answer. Retry.");
    }
  });
