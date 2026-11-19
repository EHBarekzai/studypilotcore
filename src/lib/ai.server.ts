/**
 * Single OpenRouter client for every StudyPilot AI feature (server-only).
 * Key: OPENROUTER_GEMMA_API_KEY. Model: OPENROUTER_MODEL (defaults below).
 */
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_AI_MODEL = "google/gemma-4-31b-it:free";

export type AiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

function aiError(status: number) {
  if (status === 429) return "The AI model is busy or rate limited right now. Wait a minute and retry.";
  if (status === 401) return "AI is not configured correctly (the OpenRouter key was rejected).";
  if (status === 402) return "The OpenRouter account has no credits for this model.";
  if (status === 403) return "The AI provider refused this request.";
  if (status === 404) return "The selected AI model is unavailable right now.";
  if (status === 413) return "The uploaded file is too large for the AI model. Try a smaller file or fewer pages.";
  if (status === 400) return "The AI model could not accept this input. Try a smaller file or shorter text.";
  if (status >= 500) return "The AI provider is temporarily unavailable. Please retry.";
  return `AI request failed (${status}).`;
}

function extractJson(raw: string) {
  let s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  const start = s.search(/[[{]/);
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (start > 0 || (end >= 0 && end < s.length - 1)) s = s.slice(start, end + 1);
  return JSON.parse(s) as Record<string, unknown>;
}

/** Sends one chat request and returns the model's JSON object. */
export async function aiChatJson(
  system: string,
  userContent: string | AiContentPart[],
  tag = "ai",
): Promise<Record<string, unknown>> {
  const apiKey = process.env["OPENROUTER_GEMMA_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured (OPENROUTER_GEMMA_API_KEY is missing on the server).");
  const model = process.env["OPENROUTER_MODEL"] || DEFAULT_AI_MODEL;
  const hasPdf = Array.isArray(userContent) && userContent.some((p) => p.type === "file");

  let res: Response;
  try {
    res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Title": "StudyPilot",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: `${system} Respond with a single valid JSON object and nothing else.` },
          { role: "user", content: userContent },
        ],
        // Free text extraction for PDFs so every model can read them.
        ...(hasPdf ? { plugins: [{ id: "file-parser", pdf: { engine: "pdf-text" } }] } : {}),
      }),
    });
  } catch {
    throw new Error("Could not reach the AI service. Check your connection and retry.");
  }

  if (!res.ok) {
    // Log status only — never request bodies, headers or keys.
    console.error(`[${tag}] openrouter status ${res.status}`);
    throw new Error(aiError(res.status));
  }

  const body = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    error?: { code?: number };
  } | null;
  if (body?.error) {
    console.error(`[${tag}] openrouter error code ${body.error.code ?? "?"}`);
    throw new Error(aiError(Number(body.error.code) || 500));
  }
  const content = body?.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("The AI returned an empty answer. Please retry.");
  try {
    return extractJson(content);
  } catch {
    throw new Error("The AI returned an unreadable response. Please retry.");
  }
}
