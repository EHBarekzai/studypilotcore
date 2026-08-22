import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateExam,
  useDeleteExam,
  useExams,
  useSubjects,
  useUpdateExam,
  type Exam,
} from "@/lib/data";
import {
  DIFFICULTIES,
  colorClass,
  countdownLabel,
  daysUntil,
  formatDate,
  formatTime,
  requireText,
  titleCase,
  todayISO,
} from "@/lib/study";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({
    meta: [
      { title: "Exams — StudyPilot" },
      {
        name: "description",
        content: "Countdowns, topics and notes for every upcoming exam in one place.",
      },
      { property: "og:title", content: "Exams — StudyPilot" },
      {
        property: "og:description",
        content: "Countdowns, topics and notes for every upcoming exam in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamsPage,
});

type Draft = {
  title: string;
  subject_id: string;
  exam_date: string;
  start_time: string;
  location: string;
  difficulty: string;
  topics: string;
  notes: string;
};

const emptyDraft: Draft = {
  title: "",
  subject_id: "none",
  exam_date: todayISO(),
  start_time: "",
  location: "",
  difficulty: "medium",
  topics: "",
  notes: "",
};

function ExamsPage() {
  const exams = useExams();
  const subjects = useSubjects();
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();
  const deleteExam = useDeleteExam();

  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);

  const subjectMap = useMemo(
    () => new Map((subjects.data ?? []).map((s) => [s.id, s])),
    [subjects.data],
  );

  const visible = (exams.data ?? []).filter((exam) =>
    view === "upcoming" ? daysUntil(exam.exam_date) >= 0 : daysUntil(exam.exam_date) < 0,
  );

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setError(null);
    setOpen(true);
  }

  function openEdit(exam: Exam) {
    setEditing(exam);
    setDraft({
      title: exam.title,
      subject_id: exam.subject_id ?? "none",
      exam_date: exam.exam_date,
      start_time: exam.start_time?.slice(0, 5) ?? "",
      location: exam.location ?? "",
      difficulty: exam.difficulty,
      topics: (exam.topics ?? []).join(", "),
      notes: exam.notes ?? "",
    });
    setError(null);
    setOpen(true);
  }

  async function submit() {
    const titleError = requireText(draft.title, "Exam title");
    if (titleError) {
      setError(titleError);
      return;
    }
    if (!draft.exam_date) {
      setError("Exam date is required.");
      return;
    }
    const payload = {
      title: draft.title.trim(),
      subject_id: draft.subject_id === "none" ? null : draft.subject_id,
      exam_date: draft.exam_date,
      start_time: draft.start_time || null,
      location: draft.location.trim() || null,
      difficulty: draft.difficulty,
      topics: draft.topics
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: draft.notes.trim() || null,
    };
    try {
      if (editing) {
        await updateExam.mutateAsync({ id: editing.id, ...payload });
        toast.success("Exam updated");
      } else {
        await createExam.mutateAsync(payload);
        toast.success("Exam added");
      }
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save exam.");
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader
          title="Exams"
          description="Know exactly how much time is left."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" /> New exam
            </Button>
          }
        />

        <Tabs value={view} onValueChange={(v) => setView(v as "upcoming" | "past")}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>
        </Tabs>

        {exams.isLoading ? (
          <LoadingState rows={3} />
        ) : exams.isError ? (
          <ErrorState description={(exams.error as Error)?.message} onRetry={() => exams.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={view === "upcoming" ? "No upcoming exams" : "No past exams"}
            description={
              view === "upcoming"
                ? "Add an exam to start a countdown and plan revision."
                : "Exams move here once the date has passed."
            }
            action={
              view === "upcoming" ? (
                <Button onClick={openCreate}>
                  <Plus className="size-4" /> New exam
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-2">
            {visible.map((exam) => {
              const subject = exam.subject_id ? subjectMap.get(exam.subject_id) : undefined;
              const diff = daysUntil(exam.exam_date);
              const soon = diff >= 0 && diff <= 3;
              return (
                <li key={exam.id} className="surface-card space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium leading-snug">{exam.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(exam.exam_date)}
                        {exam.start_time ? ` · ${formatTime(exam.start_time)}` : ""}
                        {exam.location ? ` · ${exam.location}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${exam.title}`}
                        onClick={() => openEdit(exam)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDialog
                        title="Delete this exam?"
                        description={exam.title}
                        confirmLabel="Delete"
                        onConfirm={() =>
                          deleteExam.mutate(exam.id, {
                            onSuccess: () => toast.success("Exam deleted"),
                            onError: (e) => toast.error(e.message),
                          })
                        }
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${exam.title}`}
                            className="text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge
                      variant="secondary"
                      className={cn(
                        diff < 0
                          ? "bg-muted text-muted-foreground"
                          : soon
                            ? "bg-destructive/10 text-destructive"
                            : "bg-primary-soft text-primary",
                      )}
                    >
                      {countdownLabel(exam.exam_date)}
                    </Badge>
                    {subject ? (
                      <Badge variant="secondary" className={colorClass(subject.color)}>
                        {subject.name}
                      </Badge>
                    ) : null}
                    <Badge variant="outline">{titleCase(exam.difficulty)}</Badge>
                  </div>
                  {(exam.topics ?? []).length ? (
                    <p className="text-sm text-muted-foreground">
                      Topics: {(exam.topics ?? []).join(", ")}
                    </p>
                  ) : null}
                  {exam.notes ? <p className="text-sm text-muted-foreground">{exam.notes}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit exam" : "New exam"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="exam-title">Title</Label>
              <Input
                id="exam-title"
                value={draft.title}
                placeholder="e.g. Physics midterm"
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
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
                <Label htmlFor="exam-date">Date</Label>
                <Input
                  id="exam-date"
                  type="date"
                  value={draft.exam_date}
                  onChange={(e) => setDraft({ ...draft, exam_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exam-time">Start time</Label>
                <Input
                  id="exam-time"
                  type="time"
                  value={draft.start_time}
                  onChange={(e) => setDraft({ ...draft, start_time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam-location">Location</Label>
              <Input
                id="exam-location"
                value={draft.location}
                placeholder="Room 204"
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam-topics">Topics (comma separated)</Label>
              <Input
                id="exam-topics"
                value={draft.topics}
                placeholder="Kinematics, Optics"
                onChange={(e) => setDraft({ ...draft, topics: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exam-notes">Notes</Label>
              <Textarea
                id="exam-notes"
                rows={3}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={createExam.isPending || updateExam.isPending}>
              {editing ? "Save changes" : "Add exam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
