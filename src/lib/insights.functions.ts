import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProgressInsights = {
  headline: string;
  strengths: string[];
  gaps: { subject: string; issue: string }[];
  actions: string[];
};

export const generateProgressInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { summary: string }) => {
    const summary = typeof input?.summary === "string" ? input.summary.slice(0, 8000) : "";
    if (!summary) throw new Error("No study data to analyze yet.");
    return { summary };
  })
  .handler(async ({ data }): Promise<ProgressInsights> => {
    const { aiChatJson } = await import("./ai.server");
    const parsed = (await aiChatJson(
      "You are a supportive study coach. Analyze the student's study stats (JSON) and give concise, specific, personalized insights grounded only in the numbers. Output JSON: {\"headline\":\"\",\"strengths\":[\"\"],\"gaps\":[{\"subject\":\"\",\"issue\":\"\"}],\"actions\":[\"\"]}. headline: 1 sentence. strengths: 2-3 items. gaps: up to 3. actions: 3-4 short next steps. Each item under 25 words.",
      data.summary,
      "insights",
    )) as Partial<ProgressInsights>;
    if (!parsed.headline) throw new Error("AI returned an unexpected answer. Retry.");
      return {
        headline: String(parsed.headline ?? ""),
        strengths: (parsed.strengths ?? []).slice(0, 3).map(String),
        gaps: (parsed.gaps ?? []).slice(0, 3).map((g) => ({
          subject: String(g.subject),
          issue: String(g.issue),
        })),
        actions: (parsed.actions ?? []).slice(0, 4).map(String),
      };
  });
