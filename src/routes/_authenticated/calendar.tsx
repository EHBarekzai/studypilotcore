import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { useMemo } from "react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { useExams, useSubjects, useTasks } from "@/lib/data";
import { colorClass, formatDate, formatMinutes, formatTime, todayISO } from "@/lib/study";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — StudyPilot" },
      {
        name: "description",
        content: "See the next two weeks of deadlines and exams day by day.",
      },
      { property: "og:title", content: "Calendar — StudyPilot" },
      {
        property: "og:description",
        content: "See the next two weeks of deadlines and exams day by day.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const tasks = useTasks();
  const exams = useExams();
  const subjects = useSubjects();

  const subjectMap = useMemo(
    () => new Map((subjects.data ?? []).map((s) => [s.id, s])),
    [subjects.data],
  );

  const days = useMemo(() => {
    const start = new Date(`${todayISO()}T00:00:00`);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return {
        iso,
        tasks: (tasks.data ?? []).filter((t) => t.due_date === iso),
        exams: (exams.data ?? []).filter((e) => e.exam_date === iso),
      };
    });
  }, [tasks.data, exams.data]);

  const hasAnything = days.some((d) => d.tasks.length || d.exams.length);
  const loading = tasks.isLoading || exams.isLoading;
  const failed = tasks.isError || exams.isError;

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title="Calendar" description="The next 14 days of work." />

        {failed ? (
          <ErrorState
            onRetry={() => {
              tasks.refetch();
              exams.refetch();
            }}
          />
        ) : loading ? (
          <LoadingState rows={4} />
        ) : !hasAnything ? (
          <EmptyState
            icon={CalendarDays}
            title="Nothing scheduled"
            description="Tasks with deadlines and exams will appear on this timeline."
          />
        ) : (
          <ul className="space-y-2">
            {days
              .filter((d) => d.tasks.length || d.exams.length)
              .map((day) => (
                <li key={day.iso} className="surface-card space-y-2 p-4">
                  <p className="text-sm font-semibold">{formatDate(day.iso)}</p>
                  <ul className="space-y-1.5">
                    {day.exams.map((exam) => {
                      const subject = exam.subject_id ? subjectMap.get(exam.subject_id) : undefined;
                      return (
                        <li key={exam.id} className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-sm">
                            {exam.title}
                            {exam.start_time ? ` · ${formatTime(exam.start_time)}` : ""}
                          </span>
                          <Badge
                            variant="secondary"
                            className={
                              subject ? colorClass(subject.color) : "bg-destructive/10 text-destructive"
                            }
                          >
                            Exam
                          </Badge>
                        </li>
                      );
                    })}
                    {day.tasks.map((task) => {
                      const subject = task.subject_id ? subjectMap.get(task.subject_id) : undefined;
                      return (
                        <li key={task.id} className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-sm text-muted-foreground">
                            {task.title} · {formatMinutes(task.estimated_minutes)}
                          </span>
                          {subject ? (
                            <Badge variant="secondary" className={colorClass(subject.color)}>
                              {subject.name}
                            </Badge>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
