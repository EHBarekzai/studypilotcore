import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, CheckCircle2, GraduationCap, ListChecks } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader, StatCard } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useExams, useProfile, useSubjects, useTasks, useUpdateTask } from "@/lib/data";
import {
  colorClass,
  countdownLabel,
  daysUntil,
  formatDate,
  formatMinutes,
  priorityClass,
  titleCase,
  todayISO,
} from "@/lib/study";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — StudyPilot" },
      {
        name: "description",
        content: "Today's tasks, exam countdowns and your next study session at a glance.",
      },
      { property: "og:title", content: "Dashboard — StudyPilot" },
      {
        property: "og:description",
        content: "Today's tasks, exam countdowns and your next study session at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function nextSession(
  preferredDays: string[] | undefined,
  startHour: number | undefined,
  endHour: number | undefined,
) {
  if (!preferredDays?.length) return null;
  const now = new Date();
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(now);
    day.setDate(now.getDate() + offset);
    const key = DAY_KEYS[day.getDay()]!;
    if (!preferredDays.includes(key)) continue;
    const start = startHour ?? 17;
    if (offset === 0 && now.getHours() >= start) continue;
    const label = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : formatDate(
      day.toISOString().slice(0, 10),
    );
    return { label, start, end: endHour ?? start + 2 };
  }
  return null;
}

function DashboardPage() {
  const profile = useProfile();
  const tasks = useTasks();
  const exams = useExams();
  const subjects = useSubjects();
  const updateTask = useUpdateTask();

  const subjectMap = useMemo(
    () => new Map((subjects.data ?? []).map((s) => [s.id, s])),
    [subjects.data],
  );

  const today = todayISO();
  const allTasks = tasks.data ?? [];
  const todayTasks = allTasks.filter((t) => t.due_date === today);
  const overdue = allTasks.filter(
    (t) => t.status !== "done" && t.due_date && daysUntil(t.due_date) < 0,
  );
  const doneToday = todayTasks.filter((t) => t.status === "done").length;
  const pct = todayTasks.length ? Math.round((doneToday / todayTasks.length) * 100) : 0;
  const upcomingExams = (exams.data ?? [])
    .filter((e) => daysUntil(e.exam_date) >= 0)
    .slice(0, 3);
  const plannedMinutes = todayTasks
    .filter((t) => t.status !== "done")
    .reduce((sum, t) => sum + t.estimated_minutes, 0);

  const session = nextSession(
    profile.data?.preferred_days,
    profile.data?.preferred_start_hour,
    profile.data?.preferred_end_hour,
  );

  const firstName = profile.data?.full_name?.split(" ")[0];
  const loading = tasks.isLoading || exams.isLoading;
  const failed = tasks.isError || exams.isError;

  const summary = todayTasks.length
    ? `${todayTasks.length} task${todayTasks.length === 1 ? "" : "s"} due today · ${formatMinutes(plannedMinutes)} of study left${overdue.length ? ` · ${overdue.length} overdue` : ""}`
    : overdue.length
      ? `Nothing due today, but ${overdue.length} task${overdue.length === 1 ? " is" : "s are"} overdue.`
      : "Nothing due today — a good moment to get ahead.";

  function toggleDone(id: string, status: string) {
    const done = status !== "done";
    updateTask.mutate(
      { id, status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null },
      { onError: (e) => toast.error(e.message) },
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title={firstName ? `Hi ${firstName}` : "Dashboard"}
          description={summary}
          action={
            <Button asChild>
              <Link to="/tasks">Open tasks</Link>
            </Button>
          }
        />

        {failed ? (
          <ErrorState
            description={((tasks.error ?? exams.error) as Error)?.message}
            onRetry={() => {
              tasks.refetch();
              exams.refetch();
            }}
          />
        ) : loading ? (
          <LoadingState rows={3} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Due today"
                value={todayTasks.length}
                hint={`${doneToday} completed`}
                icon={<ListChecks className="size-4" />}
              />
              <StatCard
                label="Completion"
                value={`${pct}%`}
                hint="Today's progress"
                icon={<CheckCircle2 className="size-4" />}
              />
              <StatCard
                label="Overdue"
                value={overdue.length}
                hint={overdue.length ? "Needs attention" : "All clear"}
                icon={<AlertTriangle className="size-4" />}
              />
              <StatCard
                label="Next exam"
                value={upcomingExams[0] ? countdownLabel(upcomingExams[0].exam_date) : "—"}
                hint={upcomingExams[0]?.title ?? "No exams scheduled"}
                icon={<GraduationCap className="size-4" />}
              />
            </div>

            <section className="surface-card space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-semibold">Today</h2>
                <span className="text-sm text-muted-foreground">
                  {doneToday}/{todayTasks.length} done
                </span>
              </div>
              <Progress value={pct} aria-label="Today's completion" />
              {todayTasks.length === 0 ? (
                <EmptyState
                  icon={ListChecks}
                  title="Nothing due today"
                  description="Add a task with today's deadline to see it here."
                  action={
                    <Button asChild variant="outline">
                      <Link to="/tasks">Add a task</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y">
                  {todayTasks.map((task) => {
                    const subject = task.subject_id ? subjectMap.get(task.subject_id) : undefined;
                    return (
                      <li key={task.id} className="flex items-center gap-3 py-2.5">
                        <Checkbox
                          checked={task.status === "done"}
                          onCheckedChange={() => toggleDone(task.id, task.status)}
                          aria-label={`Toggle ${task.title}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate text-sm font-medium",
                              task.status === "done" && "text-muted-foreground line-through",
                            )}
                          >
                            {task.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {subject ? `${subject.name} · ` : ""}
                            {formatMinutes(task.estimated_minutes)}
                          </p>
                        </div>
                        <Badge variant="secondary" className={priorityClass(task.priority)}>
                          {titleCase(task.priority)}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="surface-card space-y-3 p-4">
                <h2 className="font-display text-lg font-semibold">Next study session</h2>
                {session ? (
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <CalendarClock className="size-5" />
                    </span>
                    <div>
                      <p className="font-medium">
                        {session.label}, {session.start}:00–{session.end}:00
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Goal: {formatMinutes(profile.data?.daily_study_minutes ?? 60)} of focused study
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Set your preferred study days in{" "}
                    <Link to="/settings" className="text-primary underline">
                      settings
                    </Link>
                    .
                  </p>
                )}
              </section>

              <section className="surface-card space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold">Upcoming exams</h2>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/exams">View all</Link>
                  </Button>
                </div>
                {upcomingExams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No exams scheduled yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {upcomingExams.map((exam) => {
                      const subject = exam.subject_id ? subjectMap.get(exam.subject_id) : undefined;
                      return (
                        <li key={exam.id} className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{exam.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(exam.exam_date)}
                              {subject ? ` · ${subject.name}` : ""}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={
                              subject ? colorClass(subject.color) : "bg-primary-soft text-primary"
                            }
                          >
                            {countdownLabel(exam.exam_date)}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            {overdue.length ? (
              <section className="surface-card space-y-3 p-4">
                <h2 className="font-display text-lg font-semibold text-destructive">
                  Overdue ({overdue.length})
                </h2>
                <ul className="divide-y">
                  {overdue.slice(0, 5).map((task) => (
                    <li key={task.id} className="flex items-center gap-3 py-2.5">
                      <Checkbox
                        checked={false}
                        onCheckedChange={() => toggleDone(task.id, task.status)}
                        aria-label={`Complete ${task.title}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-destructive">
                          Due {formatDate(task.due_date)} · {countdownLabel(task.due_date!)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
