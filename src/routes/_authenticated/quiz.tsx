import { createFileRoute } from "@tanstack/react-router";
import { Check, CircleHelp, RefreshCw, RotateCcw, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { AiSourceInput } from "@/components/ai-input";
import { AppShell } from "@/components/app-shell";
import { PageHeader, StatCard } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Toggle } from "@/components/ui/toggle";
import { titleCase } from "@/lib/study";
import { useGenerateQuiz, useGradeShortAnswers, type Attachment, type QuizQuestionType } from "@/lib/tutor";
import type { QuizQuestion } from "@/lib/tutor.functions";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Generate MCQ, true/false and short-answer questions from any topic, notes, image or PDF.";

export const Route = createFileRoute("/_authenticated/quiz")({
  head: () => ({
    meta: [
      { title: "AI Quiz Generator — StudyPilot" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "AI Quiz Generator — StudyPilot" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuizPage,
});

const TYPE_LABELS: Record<QuizQuestionType, string> = {
  mcq: "Multiple choice",
  true_false: "True / false",
  short_answer: "Short answer",
};

type Grade = { correct: boolean; feedback?: string };

function QuizPage() {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [count, setCount] = useState("8");
  const [difficulty, setDifficulty] = useState("medium");
  const [types, setTypes] = useState<QuizQuestionType[]>(["mcq", "true_false"]);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [title, setTitle] = useState("Practice quiz");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, Grade> | null>(null);

  const generate = useGenerateQuiz();
  const grade = useGradeShortAnswers();
  const busy = generate.isPending || grade.isPending;

  const toggleType = (type: QuizQuestionType) => {
    setTypes((current) =>
      current.includes(type)
        ? current.length > 1
          ? current.filter((t) => t !== type)
          : current
        : [...current, type],
    );
  };

  const run = () => {
    if (busy) return;
    generate.mutate(
      { text, attachments, count: Number(count), difficulty, types },
      {
        onSuccess: (data) => {
          setQuestions(data.questions);
          setTitle(data.title);
          setAnswers({});
          setGrades(null);
        },
      },
    );
  };

  const submit = () => {
    if (busy || !questions.length) return;
    const next: Record<string, Grade> = {};
    const shortItems: { id: string; question: string; expected: string; response: string }[] = [];

    for (const q of questions) {
      const given = (answers[q.id] ?? "").trim();
      if (q.type === "short_answer") {
        if (!given) {
          next[q.id] = { correct: false, feedback: "No answer given." };
        } else {
          shortItems.push({ id: q.id, question: q.question, expected: q.answer, response: given });
        }
      } else {
        next[q.id] = { correct: given.toLowerCase() === q.answer.toLowerCase() };
      }
    }

    if (!shortItems.length) {
      setGrades(next);
      return;
    }

    grade.mutate(
      { items: shortItems },
      {
        onSuccess: (data) => {
          for (const item of shortItems) {
            const found = data.results.find((r) => r.id === item.id);
            next[item.id] = {
              correct: found?.correct ?? false,
              feedback: found?.feedback ?? "Compare your answer with the model answer.",
            };
          }
          setGrades(next);
        },
        onError: () => setGrades(next),
      },
    );
  };

  const answeredCount = questions.filter((q) => (answers[q.id] ?? "").trim()).length;
  const score = grades ? Object.values(grades).filter((g) => g.correct).length : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="AI Quiz Generator" description={DESCRIPTION} />

        <section className="surface-card space-y-4 p-4 sm:p-5">
          <AiSourceInput
            label="Topic or study material"
            placeholder="e.g. World War II causes and consequences"
            value={text}
            onChange={setText}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            disabled={busy}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="quiz-count">Questions</Label>
              <Select value={count} onValueChange={setCount} disabled={busy}>
                <SelectTrigger id="quiz-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["3", "5", "8", "12", "15", "20"].map((n) => (
                    <SelectItem key={n} value={n}>
                      {n} questions
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quiz-difficulty">Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty} disabled={busy}>
                <SelectTrigger id="quiz-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["easy", "medium", "hard"].map((d) => (
                    <SelectItem key={d} value={d}>
                      {titleCase(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Question types</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_LABELS) as QuizQuestionType[]).map((type) => (
                <Toggle
                  key={type}
                  variant="outline"
                  size="sm"
                  pressed={types.includes(type)}
                  disabled={busy}
                  onPressedChange={() => toggleType(type)}
                >
                  {TYPE_LABELS[type]}
                </Toggle>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={run} disabled={busy} className="gap-2">
              <Sparkles className="size-4" />
              {generate.isPending ? "Generating…" : "Generate quiz"}
            </Button>
            {questions.length ? (
              <Button variant="outline" onClick={run} disabled={busy} className="gap-2">
                <RefreshCw className="size-4" />
                Regenerate
              </Button>
            ) : null}
          </div>
        </section>

        {generate.isPending ? <LoadingState rows={3} /> : null}

        {generate.isError && !generate.isPending ? (
          <ErrorState
            title="Couldn't generate the quiz"
            description={generate.error.message}
            onRetry={run}
          />
        ) : null}

        {!generate.isPending && !questions.length && !generate.isError ? (
          <EmptyState
            icon={CircleHelp}
            title="No quiz yet"
            description="Pick your settings and generate a practice quiz from any material."
          />
        ) : null}

        {questions.length && !generate.isPending ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{title}</h2>
              <Badge variant="secondary">{titleCase(difficulty)}</Badge>
            </div>

            {grades ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard
                  label="Score"
                  value={`${score}/${questions.length}`}
                  hint={`${Math.round((score / questions.length) * 100)}% correct`}
                />
                <StatCard label="Correct" value={score} />
                <StatCard label="Incorrect" value={questions.length - score} />
              </div>
            ) : (
              <Progress value={(answeredCount / questions.length) * 100} />
            )}

            <ol className="space-y-4">
              {questions.map((q, i) => {
                const given = answers[q.id] ?? "";
                const result = grades?.[q.id];
                return (
                  <li key={q.id} className="surface-card space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium">
                        {i + 1}. {q.question}
                      </p>
                      <Badge variant="outline">{TYPE_LABELS[q.type]}</Badge>
                    </div>

                    {q.type === "mcq" ? (
                      <div className="grid gap-2">
                        {(q.options ?? []).map((option) => (
                          <button
                            key={option}
                            type="button"
                            disabled={Boolean(grades)}
                            onClick={() => setAnswers((a) => ({ ...a, [q.id]: option }))}
                            className={cn(
                              "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                              given === option ? "border-primary bg-primary-soft" : "hover:bg-accent/40",
                              grades && option === q.answer && "border-primary bg-primary-soft",
                            )}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {q.type === "true_false" ? (
                      <div className="flex gap-2">
                        {["true", "false"].map((option) => (
                          <Button
                            key={option}
                            type="button"
                            variant={given === option ? "default" : "outline"}
                            size="sm"
                            disabled={Boolean(grades)}
                            onClick={() => setAnswers((a) => ({ ...a, [q.id]: option }))}
                          >
                            {titleCase(option)}
                          </Button>
                        ))}
                      </div>
                    ) : null}

                    {q.type === "short_answer" ? (
                      <Input
                        value={given}
                        disabled={Boolean(grades)}
                        placeholder="Your answer"
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      />
                    ) : null}

                    {result ? (
                      <div className="space-y-2 rounded-xl bg-muted/50 p-3 text-sm">
                        <p
                          className={cn(
                            "flex items-center gap-2 font-medium",
                            result.correct ? "text-primary" : "text-destructive",
                          )}
                        >
                          {result.correct ? <Check className="size-4" /> : <X className="size-4" />}
                          {result.correct ? "Correct" : "Incorrect"}
                        </p>
                        {q.type !== "mcq" ? (
                          <p className="text-muted-foreground">
                            <span className="font-medium text-foreground">Answer: </span>
                            {q.type === "true_false" ? titleCase(q.answer) : q.answer}
                          </p>
                        ) : null}
                        {result.feedback ? (
                          <p className="text-muted-foreground">{result.feedback}</p>
                        ) : null}
                        {q.explanation ? (
                          <p className="text-muted-foreground">{q.explanation}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-wrap gap-2">
              {!grades ? (
                <Button onClick={submit} disabled={busy} className="gap-2">
                  <Check className="size-4" />
                  {grade.isPending ? "Checking…" : "Check answers"}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setAnswers({});
                    setGrades(null);
                  }}
                >
                  <RotateCcw className="size-4" />
                  Retry quiz
                </Button>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
