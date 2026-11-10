import { createFileRoute } from "@tanstack/react-router";
import {
  Brain,
  CheckCircle2,
  Clock,
  Flame,
  FileDown,
  Layers,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { PageHeader, StatCard } from "@/components/page-header";
import { ProgressInsightsPanel } from "@/components/progress-insights";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildAnalytics } from "@/lib/analytics";
import { useAiActivity, useExams, useStudySessions, useSubjects, useTasks } from "@/lib/data";
import { exportReportToPdf } from "@/lib/export-pdf";
import { consumePdfExport } from "@/lib/billing.functions";
import { colorClass, formatMinutes } from "@/lib/study";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Progress & Analytics — StudyPilot" },
      {
        name: "description",
        content:
          "Interactive study analytics: time studied, streaks, quiz scores, subject performance and weekly or monthly trends.",
      },
      { property: "og:title", content: "Progress & Analytics — StudyPilot" },
      {
        property: "og:description",
        content:
          "Interactive study analytics: time studied, streaks, quiz scores, subject performance and weekly or monthly trends.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProgressPage,
});

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

function Delta({ value, suffix = "vs previous" }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        up ? "text-success" : "text-destructive",
      )}
    >
      {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {up ? "+" : ""}
      {value}% {suffix}
    </span>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card space-y-4 p-4">
      <div className="space-y-0.5">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ProgressPage() {
  const tasks = useTasks();
  const sessions = useStudySessions();
  const subjects = useSubjects();
  const exams = useExams();
  const activity = useAiActivity();
  const [range, setRange] = useState<"week" | "month">("week");

  const analytics = useMemo(
    () =>
      buildAnalytics({
        tasks: tasks.data ?? [],
        exams: exams.data ?? [],
        sessions: sessions.data ?? [],
        subjects: subjects.data ?? [],
        activity: activity.data ?? [],
      }),
    [tasks.data, exams.data, sessions.data, subjects.data, activity.data],
  );

  const loading = tasks.isLoading || sessions.isLoading || subjects.isLoading;
  const failed = tasks.isError || sessions.isError || subjects.isError;

  const series = range === "week" ? analytics.last7 : analytics.last30;
  const comparison =
    range === "week" ? analytics.comparisons.week : analytics.comparisons.month;
  const rangeLabel = range === "week" ? "Last 7 days" : "Last 30 days";

  const subjectPie = analytics.perSubject
    .filter((s) => s.minutes > 0)
    .slice(0, 6)
    .map((s) => ({ name: s.name, value: s.minutes }));

  async function exportReport() {
    try {
      await consumePdfExport();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export is not available on your plan.");
      return;
    }
    const ok = exportReportToPdf({
      title: "Study progress report",
      subtitle: rangeLabel,
      stats: [
        { label: "Study time", value: formatMinutes(analytics.totals.totalMinutes) },
        { label: "Sessions", value: String(analytics.totals.sessions) },
        {
          label: "Task completion",
          value: `${analytics.totals.completion}% (${analytics.totals.tasksDone}/${analytics.totals.tasksTotal})`,
        },
        { label: "Current streak", value: `${analytics.streaks.current} days` },
        { label: "Best streak", value: `${analytics.streaks.best} days` },
        {
          label: "Quiz average",
          value: analytics.ai.quizAverage === null ? "—" : `${analytics.ai.quizAverage}%`,
        },
      ],
      sections: [
        {
          heading: `${rangeLabel} summary`,
          lines: [
            `Study time: ${formatMinutes(comparison.current.minutes)} (${comparison.minutesChange >= 0 ? "+" : ""}${comparison.minutesChange}% vs previous period)`,
            `Tasks completed: ${comparison.current.tasksDone} (${comparison.tasksChange >= 0 ? "+" : ""}${comparison.tasksChange}% vs previous period)`,
            `Study sessions: ${comparison.current.sessions}`,
            `Overdue tasks: ${analytics.totals.overdue}`,
            `Upcoming exams: ${analytics.totals.upcomingExams}`,
          ],
        },
        {
          heading: "AI study activity",
          lines: [
            `Quizzes taken: ${analytics.ai.quizAttempts}`,
            `Quiz average: ${analytics.ai.quizAverage === null ? "—" : `${analytics.ai.quizAverage}%`}; best: ${analytics.ai.quizBest === null ? "—" : `${analytics.ai.quizBest}%`}`,
            `Flashcard decks: ${analytics.ai.flashcardDecks} (${analytics.ai.cardsGenerated} cards)`,
            `Homework questions solved: ${analytics.ai.homeworkSolved}`,
          ],
        },
      ],
      tables: [
        {
          heading: "Subject performance",
          columns: ["Subject", "Study time", "Tasks", "Completion", "Quiz avg", "Exams"],
          rows: analytics.perSubject.map((s) => [
            s.name,
            formatMinutes(s.minutes),
            `${s.tasksDone}/${s.tasksTotal}`,
            `${s.completion}%`,
            s.quizAverage === null ? "—" : `${s.quizAverage}%`,
            s.exams,
          ]),
        },
        {
          heading: "Daily activity",
          columns: ["Date", "Study time", "Sessions", "Tasks done"],
          rows: series.map((d) => [d.date, formatMinutes(d.minutes), d.sessions, d.tasksDone]),
        },
      ],
    });
    if (!ok) toast.error("Allow pop-ups to save the report as a PDF.");
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Progress"
          description="Interactive analytics across your study time, tasks, exams and AI practice."
          action={
            <Button variant="outline" onClick={exportReport}>
              <FileDown className="size-4" /> Export PDF
            </Button>
          }
        />

        {failed ? (
          <ErrorState
            onRetry={() => {
              tasks.refetch();
              sessions.refetch();
              subjects.refetch();
              activity.refetch();
            }}
          />
        ) : loading ? (
          <LoadingState rows={4} />
        ) : (
          <>
            <Tabs value={range} onValueChange={(value) => setRange(value as "week" | "month")}>
              <TabsList>
                <TabsTrigger value="week">Weekly</TabsTrigger>
                <TabsTrigger value="month">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Study time"
                value={formatMinutes(comparison.current.minutes)}
                hint={rangeLabel}
                icon={<Clock className="size-4" />}
              />
              <StatCard
                label="Completion"
                value={`${analytics.totals.completion}%`}
                hint={`${analytics.totals.tasksDone}/${analytics.totals.tasksTotal} tasks`}
                icon={<CheckCircle2 className="size-4" />}
              />
              <StatCard
                label="Streak"
                value={`${analytics.streaks.current}d`}
                hint={`Best ${analytics.streaks.best}d · ${analytics.streaks.activeDays} active days`}
                icon={<Flame className="size-4" />}
              />
              <StatCard
                label="Quiz average"
                value={analytics.ai.quizAverage === null ? "—" : `${analytics.ai.quizAverage}%`}
                hint={`${analytics.ai.quizAttempts} quizzes taken`}
                icon={<Target className="size-4" />}
              />
            </div>

            <ProgressInsightsPanel analytics={analytics} />

            <Panel
              title="Study time trend"
              description={`${rangeLabel} · ${formatMinutes(comparison.current.minutes)} logged`}
            >
              <div className="flex flex-wrap gap-4">
                <Delta value={comparison.minutesChange} suffix="study time" />
                <Delta value={comparison.tasksChange} suffix="tasks done" />
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="minutesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      interval="preserveStartEnd"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: number) => [`${value} min`, "Studied"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="minutes"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      fill="url(#minutesFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Tasks completed" description={`Per day · ${rangeLabel}`}>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        interval="preserveStartEnd"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="tasksDone" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel title="Time by subject" description="Where your study hours go">
                {subjectPie.length ? (
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={subjectPie}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={45}
                          outerRadius={78}
                          paddingAngle={2}
                        >
                          {subjectPie.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: number, name: string) => [`${value} min`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState
                    title="No study time yet"
                    description="Finish a focus session to see your subject split."
                  />
                )}
              </Panel>
            </div>

            {analytics.ai.quizTrend.length ? (
              <Panel title="Quiz scores" description="Each attempt, oldest to newest">
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.ai.quizTrend} margin={{ left: -20, right: 8, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [`${value}%`, "Score"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            ) : null}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="AI actions"
                value={analytics.ai.totalActions}
                hint="Helper, cards & quizzes"
                icon={<Brain className="size-4" />}
              />
              <StatCard
                label="Flashcards"
                value={analytics.ai.cardsGenerated}
                hint={`${analytics.ai.flashcardDecks} decks`}
                icon={<Layers className="size-4" />}
              />
              <StatCard
                label="Homework solved"
                value={analytics.ai.homeworkSolved}
                hint="Questions explained"
              />
              <StatCard
                label="Avg per day"
                value={formatMinutes(analytics.totals.avgMinutesPerDay)}
                hint="Last 30 days"
              />
            </div>

            <Panel title="Subject performance" description="Completion, time and quiz results">
              {analytics.perSubject.length === 0 ? (
                <EmptyState
                  title="No subjects yet"
                  description="Add subjects to see performance broken down."
                />
              ) : (
                <ul className="space-y-4">
                  {analytics.perSubject.map((subject) => (
                    <li key={subject.id} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            colorClass(subject.color),
                          )}
                        >
                          {subject.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatMinutes(subject.minutes)} · {subject.tasksDone}/
                          {subject.tasksTotal} tasks · {subject.completion}%
                          {subject.quizAverage === null ? "" : ` · quiz ${subject.quizAverage}%`}
                        </span>
                      </div>
                      <Progress
                        value={subject.completion}
                        aria-label={`${subject.name} progress`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}
      </div>
    </AppShell>
  );
}
