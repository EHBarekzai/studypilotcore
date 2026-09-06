import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  RefreshCw,
  RotateCcw,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { AiSourceInput } from "@/components/ai-input";
import { toAttachments, useStudyUploads } from "@/lib/uploads";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLogAiActivity } from "@/lib/data";
import { useGenerateFlashcards } from "@/lib/tutor";
import type { Flashcard } from "@/lib/tutor.functions";

const DESCRIPTION =
  "Turn a topic, your notes, an image or a PDF into flip-through Q&A flashcards.";

export const Route = createFileRoute("/_authenticated/flashcards")({
  head: () => ({
    meta: [
      { title: "AI Flashcards — StudyPilot" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "AI Flashcards — StudyPilot" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FlashcardsPage,
});

function shuffleCards(cards: Flashcard[]) {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

function FlashcardsPage() {
  const [text, setText] = useState("");
  const uploads = useStudyUploads();
  const [count, setCount] = useState("10");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [title, setTitle] = useState("Flashcards");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const generate = useGenerateFlashcards();
  const logActivity = useLogAiActivity();

  const run = () => {
    if (generate.isPending) return;
    generate.mutate(
      { text, attachments: toAttachments(uploads.files), count: Number(count) },
      {
        onSuccess: (data) => {
          setCards(data.cards);
          setTitle(data.title);
          setIndex(0);
          setFlipped(false);
          logActivity.mutate({ kind: "flashcards", topic: data.title, total: data.cards.length });
        },
      },
    );
  };

  const card = cards[index];
  const go = (delta: number) => {
    if (!cards.length) return;
    setIndex((i) => (i + delta + cards.length) % cards.length);
    setFlipped(false);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="AI Flashcards" description={DESCRIPTION} />

        <section className="surface-card space-y-4 p-4 sm:p-5">
          <AiSourceInput
            label="Topic or study material"
            placeholder="e.g. Photosynthesis — light and dark reactions"
            value={text}
            onChange={setText}
            uploads={uploads}
            disabled={generate.isPending}
          />
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32 space-y-1.5">
              <Label htmlFor="card-count">Cards</Label>
              <Select value={count} onValueChange={setCount} disabled={generate.isPending}>
                <SelectTrigger id="card-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["5", "10", "15", "20", "30"].map((n) => (
                    <SelectItem key={n} value={n}>
                      {n} cards
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={run} disabled={generate.isPending} className="gap-2">
              <Sparkles className="size-4" />
              {generate.isPending ? "Generating…" : "Generate flashcards"}
            </Button>
            {cards.length ? (
              <Button
                variant="outline"
                onClick={run}
                disabled={generate.isPending}
                className="gap-2"
              >
                <RefreshCw className="size-4" />
                Regenerate
              </Button>
            ) : null}
          </div>
        </section>

        {generate.isPending ? <LoadingState rows={1} /> : null}

        {generate.isError && !generate.isPending ? (
          <ErrorState
            title="Couldn't make flashcards"
            description={generate.error.message}
            onRetry={run}
          />
        ) : null}

        {!generate.isPending && !cards.length && !generate.isError ? (
          <EmptyState
            icon={Layers}
            title="No flashcards yet"
            description="Describe a topic or attach your notes and StudyPilot will build a deck."
          />
        ) : null}

        {card && !generate.isPending ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">
                Card {index + 1} of {cards.length}
              </p>
            </div>
            <Progress value={((index + 1) / cards.length) * 100} />

            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              aria-label={flipped ? "Show question" : "Show answer"}
              className="surface-card flex min-h-56 w-full flex-col items-center justify-center gap-3 p-6 text-center transition-colors hover:bg-accent/40"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                {flipped ? "Answer" : "Question"}
              </span>
              <span className="text-lg font-medium">{flipped ? card.back : card.front}</span>
              {!flipped && card.hint ? (
                <span className="text-sm text-muted-foreground">Hint: {card.hint}</span>
              ) : null}
              <span className="text-xs text-muted-foreground">Tap the card to flip</span>
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button variant="outline" size="icon" aria-label="Previous card" onClick={() => go(-1)}>
                  <ChevronLeft className="size-5" />
                </Button>
                <Button variant="outline" size="icon" aria-label="Next card" onClick={() => go(1)}>
                  <ChevronRight className="size-5" />
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="gap-2"
                  onClick={() => {
                    setCards((c) => shuffleCards(c));
                    setIndex(0);
                    setFlipped(false);
                  }}
                >
                  <Shuffle className="size-4" />
                  Shuffle
                </Button>
                <Button
                  variant="ghost"
                  className="gap-2"
                  onClick={() => {
                    setIndex(0);
                    setFlipped(false);
                  }}
                >
                  <RotateCcw className="size-4" />
                  Restart
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
