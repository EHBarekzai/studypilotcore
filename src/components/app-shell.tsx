import { Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Brain,
  CalendarDays,
  CircleHelp,
  GraduationCap,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Sparkles,
  Settings,
  CreditCard,
  Shield,
  TrendingUp,
  FileText,
  MessageSquarePlus,
  Menu,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/plan", label: "Plan", icon: Sparkles },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/exams", label: "Exams", icon: GraduationCap },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/helper", label: "Helper", icon: Brain },
  { to: "/flashcards", label: "Cards", icon: Layers },
  { to: "/quiz", label: "Quiz", icon: CircleHelp },
  { to: "/summarizer", label: "Summarize", icon: FileText },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/requests", label: "Requests", icon: MessageSquarePlus },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;


export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

function useShellInfo() {
  return useQuery({
    queryKey: ["shell-info"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [roles, sub, notes, personal] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("subscriptions").select("status, current_period_end").eq("user_id", u.user.id).maybeSingle(),
        supabase.from("notifications").select("id, title, body").order("created_at", { ascending: false }).limit(1),
        supabase.from("user_notifications").select("id, title").is("read_at", null).order("created_at", { ascending: false }).limit(1),
      ]);
      const end = sub.data ? new Date(sub.data.current_period_end).getTime() : 0;
      return {
        isAdmin: u.user.email?.toLowerCase() === "erfanhussainbarekzai@gmail.com" && (roles.data ?? []).some((r) => r.role === "super_admin"),
        active: end > Date.now() && sub.data?.status !== "expired",
        trialDaysLeft: sub.data?.status === "trial" ? Math.max(0, Math.ceil((end - Date.now()) / 86_400_000)) : null,
        notice: notes.data?.[0] ?? null,
        personal: personal.data?.[0] ?? null,
      };
    },
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const signOut = useSignOut();
  const [menuOpen, setMenuOpen] = useState(false);
  const info = useShellInfo().data;
  const items = info?.isAdmin
    ? [...NAV_ITEMS, { to: "/admin", label: "Admin", icon: Shield } as const]
    : NAV_ITEMS;
  const groups = [
    { label: "Workspace", entries: items.slice(0, 6) },
    { label: "Study tools", entries: items.slice(6, 11) },
    { label: "Account", entries: items.slice(11) },
  ];
  const navigation = (mobile = false) => groups.map(({ label, entries }) => (
    <div key={label} className="space-y-1">
      <p className="px-3 pb-2 pt-4 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      {entries.map(({ to, label: name, icon: Icon }) => (
        <Link key={to} to={to} onClick={() => mobile && setMenuOpen(false)}
          className="flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:border-primary data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-primary">
          <Icon className="size-4 shrink-0" strokeWidth={1.7} />{name}
        </Link>
      ))}
    </div>
  ));

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar px-4 py-6 lg:flex">
        <Link to="/dashboard" className="px-2">
          <Brand />
        </Link>
        <nav aria-label="Main navigation" className="mt-5 flex-1 overflow-y-auto pb-4">{navigation()}</nav>
        <Button variant="ghost" className="mt-3 justify-start gap-3 border-t" onClick={signOut}>
          <LogOut className="size-5" />
          Sign out
        </Button>
      </aside>

      <div className="lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/95 px-5 py-3 backdrop-blur lg:px-10">
          <Link to="/dashboard" className="lg:hidden">
            <Brand />
          </Link>
          <span className="hidden text-xs text-muted-foreground lg:block">StudyPilot <span className="mx-2 text-border">/</span> Your workspace</span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              className="rounded-full lg:hidden"
              onClick={signOut}
            >
              <LogOut className="size-5" />
            </Button>
          </div>
        </header>

        <main className="study-workspace mx-auto w-full max-w-6xl px-5 pb-28 pt-7 lg:px-10 lg:pb-12 lg:pt-9">
          {info && !info.active && (
            <Link to="/billing" className="mb-4 block rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Your trial or plan has ended. Choose a plan to keep using AI tools and adding new items →
            </Link>
          )}
          {info?.active && info.trialDaysLeft !== null && info.trialDaysLeft <= 3 && (
            <Link to="/billing" className="mb-4 block rounded-xl border bg-primary-soft p-3 text-sm text-primary">
              {info.trialDaysLeft} day{info.trialDaysLeft === 1 ? "" : "s"} left in your free trial — pick a plan →
            </Link>
          )}
          {info?.notice && (
            <div className="mb-4 rounded-xl border bg-muted/50 p-3 text-sm">
              <span className="font-medium">{info.notice.title}</span> {info.notice.body}
            </div>
          )}
          {info?.personal && (
            <Link to="/requests" className="mb-4 block rounded-xl border border-primary/30 bg-primary-soft p-3 text-sm text-primary">
              <span className="font-medium">{info.personal.title}</span> — view your requests
            </Link>
          )}
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Mobile navigation" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {items.slice(0, 3).concat(items.filter((item) => item.to === "/progress")).map(({ to, label, icon: Icon }) => (
            <li key={to} className="min-w-0">
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 pt-3 pb-1 text-[10px] font-medium text-muted-foreground transition-colors",
                  "data-[status=active]:text-primary",
                )}
              >

                <Icon className="size-5" />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          ))}
          <li>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" className="h-auto w-full flex-col gap-1 rounded-none px-1 pb-1 pt-3 text-[10px] text-muted-foreground" aria-label="More pages">
                  <Menu className="size-5" /><span>More</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col overflow-y-auto px-4">
                <SheetTitle><Brand /></SheetTitle>
                <SheetDescription className="sr-only">All StudyPilot pages</SheetDescription>
                <nav aria-label="All pages" className="pb-4">{navigation(true)}</nav>
              </SheetContent>
            </Sheet>
          </li>
        </ul>
      </nav>
    </div>
  );
}
