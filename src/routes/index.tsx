import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarDays, ListChecks, Sparkles, TrendingUp } from "lucide-react";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudyPilot — Plan smarter study sessions" },
      {
        name: "description",
        content:
          "StudyPilot turns your subjects, deadlines and exams into a realistic daily study plan you can actually follow.",
      },
      { property: "og:title", content: "StudyPilot — Plan smarter study sessions" },
      {
        property: "og:description",
        content:
          "StudyPilot turns your subjects, deadlines and exams into a realistic daily study plan you can actually follow.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: ListChecks,
    title: "Tasks that fit your day",
    description: "Capture assignments with due dates, priority and effort estimates.",
  },
  {
    icon: CalendarDays,
    title: "Exam countdowns",
    description: "See what's coming next and how much time you really have left.",
  },
  {
    icon: TrendingUp,
    title: "Honest progress",
    description: "Log study sessions and watch your weekly streak build up.",
  },
];

function Landing() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!loading && user ? (
            <Button asChild>
              <Link to="/dashboard">Open app</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </header>

      <section className="gradient-hero">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" /> AI study planner
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
            Your study plan, finally realistic.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            StudyPilot keeps your subjects, tasks and exams in one calm place — then helps you spend
            your study hours where they matter most.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/dashboard" : "/auth"}>
                {user ? "Go to dashboard" : "Get started free"}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ mode: "signin" }}>
                I already have an account
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-16 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <article key={title} className="surface-card p-5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon className="size-5" />
            </span>
            <h2 className="mt-4 text-base font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </article>
        ))}
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        StudyPilot — study calmly, finish confidently.
      </footer>
    </div>
  );
}
