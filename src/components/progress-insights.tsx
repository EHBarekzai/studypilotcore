import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Analytics } from "@/lib/analytics";
import { generateProgressInsights, type ProgressInsights } from "@/lib/insights.functions";

function summarize(a: Analytics) {
  return JSON.stringify({
    totals: a.totals,
    streaks: a.streaks,
    week: a.comparisons.week,
    month: a.comparisons.month,
    ai: { ...a.ai, quizTrend: a.ai.quizTrend.slice(-8) },
    subjects: a.perSubject.slice(0, 12).map((s) => ({
      name: s.name,
      minutes: s.minutes,
      tasksDone: s.tasksDone,
      tasksTotal: s.tasksTotal,
      completion: s.completion,
      quizAverage: s.quizAverage,
      exams: s.exams,
    })),
    last7: a.last7.map((d) => ({ d: d.date, m: d.minutes, t: d.tasksDone })),
  });
}

export function ProgressInsightsPanel({ analytics }: { analytics: Analytics }) {
  const run = useServerFn(generateProgressInsights);
  const [data, setData] = useState<ProgressInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  async function generate() {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      setData(await run({ data: { summary: summarize(analytics) } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate insights.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <section className="surface-card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Sparkles className="size-4 text-primary" /> AI insights
          </h2>
          <p className="text-xs text-muted-foreground">
            Personalized tips from your study time, subjects and trends.
          </p>
        </div>
        <Button size="sm" variant={data ? "outline" : "default"} onClick={generate} disabled={loading}>
          <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
          {loading ? "Analyzing…" : data ? "Refresh" : "Get insights"}
        </Button>
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</p>
      ) : null}

      {data ? (
        <div className="space-y-4 text-sm">
          <p className="font-medium">{data.headline}</p>
          {data.strengths.length ? (
            <ul className="space-y-1.5">
              {data.strengths.map((s) => (
                <li key={s} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> {s}
                </li>
              ))}
            </ul>
          ) : null}
          {data.gaps.length ? (
            <ul className="space-y-1.5">
              {data.gaps.map((g) => (
                <li key={g.subject + g.issue} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <span>
                    <span className="font-medium">{g.subject}:</span> {g.issue}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {data.actions.length ? (
            <div className="space-y-1.5 rounded-xl bg-muted/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Next steps
              </p>
              <ul className="space-y-1.5">
                {data.actions.map((a) => (
                  <li key={a} className="flex gap-2">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" /> {a}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
