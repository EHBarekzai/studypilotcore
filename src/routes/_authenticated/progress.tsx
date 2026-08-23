import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock, Flame, TrendingUp } from "lucide-react";
import { useMemo } from "react";

import { AppShell } from "@/components/app-shell";
import { PageHeader, StatCard } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Progress } from "@/components/ui/progress";
import { useStudySessions, useSubjects, useTasks } from "@/lib/data";
import { colorClass, formatMinutes } from "@/lib/study";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Progress — StudyPilot" },
      {
        name: "description",
        content: "Completion rates, study minutes and per-subject progress over time.",
      },
      { property: "og:title", content: "Progress — StudyPilot" },
      {
        property: "og:description",
        content: "Completion rates, study minutes and per-subject progress over time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const tasks = useTasks();
  const sessions = useStudySessions();
  const subjects = useSubjects();

  const all = tasks.data ?? [];
  const done = all.filter((t) => t.status === "done");
  const pct = all.length ? Math.round((done.length / all.length) * 100) : 0;

  const weekMinutes = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return (sessions.data ?? [])
      .filter((s) => new Date(s.started_at).getTime() >= cutoff)
      .reduce((sum, s) => sum + s.duration_minutes, 0);
  }, [sessions.data]);

  const perSubject = useMemo(() => {
    return (subjects.data ?? [])
      .filter((s) => !s.archived)
      .map((subject) => {
        const list = all.filter((t) => t.subject_id === subject.id);
        const finished = list.filter((t) => t.status === "done").length;
        return {
          subject,
          total: list.length,
          done: finished,
          pct: list.length ? Math.round((finished / list.length) * 100) : 0,
        };
      });
  }, [subjects.data, all]);

  const loading = tasks.isLoading || sessions.isLoading;
  const failed = tasks.isError || sessions.isError;

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title="Progress" description="How your study habits are trending." />

        {failed ? (
          <ErrorState
            onRetry={() => {
              tasks.refetch();
              sessions.refetch();
            }}
          />
        ) : loading ? (
          <LoadingState rows={3} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Completion"
                value={`${pct}%`}
                hint={`${done.length}/${all.length} tasks`}
                icon={<CheckCircle2 className="size-4" />}
              />
              <StatCard
                label="This week"
                value={formatMinutes(weekMinutes)}
                hint="Logged study time"
                icon={<Clock className="size-4" />}
              />
              <StatCard
                label="Sessions"
                value={(sessions.data ?? []).length}
                hint="All time"
                icon={<Flame className="size-4" />}
              />
              <StatCard
                label="Open tasks"
                value={all.length - done.length}
                hint="Still to do"
                icon={<TrendingUp className="size-4" />}
              />
            </div>

            <section className="surface-card space-y-4 p-4">
              <h2 className="font-display text-lg font-semibold">By subject</h2>
              {perSubject.length === 0 ? (
                <EmptyState
                  title="No subjects yet"
                  description="Add subjects to see progress broken down."
                />
              ) : (
                <ul className="space-y-4">
                  {perSubject.map(({ subject, total, done: finished, pct: subjectPct }) => (
                    <li key={subject.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            colorClass(subject.color),
                          )}
                        >
                          {subject.name}
                        </span>
                        <span className="text-muted-foreground">
                          {finished}/{total} · {subjectPct}%
                        </span>
                      </div>
                      <Progress value={subjectPct} aria-label={`${subject.name} progress`} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
