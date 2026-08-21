import { createFileRoute } from "@tanstack/react-router";
import { Archive, ArchiveRestore, BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
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
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCreateSubject,
  useDeleteSubject,
  useSubjects,
  useTasks,
  useUpdateSubject,
  type Subject,
} from "@/lib/data";
import {
  DIFFICULTIES,
  PRIORITIES,
  SUBJECT_COLORS,
  SUBJECT_ICONS,
  colorClass,
  priorityClass,
  requireText,
  titleCase,
} from "@/lib/study";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/subjects")({
  head: () => ({
    meta: [
      { title: "Subjects — StudyPilot" },
      {
        name: "description",
        content: "Organise your subjects with colours, difficulty, priority and live progress.",
      },
      { property: "og:title", content: "Subjects — StudyPilot" },
      {
        property: "og:description",
        content: "Organise your subjects with colours, difficulty, priority and live progress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubjectsPage,
});

type Draft = {
  name: string;
  color: string;
  icon: string;
  difficulty: string;
  priority: string;
};

const emptyDraft: Draft = {
  name: "",
  color: "teal",
  icon: "book",
  difficulty: "medium",
  priority: "medium",
};

function SubjectsPage() {
  const subjects = useSubjects();
  const tasks = useTasks();
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();

  const [view, setView] = useState<"active" | "archived">("active");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);

  const progressBySubject = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const task of tasks.data ?? []) {
      if (!task.subject_id) continue;
      const entry = map.get(task.subject_id) ?? { done: 0, total: 0 };
      entry.total += 1;
      if (task.status === "done") entry.done += 1;
      map.set(task.subject_id, entry);
    }
    return map;
  }, [tasks.data]);

  const visible = (subjects.data ?? []).filter((s) =>
    view === "archived" ? s.archived : !s.archived,
  );

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setError(null);
    setOpen(true);
  }

  function openEdit(subject: Subject) {
    setEditing(subject);
    setDraft({
      name: subject.name,
      color: subject.color,
      icon: subject.icon,
      difficulty: subject.difficulty,
      priority: subject.priority,
    });
    setError(null);
    setOpen(true);
  }

  async function submit() {
    const nameError = requireText(draft.name, "Subject name", 60);
    if (nameError) {
      setError(nameError);
      return;
    }
    try {
      if (editing) {
        await updateSubject.mutateAsync({ id: editing.id, ...draft, name: draft.name.trim() });
        toast.success("Subject updated");
      } else {
        await createSubject.mutateAsync({ ...draft, name: draft.name.trim() });
        toast.success("Subject added");
      }
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save subject.");
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Subjects"
          description="Group your work and track progress per subject."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" /> New subject
            </Button>
          }
        />

        <Tabs value={view} onValueChange={(v) => setView(v as "active" | "archived")}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>

        {subjects.isLoading ? (
          <LoadingState rows={3} />
        ) : subjects.isError ? (
          <ErrorState
            description={(subjects.error as Error)?.message}
            onRetry={() => subjects.refetch()}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={view === "active" ? "No subjects yet" : "Nothing archived"}
            description={
              view === "active"
                ? "Add your first subject to start organising tasks and exams."
                : "Archived subjects will show up here."
            }
            action={
              view === "active" ? (
                <Button onClick={openCreate}>
                  <Plus className="size-4" /> New subject
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {visible.map((subject) => {
              const stats = progressBySubject.get(subject.id) ?? { done: 0, total: 0 };
              const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
              return (
                <li key={subject.id} className="surface-card space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-10 items-center justify-center rounded-xl",
                          colorClass(subject.color),
                        )}
                      >
                        <BookOpen className="size-5" />
                      </span>
                      <div>
                        <p className="font-medium">{subject.name}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {subject.difficulty} · {subject.icon}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${subject.name}`}
                        onClick={() => openEdit(subject)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={subject.archived ? "Restore subject" : "Archive subject"}
                        onClick={() =>
                          updateSubject.mutate(
                            { id: subject.id, archived: !subject.archived },
                            {
                              onSuccess: () =>
                                toast.success(subject.archived ? "Restored" : "Archived"),
                            },
                          )
                        }
                      >
                        {subject.archived ? (
                          <ArchiveRestore className="size-4" />
                        ) : (
                          <Archive className="size-4" />
                        )}
                      </Button>
                      <ConfirmDialog
                        title={`Delete ${subject.name}?`}
                        description="Tasks and exams linked to this subject stay, but lose their subject."
                        confirmLabel="Delete"
                        onConfirm={() =>
                          deleteSubject.mutate(subject.id, {
                            onSuccess: () => toast.success("Subject deleted"),
                            onError: (e) => toast.error(e.message),
                          })
                        }
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${subject.name}`}
                            className="text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={priorityClass(subject.priority)} variant="secondary">
                      {titleCase(subject.priority)} priority
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {stats.done}/{stats.total} tasks done
                    </span>
                  </div>
                  <Progress value={pct} aria-label={`${subject.name} progress`} />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit subject" : "New subject"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject-name">Name</Label>
              <Input
                id="subject-name"
                value={draft.name}
                placeholder="e.g. Mathematics"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
            <div className="space-y-2">
              <Label>Colour</Label>
              <div className="flex flex-wrap gap-2">
                {SUBJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    aria-pressed={draft.color === color}
                    onClick={() => setDraft({ ...draft, color })}
                    className={cn(
                      "size-9 rounded-full ring-offset-2 ring-offset-background",
                      colorClass(color),
                      draft.color === color && "ring-2 ring-primary",
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <Select value={draft.icon} onValueChange={(v) => setDraft({ ...draft, icon: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_ICONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      {titleCase(icon)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={createSubject.isPending || updateSubject.isPending}
            >
              {editing ? "Save changes" : "Add subject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
