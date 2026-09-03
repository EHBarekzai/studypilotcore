import { createFileRoute } from "@tanstack/react-router";
import { Lightbulb, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";

import { AiSourceInput } from "@/components/ai-input";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSolveHomework, type Attachment } from "@/lib/tutor";

const DESCRIPTION =
  "Type or paste a question, or upload a photo or PDF — get clear step-by-step solutions.";

export const Route = createFileRoute("/_authenticated/helper")({
  head: () => ({
    meta: [
      { title: "Homework Helper — StudyPilot" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Homework Helper — StudyPilot" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelperPage,
});

function HelperPage() {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const solve = useSolveHomework();
  const result = solve.data;

  const run = () => {
    if (solve.isPending) return;
    solve.mutate({ text, attachments });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="Homework Helper" description={DESCRIPTION} />

        <section className="surface-card space-y-4 p-4 sm:p-5">
          <AiSourceInput
            label="Your question or material"
            placeholder="e.g. Solve 3x² − 12 = 0 and explain each step"
            value={text}
            onChange={setText}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            disabled={solve.isPending}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={run} disabled={solve.isPending} className="gap-2">
              <Sparkles className="size-4" />
              {solve.isPending ? "Solving…" : "Solve step by step"}
            </Button>
            {result ? (
              <Button variant="outline" onClick={run} disabled={solve.isPending} className="gap-2">
                <RefreshCw className="size-4" />
                Regenerate
              </Button>
            ) : null}
          </div>
        </section>

        {solve.isPending ? <LoadingState rows={2} /> : null}

        {solve.isError && !solve.isPending ? (
          <ErrorState
            title="Couldn't solve that"
            description={solve.error.message}
            onRetry={run}
          />
        ) : null}

        {!solve.isPending && !solve.isError && !result ? (
          <EmptyState
            icon={Wand2}
            title="No solutions yet"
            description="Add a question or upload a picture of your homework to get a worked solution."
          />
        ) : null}

        {result && !solve.isPending ? (
          <div className="space-y-4">
            {result.questions.map((q, index) => (
              <article key={index} className="surface-card space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-base font-semibold">{q.question}</h2>
                  {q.subject ? <Badge variant="secondary">{q.subject}</Badge> : null}
                </div>

                <ol className="space-y-3">
                  {q.steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                        {i + 1}
                      </span>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{step.title}</p>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {step.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>

                {q.answer ? (
                  <div className="rounded-xl bg-primary-soft p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Answer
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{q.answer}</p>
                  </div>
                ) : null}

                {q.tips ? (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                    {q.tips}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
