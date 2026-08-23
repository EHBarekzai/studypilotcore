import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { useSignOut } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
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
import { useProfile, useUpdateProfile } from "@/lib/data";
import { requireText } from "@/lib/study";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — StudyPilot" },
      {
        name: "description",
        content: "Update your study preferences, availability and daily study goal.",
      },
      { property: "og:title", content: "Settings — StudyPilot" },
      {
        property: "og:description",
        content: "Update your study preferences, availability and daily study goal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const LEVELS = ["High school", "College", "University", "Self-study", "Other"];

function SettingsPage() {
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const signOut = useSignOut();

  const [fullName, setFullName] = useState("");
  const [level, setLevel] = useState("High school");
  const [minutes, setMinutes] = useState("60");
  const [days, setDays] = useState<string[]>([]);
  const [startHour, setStartHour] = useState("17");
  const [endHour, setEndHour] = useState("21");
  const [goals, setGoals] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    setFullName(p.full_name ?? "");
    setLevel(p.education_level ?? "High school");
    setMinutes(String(p.daily_study_minutes));
    setDays(p.preferred_days);
    setStartHour(String(p.preferred_start_hour));
    setEndHour(String(p.preferred_end_hour));
    setGoals(p.study_goals ?? "");
  }, [profile.data]);

  async function save() {
    const nameError = requireText(fullName, "Name", 80);
    if (nameError) {
      setError(nameError);
      return;
    }
    const mins = Number(minutes);
    const start = Number(startHour);
    const end = Number(endHour);
    if (!Number.isFinite(mins) || mins < 10 || mins > 720) {
      setError("Daily study time must be between 10 and 720 minutes.");
      return;
    }
    if (end <= start) {
      setError("End hour must be after start hour.");
      return;
    }
    setError(null);
    try {
      await updateProfile.mutateAsync({
        full_name: fullName.trim(),
        education_level: level,
        daily_study_minutes: Math.round(mins),
        preferred_days: days,
        preferred_start_hour: start,
        preferred_end_hour: end,
        study_goals: goals.trim() || null,
      });
      toast.success("Settings saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    }
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <PageHeader title="Settings" description="Your profile and study preferences." />

        {profile.isLoading ? (
          <LoadingState rows={2} />
        ) : profile.isError ? (
          <ErrorState onRetry={() => profile.refetch()} />
        ) : (
          <section className="surface-card space-y-4 p-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Education level</Label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minutes">Daily study minutes</Label>
                <Input
                  id="minutes"
                  type="number"
                  min={10}
                  max={720}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start">Start hour</Label>
                <Input
                  id="start"
                  type="number"
                  min={0}
                  max={23}
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End hour</Label>
                <Input
                  id="end"
                  type="number"
                  min={1}
                  max={24}
                  value={endHour}
                  onChange={(e) => setEndHour(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Preferred study days</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(({ key, label }) => {
                  const active = days.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setDays(active ? days.filter((d) => d !== key) : [...days, key])
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        active
                          ? "border-primary bg-primary-soft text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="goals">Study goals</Label>
              <Textarea
                id="goals"
                rows={3}
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={updateProfile.isPending}>
                {updateProfile.isPending ? "Saving…" : "Save changes"}
              </Button>
              <Button variant="outline" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
