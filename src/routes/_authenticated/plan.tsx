import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Timer,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FocusTimer } from "@/components/focus-timer";
import { PageHeader, StatCard } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useExams, useSubjects, useTasks } from "@/lib/data";
import {
  useCompletePlannedSession,
  useCreatePlannedSession,
  useDeletePlannedSession,
  useGeneratePlan,
  usePlannedSessions,
  useSmartReschedule,
  useUpdatePlannedSession,
  type PlannedSession,
} from "@/lib/plan-data";
import { colorClass, formatDate, formatMinutes, formatTime, todayISO } from "@/lib/study";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Study Plan — StudyPilot" },
      {
        name: "description",
        content:
          "AI-generated daily and weekly study sessions built from your tasks, exams and available study time.",
      },
      { property: "og:title", content: "Study Plan — StudyPilot" },
      {
        property: "og:description",
        content:
          "AI-generated daily and weekly study sessions built from your tasks, exams and available study time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanPage,
});

const NONE = "none";

type FormState = {
  title: string;
  session_date: string;
  start_time: string;
  duration_minutes: string;
  subject_id: string;
  task_id: string;
  exam_id: string;
  focus: string;
};

function emptyForm(): FormState {
  return {
    title: "",
    session_date: todayISO(),
    start_time: "17:00",
    duration_minutes: "45",
    subject_id: NONE,
    task_id: NONE,
    exam_id: NONE,
    focus: "",
  };
}

