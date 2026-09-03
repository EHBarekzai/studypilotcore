import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side AI helpers for Homework Helper, Flashcards and Quiz generation.
 * LOVABLE_API_KEY is read inside handlers only — it never reaches the browser.
 */

const MODEL = "google/gemini-3.7-flash";
const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_CHARS = 7_000_000; // ~5MB binary as base64
const MAX_TEXT_CHARS = 12_000;

export type Attachment = {
  name: string;
  mimeType: string;
  /** data: URL containing base64 content */
  dataUrl: string;
};

export type QuizQuestionType = "mcq" | "true_false" | "short_answer";

export type Flashcard = { front: string; back: string; hint?: string };

export type QuizQuestion = {
  id: string;
  type: QuizQuestionType;
  question: string;
  options?: string[];
  /** index into options for mcq, "true"/"false" for true_false, model answer for short_answer */
  answer: string;
  explanation: string;
};

export type SolutionStep = { title: string; detail: string };

function gatewayErrorMessage(status: number, body: string) {
  if (status === 402) return "The workspace is out of AI credits. Top up in Lovable to continue.";
  if (status === 403) return "Lovable AI is disabled or blocked for this workspace.";
  if (status === 429) return "AI is rate limited right now. Wait a moment and retry.";
  if (status === 401) return "AI is not configured correctly (missing API key).";
  if (status >= 500) return "AI is temporarily unavailable. Please retry.";
  return `AI request failed (${status}). ${body.slice(0, 160)}`;
}

function sanitizeText(value: unknown, max = MAX_TEXT_CHARS) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sanitizeAttachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_ATTACHMENTS)
    .map((item) => {
      const a = item as Partial<Attachment>;
      const dataUrl = typeof a?.dataUrl === "string" ? a.dataUrl : "";
      const mimeType = typeof a?.mimeType === "string" ? a.mimeType : "";
      const name = sanitizeText(a?.name, 120) || "attachment";
      if (!dataUrl.startsWith("data:") || dataUrl.length > MAX_ATTACHMENT_CHARS) return null;
      if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") return null;
      return { name, mimeType, dataUrl };
    })
    .filter((a): a is Attachment => a !== null);
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

function buildUserContent(text: string, attachments: Attachment[]): string | ContentPart[] {
  if (!attachments.length) return text;
  const parts: ContentPart[] = [{ type: "text", text: text || "See the attached material." }];
  for (const a of attachments) {
    if (a.mimeType.startsWith("image/")) {
      parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
    } else {
      parts.push({ type: "file", file: { filename: a.name, file_data: a.dataUrl } });
    }
  }
  return parts;
}

async function callGateway(system: string, userContent: string | ContentPart[]) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");

  let response: Response;
  try {
    response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch {
    throw new Error("Could not reach the AI service. Check your connection and retry.");
  }

  if (!response.ok) {
    const body = await response.text();
    console.error(`[tutor] gateway ${response.status}: ${body.slice(0, 500)}`);
    throw new Error(gatewayErrorMessage(response.status, body));
  }

  const completion = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = completion.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("The AI returned an unreadable response. Please retry.");
  }
}

function requireInput(text: string, attachments: Attachment[]) {
  if (!text && !attachments.length) {
    throw new Error("Add a question, some text, or upload an image or PDF first.");
  }
}

/* ----------------------------- homework helper ----------------------------- */

export const solveHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text?: string; attachments?: Attachment[] }) => ({
    text: sanitizeText(input?.text),
    attachments: sanitizeAttachments(input?.attachments),
  }))
  .handler(async ({ data }) => {
    requireInput(data.text, data.attachments);

    const system = [
      "You are a patient tutor. Read the question(s) — including any in attached images or PDFs — and teach the solution.",
      "Output ONLY JSON:",
      '{"questions":[{"question":"","subject":"","steps":[{"title":"","detail":""}],"answer":"","tips":""}]}',
      "Rules: restate each question you detected; 2-6 clear numbered steps explaining the reasoning;",
      "show formulas or working inside detail; answer is the final result; tips is one short study hint;",
      "never invent content that is not in the input; if unreadable, say so in answer. Keep it concise.",
    ].join(" ");

    const parsed = await callGateway(system, buildUserContent(data.text, data.attachments));
    const raw = Array.isArray(parsed["questions"]) ? (parsed["questions"] as unknown[]) : [];

    const questions = raw.slice(0, 10).map((item) => {
      const q = item as Record<string, unknown>;
      const steps = Array.isArray(q["steps"]) ? (q["steps"] as unknown[]) : [];
      return {
        question: sanitizeText(q["question"], 600) || "Question",
        subject: sanitizeText(q["subject"], 60),
        steps: steps.slice(0, 8).map((s, i) => {
          const step = s as Record<string, unknown>;
          return {
            title: sanitizeText(step["title"], 120) || `Step ${i + 1}`,
            detail: sanitizeText(step["detail"], 1200),
          } satisfies SolutionStep;
        }),
        answer: sanitizeText(q["answer"], 800),
        tips: sanitizeText(q["tips"], 300),
      };
    });

    if (!questions.length) throw new Error("No questions could be read from that input. Try again.");
    return { questions };
  });

/* -------------------------------- flashcards ------------------------------- */

