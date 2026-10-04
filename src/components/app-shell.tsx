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
} from "lucide-react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
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
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/billing", label: "Billing", icon: CreditCard },
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
      const [roles, sub, notes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.from("subscriptions").select("status, current_period_end").eq("user_id", u.user.id).maybeSingle(),
        supabase.from("notifications").select("id, title, body").order("created_at", { ascending: false }).limit(1),
      ]);
      const end = sub.data ? new Date(sub.data.current_period_end).getTime() : 0;
      return {
        isAdmin: (roles.data ?? []).some((r) => r.role === "super_admin"),
        active: end > Date.now() && sub.data?.status !== "expired",
        trialDaysLeft: sub.data?.status === "trial" ? Math.max(0, Math.ceil((end - Date.now()) / 86_400_000)) : null,
        notice: notes.data?.[0] ?? null,
      };
    },
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const signOut = useSignOut();
  const info = useShellInfo().data;
  const items = info?.isAdmin
    ? [...NAV_ITEMS, { to: "/admin", label: "Admin", icon: Shield } as const]
    : NAV_ITEMS;

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar px-4 py-6 lg:flex">
        <Link to="/dashboard" className="px-2">
          <Brand />
        </Link>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-primary-soft data-[status=active]:text-primary"
            >
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        </nav>
        <Button variant="ghost" className="justify-start gap-3" onClick={signOut}>
          <LogOut className="size-5" />
          Sign out
        </Button>
      </aside>

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur lg:px-8">
          <Link to="/dashboard" className="lg:hidden">
            <Brand />
          </Link>
          <div className="hidden lg:block" />
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

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 lg:px-8 lg:pb-12">
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
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur lg:hidden">
        <ul className="flex snap-x overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to} className="min-w-[4.25rem] flex-1 snap-start">
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 pt-2 pb-1 text-[9px] font-medium text-muted-foreground transition-colors",
                  "data-[status=active]:text-primary",
                )}
              >

                <Icon className="size-5" />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