function toForm(session: PlannedSession): FormState {
  return {
    title: session.title,
    session_date: session.session_date,
    start_time: session.start_time?.slice(0, 5) ?? "17:00",
    duration_minutes: String(session.duration_minutes),
    subject_id: session.subject_id ?? NONE,
    task_id: session.task_id ?? NONE,
    exam_id: session.exam_id ?? NONE,
    focus: session.focus ?? "",
  };
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function PlanPage() {
  const today = todayISO();
  const [scope, setScope] = useState<"day" | "week">("day");
  const [editing, setEditing] = useState<PlannedSession | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [timerSession, setTimerSession] = useState<PlannedSession | null>(null);

  const sessionsQuery = usePlannedSessions();
  const subjects = useSubjects();
  const tasks = useTasks();
  const exams = useExams();

  const createSession = useCreatePlannedSession();
  const updateSession = useUpdatePlannedSession();
  const deleteSession = useDeletePlannedSession();
  const completeSession = useCompletePlannedSession();
  const generatePlan = useGeneratePlan();
  const reschedule = useSmartReschedule();

  const subjectMap = useMemo(
    () => new Map((subjects.data ?? []).map((s) => [s.id, s])),
    [subjects.data],
  );

  const all = sessionsQuery.data ?? [];
  const rangeEnd = scope === "day" ? today : addDays(today, 6);
  const visible = all.filter((s) => s.session_date >= today && s.session_date <= rangeEnd);
  const missed = all.filter((s) => s.status === "planned" && s.session_date < today);

  const totalMinutes = visible.reduce((sum, s) => sum + s.duration_minutes, 0);
  const doneCount = visible.filter((s) => s.status === "completed").length;

  const grouped = useMemo(() => {
    const map = new Map<string, PlannedSession[]>();
    for (const session of visible) {
      const list = map.get(session.session_date) ?? [];
      list.push(session);
      map.set(session.session_date, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [visible]);

  function openCreate() {
    setForm(emptyForm());
    setCreating(true);
  }

  function openEdit(session: PlannedSession) {
    setForm(toForm(session));
    setEditing(session);
  }

  async function submitForm() {
    const title = form.title.trim();
    if (!title) {
      toast.error("Give the session a title.");
      return;
    }
    const duration = Number(form.duration_minutes);
    if (!Number.isFinite(duration) || duration < 5 || duration > 240) {
      toast.error("Duration must be between 5 and 240 minutes.");
      return;
    }

    const payload = {
      title,
      session_date: form.session_date,
      start_time: form.start_time || null,
      duration_minutes: Math.round(duration),
      subject_id: form.subject_id === NONE ? null : form.subject_id,
      task_id: form.task_id === NONE ? null : form.task_id,
      exam_id: form.exam_id === NONE ? null : form.exam_id,
      focus: form.focus.trim() || null,
    };

    try {
      if (editing) {
        await updateSession.mutateAsync({ id: editing.id, ...payload });
        toast.success("Session updated.");
        setEditing(null);
      } else {
        await createSession.mutateAsync(payload);
        toast.success("Session added.");
        setCreating(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the session.");
    }
  }

  async function runGenerate() {
    if (generatePlan.isPending) return;
    try {
      const result = await generatePlan.mutateAsync(scope);
      toast.success(`Planned ${result.created} session${result.created === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The AI planner failed.");
    }
  }

  async function runReschedule() {
    if (reschedule.isPending) return;
    try {
      const result = await reschedule.mutateAsync();
      toast.success(
        result.moved
          ? `Moved ${result.moved} missed session${result.moved === 1 ? "" : "s"} forward.`
          : "Nothing to reschedule.",
      );
      if (result.unplaceable) {
        toast.warning(`${result.unplaceable} session(s) could not fit before their deadline.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reschedule failed.");
    }
  }

  async function toggleComplete(session: PlannedSession, minutes?: number) {
    try {
      await completeSession.mutateAsync({
        session,
        completed: session.status !== "completed",
        ...(minutes === undefined ? {} : { minutes }),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the session.");
    }
  }

  const loading = sessionsQuery.isLoading || subjects.isLoading;
  const failed = sessionsQuery.isError;

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Study plan"
          description="AI-built sessions from your tasks, exams and available time."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={openCreate}>
                <Plus className="size-4" /> Add
              </Button>
              <Button onClick={runGenerate} disabled={generatePlan.isPending}>
                {generatePlan.isPending ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {generatePlan.isPending
                  ? "Planning…"
                  : `Generate ${scope === "day" ? "today" : "week"}`}
              </Button>
            </div>
          }
        />

        <Tabs value={scope} onValueChange={(value) => setScope(value as "day" | "week")}>
          <TabsList>
            <TabsTrigger value="day">Today</TabsTrigger>
            <TabsTrigger value="week">This week</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Sessions" value={visible.length} icon={<CalendarClock className="size-4" />} />
          <StatCard label="Planned time" value={formatMinutes(totalMinutes)} />
          <StatCard
            label="Completed"
            value={`${doneCount}/${visible.length}`}
            hint={scope === "day" ? "Today" : "Next 7 days"}
          />
        </div>

        {generatePlan.isError ? (
          <div className="surface-card flex flex-wrap items-center justify-between gap-3 border-destructive/40 p-4">
            <p className="text-sm text-destructive">
              {generatePlan.error instanceof Error
                ? generatePlan.error.message
                : "The AI planner failed."}
            </p>
            <Button size="sm" variant="outline" onClick={runGenerate} disabled={generatePlan.isPending}>
              <RefreshCw className="size-4" /> Retry
            </Button>
          </div>
        ) : null}

        {missed.length ? (
          <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="flex items-center gap-2 text-sm">
              <AlertTriangle className="size-4 text-amber-500" />
              {missed.length} missed session{missed.length === 1 ? "" : "s"} from earlier days.
            </p>
            <Button size="sm" onClick={runReschedule} disabled={reschedule.isPending}>
              {reschedule.isPending ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Smart reschedule
            </Button>
          </div>
        ) : null}

        {failed ? (
          <ErrorState onRetry={() => sessionsQuery.refetch()} />
        ) : loading ? (
          <LoadingState rows={3} />
        ) : !visible.length ? (
          <EmptyState
            icon={Sparkles}
            title="No sessions planned"
            description="Generate a plan and StudyPilot will schedule your work around your deadlines and available time."
            action={
              <Button onClick={runGenerate} disabled={generatePlan.isPending}>
                <Sparkles className="size-4" /> Generate plan
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {grouped.map(([date, list]) => (
              <li key={date} className="surface-card space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{formatDate(date)}</p>
                  <span className="text-xs text-muted-foreground">
                    {formatMinutes(list.reduce((sum, s) => sum + s.duration_minutes, 0))}
                  </span>
                </div>
                <ul className="space-y-2">
                  {list.map((session) => {
                    const subject = session.subject_id
                      ? subjectMap.get(session.subject_id)
                      : undefined;
                    const done = session.status === "completed";
                    return (
                      <li
                        key={session.id}
                        className="flex flex-wrap items-center gap-2 rounded-xl border p-3"
                      >
                        <Button
                          size="icon"
                          variant={done ? "default" : "outline"}
                          className="size-8 rounded-full"
                          aria-label={done ? "Mark as not done" : "Mark as done"}
                          onClick={() => toggleComplete(session)}
                        >
                          <Check className="size-4" />
                        </Button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-sm font-medium ${done ? "text-muted-foreground line-through" : ""}`}
                          >
                            {session.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {session.start_time ? `${formatTime(session.start_time)} · ` : ""}
                            {formatMinutes(session.duration_minutes)}
                            {session.focus ? ` · ${session.focus}` : ""}
                          </p>
                        </div>
                        {subject ? (
                          <Badge variant="secondary" className={colorClass(subject.color)}>
                            {subject.name}
                          </Badge>
                        ) : null}
                        {session.exam_id ? <Badge variant="outline">Exam prep</Badge> : null}
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label="Start focus timer"
                            onClick={() => setTimerSession(session)}
                          >
                            <Timer className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label="Edit session"
                            onClick={() => openEdit(session)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <ConfirmDialog
                            title="Delete this session?"
                            description="It will be removed from your plan."
                            confirmLabel="Delete"
                            onConfirm={() => deleteSession.mutate(session.id)}
                            trigger={
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 text-destructive"
                                aria-label="Delete session"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            }
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create / edit dialog */}
      <Dialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit session" : "New session"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="session-title">Title</Label>
              <Input
                id="session-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Revise chapter 4"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="session-date">Date</Label>
                <Input
                  id="session-date"
                  type="date"
                  value={form.session_date}
                  onChange={(e) => setForm({ ...form, session_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="session-time">Start</Label>
                <Input
                  id="session-time"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="session-duration">Minutes</Label>
                <Input
                  id="session-duration"
                  type="number"
                  min={5}
                  max={240}
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Select
                  value={form.subject_id}
                  onValueChange={(value) => setForm({ ...form, subject_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {(subjects.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Task</Label>
                <Select
                  value={form.task_id}
                  onValueChange={(value) => setForm({ ...form, task_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {(tasks.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Exam</Label>
                <Select
                  value={form.exam_id}
                  onValueChange={(value) => setForm({ ...form, exam_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {(exams.data ?? []).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-focus">Focus notes</Label>
              <Textarea
                id="session-focus"
                rows={2}
                value={form.focus}
                onChange={(e) => setForm({ ...form, focus: e.target.value })}
                placeholder="What to cover in this block"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={submitForm}
              disabled={createSession.isPending || updateSession.isPending}
            >
              {editing ? "Save changes" : "Add session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Focus timer dialog */}
      <Dialog open={timerSession !== null} onOpenChange={(open) => !open && setTimerSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Focus timer</DialogTitle>
          </DialogHeader>
          {timerSession ? (
            <FocusTimer
              title={timerSession.title}
              defaultMinutes={timerSession.duration_minutes}
              finishing={completeSession.isPending}
              onFinish={async (minutes) => {
                const session = timerSession;
                if (session.status === "completed") {
                  setTimerSession(null);
                  return;
                }
                await toggleComplete(session, minutes);
                setTimerSession(null);
                toast.success(`Logged ${formatMinutes(minutes)} of study.`);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
