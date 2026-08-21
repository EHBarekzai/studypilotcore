import { createFileRoute } from "@tanstack/react-router";
import { ListChecks, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateTask,
  useDeleteTask,
  useSubjects,
  useTasks,
  useUpdateTask,
  type Task,
} from "@/lib/data";
import {
  DIFFICULTIES,
  PRIORITIES,
  STATUSES,
  colorClass,
  daysUntil,
  formatDate,
  formatMinutes,
  priorityClass,
  requireText,
  titleCase,
} from "@/lib/study";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — StudyPilot" },
      {
        name: "description",
        content: "Track homework and study tasks with deadlines, priority, and smart filters.",
      },
      { property: "og:title", content: "Tasks — StudyPilot" },
      {
        property: "og:description",
        content: "Track homework and study tasks with deadlines, priority, and smart filters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksPage,
});

type Draft = {
  title: string;
  notes: string;
  subject_id: string;
  due_date: string;
  estimated_minutes: string;
  priority: string;
  difficulty: string;
  status: string;
};

const emptyDraft: Draft = {
  title: "",
  notes: "",
  subject_id: "none",
  due_date: "",
  estimated_minutes: "30",
  priority: "medium",
  difficulty: "medium",
  status: "todo",
};

function TasksPage() {
  const tasks = useTasks();
  const subjects = useSubjects();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sort, setSort] = useState("due");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);

  const subjectMap = useMemo(
    () => new Map((subjects.data ?? []).map((s) => [s.id, s])),
    [subjects.data],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = (tasks.data ?? []).filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (subjectFilter !== "all" && task.subject_id !== subjectFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (term) {
        const haystack = `${task.title} ${task.notes ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
    const rank = { high: 0, medium: 1, low: 2 } as Record<string, number>;
    list = [...list].sort((a, b) => {
      if (sort === "priority") return (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1);
      if (sort === "created") return b.created_at.localeCompare(a.created_at);
      if (sort === "title") return a.title.localeCompare(b.title);
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
    return list;
  }, [tasks.data, search, statusFilter, subjectFilter, priorityFilter, sort]);

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setError(null);
    setOpen(true);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setDraft({
      title: task.title,
      notes: task.notes ?? "",
      subject_id: task.subject_id ?? "none",
      due_date: task.due_date ?? "",
      estimated_minutes: String(task.estimated_minutes),
      priority: task.priority,
      difficulty: task.difficulty,
      status: task.status,
    });
    setError(null);
    setOpen(true);
  }

  async function submit() {
    const titleError = requireText(draft.title, "Task title");
    if (titleError) {
      setError(titleError);
      return;
    }
    const minutes = Number(draft.estimated_minutes);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
      setError("Estimated duration must be between 1 and 1440 minutes.");
      return;
    }
    const payload = {
      title: draft.title.trim(),
      notes: draft.notes.trim() || null,
      subject_id: draft.subject_id === "none" ? null : draft.subject_id,
      due_date: draft.due_date || null,
      estimated_minutes: Math.round(minutes),
      priority: draft.priority,
      difficulty: draft.difficulty,
      status: draft.status,
      completed_at: draft.status === "done" ? new Date().toISOString() : null,
    };
    try {
      if (editing) {
        await updateTask.mutateAsync({ id: editing.id, ...payload });
        toast.success("Task updated");
      } else {
        await createTask.mutateAsync(payload);
        toast.success("Task added");
      }
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save task.");
    }
  }

  function toggleDone(task: Task) {
    const done = task.status !== "done";
    updateTask.mutate(
      {
        id: task.id,
        status: done ? "done" : "todo",
        completed_at: done ? new Date().toISOString() : null,
      },
      { onError: (e) => toast.error(e.message) },
    );
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Tasks"
          description="Everything you need to get done, in one list."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" /> New task
            </Button>
          }
        />

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks"
              aria-label="Search tasks"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {titleCase(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger aria-label="Filter by subject">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {(subjects.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger aria-label="Filter by priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {titleCase(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger aria-label="Sort tasks">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="due">Sort: due date</SelectItem>
                <SelectItem value="priority">Sort: priority</SelectItem>
                <SelectItem value="created">Sort: newest</SelectItem>
                <SelectItem value="title">Sort: title</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {tasks.isLoading ? (
          <LoadingState rows={4} />
        ) : tasks.isError ? (
          <ErrorState description={(tasks.error as Error)?.message} onRetry={() => tasks.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No tasks found"
            description="Try clearing filters, or add a new task to get going."
            action={
              <Button onClick={openCreate}>
                <Plus className="size-4" /> New task
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {visible.map((task) => {
              const subject = task.subject_id ? subjectMap.get(task.subject_id) : undefined;
              const overdue =
                task.status !== "done" && task.due_date && daysUntil(task.due_date) < 0;
              return (
                <li key={task.id} className="surface-card flex items-start gap-3 p-4">
                  <Checkbox
                    checked={task.status === "done"}
                    onCheckedChange={() => toggleDone(task)}
                    aria-label={`Mark ${task.title} as ${task.status === "done" ? "not done" : "done"}`}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p
                      className={cn(
                        "font-medium leading-snug",
                        task.status === "done" && "text-muted-foreground line-through",
                      )}
                    >
                      {task.title}
                    </p>
                    {task.notes ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{task.notes}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      {subject ? (
                        <Badge variant="secondary" className={colorClass(subject.color)}>
                          {subject.name}
                        </Badge>
                      ) : null}
                      <Badge variant="secondary" className={priorityClass(task.priority)}>
                        {titleCase(task.priority)}
                      </Badge>
                      <Badge variant="outline">{titleCase(task.difficulty)}</Badge>
                      <Badge variant="outline">{titleCase(task.status)}</Badge>
                      <span
                        className={cn(
                          "text-muted-foreground",
                          overdue && "font-medium text-destructive",
                        )}
                      >
                        {overdue ? "Overdue · " : ""}
                        {formatDate(task.due_date)} · {formatMinutes(task.estimated_minutes)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${task.title}`}
                      onClick={() => openEdit(task)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <ConfirmDialog
                      title="Delete this task?"
                      description={task.title}
                      confirmLabel="Delete"
                      onConfirm={() =>
                        deleteTask.mutate(task.id, {
                          onSuccess: () => toast.success("Task deleted"),
                          onError: (e) => toast.error(e.message),
                        })
                      }
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${task.title}`}
                          className="text-destructive"
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
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={draft.title}
                placeholder="e.g. Algebra worksheet 3"
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-notes">Description</Label>
              <Textarea
                id="task-notes"
                rows={3}
                value={draft.notes}
                placeholder="Optional details"
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Select
                  value={draft.subject_id}
                  onValueChange={(v) => setDraft({ ...draft, subject_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No subject</SelectItem>
                    {(subjects.data ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-due">Deadline</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={draft.due_date}
                  onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-minutes">Estimated minutes</Label>
                <Input
                  id="task-minutes"
                  type="number"
                  min={1}
                  max={1440}
                  value={draft.estimated_minutes}
                  onChange={(e) => setDraft({ ...draft, estimated_minutes: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(v) => setDraft({ ...draft, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {titleCase(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={draft.priority}
                  onValueChange={(v) => setDraft({ ...draft, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {titleCase(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select
                  value={draft.difficulty}
                  onValueChange={(v) => setDraft({ ...draft, difficulty: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d} value={d}>
                        {titleCase(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={createTask.isPending || updateTask.isPending}>
              {editing ? "Save changes" : "Add task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
