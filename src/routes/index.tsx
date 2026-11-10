import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUpRight, ArrowRight, CalendarDays, ListChecks, TrendingUp } from "lucide-react";

import studyDesk from "@/assets/study-desk.jpg";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudyPilot — Your personal study workspace" },
      { name: "description", content: "Bring your subjects, deadlines and exams together in a realistic study plan with StudyPilot." },
      { property: "og:title", content: "StudyPilot — Your personal study workspace" },
      { property: "og:description", content: "Bring your subjects, deadlines and exams together in a realistic study plan with StudyPilot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: ListChecks, number: "01", title: "A little more organised.", description: "Your assignments, subjects and deadlines. Together, not scattered." },
  { icon: CalendarDays, number: "02", title: "A plan you can keep.", description: "Study sessions that make room for your exams — and the rest of your day." },
  { icon: TrendingUp, number: "03", title: "Progress you can see.", description: "Small sessions add up. Keep track of your time, your streaks and what’s improving." },
];

function Landing() {
  const { user, loading } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-10">
        <Link to="/" aria-label="StudyPilot home"><Brand /></Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button asChild variant="ghost" className="px-2 sm:px-4">
            <Link to={!loading && user ? "/dashboard" : "/auth"}>{!loading && user ? "Open workspace" : "Sign in"}<ArrowUpRight /></Link>
          </Button>
        </div>
      </header>

      <section className="landing-cover relative isolate flex items-center overflow-hidden border-y bg-cover-surface">
        <img src={studyDesk} width={1920} height={1024} alt="An open study notebook, pencil and laptop on a sunlit desk" fetchPriority="high" className="landing-cover-image absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-10 sm:py-16">
          <div className="landing-cover-content max-w-lg px-4 py-7 text-cover-foreground sm:px-0 sm:py-0">
            <p className="mb-7 flex items-center gap-3 text-xs font-medium uppercase tracking-widest"><span className="h-px w-7 bg-cover-foreground" /> A personal study workspace</p>
            <h1 className="text-5xl font-medium leading-none sm:text-6xl">StudyPilot<span className="mt-3 block font-editorial text-4xl font-normal italic sm:text-5xl">Room to focus.</span></h1>
            <p className="mt-6 max-w-sm text-base leading-relaxed text-cover-muted">Less time figuring out what to study.<br className="hidden sm:block" /> More time actually making progress.</p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button asChild size="lg"><Link to={user ? "/dashboard" : "/auth"}>{user ? "Go to dashboard" : "Start your study plan"}<ArrowRight /></Link></Button>
              <span className="text-xs text-cover-muted">One day at a time.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-9 sm:px-10 sm:py-12">
        <div className="mb-8 flex items-center justify-between border-b pb-5">
          <h2 className="font-editorial text-3xl">A calmer way to study.</h2>
          <ArrowDown className="size-5 shrink-0 text-muted-foreground" />
        </div>
        <div className="grid gap-8 sm:grid-cols-3 sm:gap-10">
          {FEATURES.map(({ icon: Icon, number, title, description }) => (
            <article key={number} className="border-b pb-7 sm:border-b-0">
              <div className="mb-5 flex items-center justify-between text-muted-foreground"><span className="text-xs tabular-nums">{number}</span><Icon className="size-5" strokeWidth={1.5} /></div>
              <h3 className="text-base font-medium">{title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </section>
      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-6 text-xs text-muted-foreground sm:px-10"><span>StudyPilot</span><span>Study calmly. Finish confidently.</span><Button asChild variant="link" size="sm"><Link to={user ? "/dashboard" : "/auth"}>Your workspace<ArrowUpRight /></Link></Button></div>
      </footer>
    </div>
  );
}