export const generateFlashcards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text?: string; attachments?: Attachment[]; count?: number }) => ({
    text: sanitizeText(input?.text),
    attachments: sanitizeAttachments(input?.attachments),
    count: Math.min(30, Math.max(5, Math.round(Number(input?.count) || 10))),
  }))
  .handler(async ({ data }) => {
    requireInput(data.text, data.attachments);

    const system = [
      `You are a flashcard generator. Create exactly ${data.count} study flashcards from the material.`,
      "Output ONLY JSON:",
      '{"title":"","cards":[{"front":"","back":"","hint":""}]}',
      "Rules: front is one focused question or term (max 140 chars); back is a precise answer (max 300 chars);",
      "hint is optional and very short; cover the whole material without duplicates; stay strictly on the given content.",
    ].join(" ");

    const parsed = await callGateway(system, buildUserContent(data.text, data.attachments));
    const raw = Array.isArray(parsed["cards"]) ? (parsed["cards"] as unknown[]) : [];

    const cards = raw
      .slice(0, 30)
      .map((item) => {
        const c = item as Record<string, unknown>;
        const front = sanitizeText(c["front"], 160);
        const back = sanitizeText(c["back"], 400);
        if (!front || !back) return null;
        const hint = sanitizeText(c["hint"], 140);
        return (hint ? { front, back, hint } : { front, back }) as Flashcard;
      })
      .filter((c): c is Flashcard => c !== null);

    if (!cards.length) throw new Error("No flashcards could be generated. Try different material.");
    return { title: sanitizeText(parsed["title"], 100) || "Flashcards", cards };
  });

/* ----------------------------------- quiz ---------------------------------- */

const QUESTION_TYPES: QuizQuestionType[] = ["mcq", "true_false", "short_answer"];

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      text?: string;
      attachments?: Attachment[];
      count?: number;
      difficulty?: string;
      types?: QuizQuestionType[];
    }) => {
      const types = Array.isArray(input?.types)
        ? QUESTION_TYPES.filter((t) => input.types!.includes(t))
        : [];
      const difficulty = ["easy", "medium", "hard"].includes(String(input?.difficulty))
        ? String(input?.difficulty)
        : "medium";
      return {
        text: sanitizeText(input?.text),
        attachments: sanitizeAttachments(input?.attachments),
        count: Math.min(25, Math.max(3, Math.round(Number(input?.count) || 8))),
        difficulty,
        types: types.length ? types : (["mcq", "true_false"] as QuizQuestionType[]),
      };
    },
  )
  .handler(async ({ data }) => {
    requireInput(data.text, data.attachments);

    const system = [
      `You are an exam writer. Create exactly ${data.count} ${data.difficulty} questions from the material,`,
      `using only these types: ${data.types.join(", ")}. Output ONLY JSON:`,
      '{"title":"","questions":[{"type":"mcq|true_false|short_answer","question":"","options":["",""],"answer":"","explanation":""}]}',
      "Rules: mcq has exactly 4 distinct options and answer is the exact text of the correct option;",
      'true_false has no options and answer is "true" or "false"; short_answer has no options and answer is a 1-2 sentence model answer;',
      "explanation is one or two sentences justifying the answer; mix the types evenly; stay strictly on the given material.",
    ].join(" ");

    const parsed = await callGateway(system, buildUserContent(data.text, data.attachments));
    const raw = Array.isArray(parsed["questions"]) ? (parsed["questions"] as unknown[]) : [];

    const questions = raw
      .slice(0, 25)
      .map((item, index) => {
        const q = item as Record<string, unknown>;
        const type = QUESTION_TYPES.includes(q["type"] as QuizQuestionType)
          ? (q["type"] as QuizQuestionType)
          : "short_answer";
        const question = sanitizeText(q["question"], 600);
        let answer = sanitizeText(q["answer"], 600);
        if (!question || !answer) return null;

        let options: string[] | undefined;
        if (type === "mcq") {
          const list = Array.isArray(q["options"]) ? (q["options"] as unknown[]) : [];
          options = list
            .map((o) => sanitizeText(o, 240))
            .filter((o, i, arr) => o && arr.indexOf(o) === i)
            .slice(0, 6);
          if (options.length < 2) return null;
          if (!options.includes(answer)) options[0] = answer;
        }
        if (type === "true_false") {
          answer = /^t(rue)?$/i.test(answer) ? "true" : "false";
        }

        return {
          id: `q${index + 1}`,
          type,
          question,
          ...(options ? { options } : {}),
          answer,
          explanation: sanitizeText(q["explanation"], 600),
        } satisfies QuizQuestion;
      })
      .filter((q): q is QuizQuestion => q !== null);

    if (!questions.length) throw new Error("No questions could be generated. Try different material.");
    return {
      title: sanitizeText(parsed["title"], 100) || "Practice quiz",
      difficulty: data.difficulty,
      questions,
    };
  });

/* --------------------------- short answer grading -------------------------- */

export const gradeShortAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { items?: { id: string; question: string; expected: string; response: string }[] }) => ({
      items: (Array.isArray(input?.items) ? input.items : []).slice(0, 25).map((i) => ({
        id: sanitizeText(i?.id, 20) || "q",
        question: sanitizeText(i?.question, 600),
        expected: sanitizeText(i?.expected, 600),
        response: sanitizeText(i?.response, 800),
      })),
    }),
  )
  .handler(async ({ data }) => {
    if (!data.items.length) return { results: [] as { id: string; correct: boolean; feedback: string }[] };

    const system = [
      "You grade short answers leniently but fairly: correct if the meaning matches the expected answer.",
      'Output ONLY JSON: {"results":[{"id":"","correct":true,"feedback":""}]}',
      "feedback is one short sentence explaining what was right or missing. Grade every id you receive.",
    ].join(" ");

    const parsed = await callGateway(system, JSON.stringify({ items: data.items }));
    const raw = Array.isArray(parsed["results"]) ? (parsed["results"] as unknown[]) : [];

    const results = raw.map((item) => {
      const r = item as Record<string, unknown>;
      return {
        id: sanitizeText(r["id"], 20),
        correct: r["correct"] === true,
        feedback: sanitizeText(r["feedback"], 400),
      };
    });

    return { results };
  });
