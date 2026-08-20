import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateProfile } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const LEVELS = ["High school", "Undergraduate", "Postgraduate", "Self-study"];
const DAYS = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];
const STEPS = ["You", "Subjects", "Schedule", "Goals"];

function Onboarding() {
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [level, setLevel] = useState(LEVELS[1]);
  const [subjectInput, setSubjectInput] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [dailyMinutes, setDailyMinutes] = useState(90);
  const [days, setDays] = useState<string[]>(["mon", "tue", "wed", "thu", "fri"]);
  const [startHour, setStartHour] = useState(17);
  const [endHour, setEndHour] = useState(21);
  const [goals, setGoals] = useState("");

  function addSubject() {
    const name = subjectInput.trim();
    if (!name) return;
    if (!subjects.includes(name)) setSubjects([...subjects, name]);
    setSubjectInput("");
  }

  async function finish(skip = false) {
    setSaving(true);
    try {
      if (skip) {
        await updateProfile.mutateAsync({ onboarding_completed: true });
      } else {
        await updateProfile.mutateAsync({
          full_name: fullName.trim() || null,
          education_level: level ?? null,
          daily_study_minutes: dailyMinutes,
          preferred_days: days,
          preferred_start_hour: startHour,
          preferred_end_hour: endHour,
          study_goals: goals.trim() || null,
          onboarding_completed: true,
        });
        if (subjects.length) {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData.user?.id;
          if (userId) {
            const { error } = await supabase
              .from("subjects")
              .insert(subjects.map((name) => ({ name, user_id: userId })));
            if (error) throw new Error(error.message);
          }
        }
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your setup.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-6">
      <div className="flex items-center justify-between">
        <Brand />
        <Button variant="ghost" size="sm" onClick={() => finish(true)} disabled={saving}>
          Skip for now
        </Button>
      </div>

      <div className="mt-6">
        <Progress value={((step + 1) / STEPS.length) * 100} />
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
      </div>

      <div className="surface-card mt-5 flex-1 space-y-5 p-6">
        {step === 0 && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">Let's set up your plan</h1>
              <p className="text-sm text-muted-foreground">A few quick questions — under a minute.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">What should we call you?</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label>Education level</Label>
              <div className="grid grid-cols-2 gap-2">
                {LEVELS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLevel(option)}
                    className={cn(
                      "rounded-xl border p-3 text-sm font-medium transition-colors",
                      level === option
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">What are you studying?</h1>
              <p className="text-sm text-muted-foreground">Add the subjects you want to track.</p>
            </div>
            <div className="flex gap-2">
              <Input
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSubject();
                  }
                }}
                placeholder="e.g. Calculus"
              />
              <Button type="button" onClick={addSubject}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {subjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No subjects yet.</p>
              ) : (
                subjects.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSubjects(subjects.filter((s) => s !== name))}
                    className="rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary"
                  >
                    {name} ×
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">When do you study?</h1>
              <p className="text-sm text-muted-foreground">
                We'll build plans that respect your real availability.
              </p>
            </div>
            <div className="space-y-3">
              <Label>Daily study time: {dailyMinutes} minutes</Label>
              <Slider
                value={[dailyMinutes]}
                min={15}
                max={360}
                step={15}
                onValueChange={([value]) => setDailyMinutes(value ?? 60)}
              />
            </div>
            <div className="space-y-2">
              <Label>Preferred days</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setDays(
                        days.includes(value) ? days.filter((d) => d !== value) : [...days, value],
                      )
                    }
                    className={cn(
                      "min-w-12 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                      days.includes(value)
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start-hour">Start hour</Label>
                <Input
                  id="start-hour"
                  type="number"
                  min={0}
                  max={23}
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-hour">End hour</Label>
                <Input
                  id="end-hour"
                  type="number"
                  min={1}
                  max={24}
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value))}
                />
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold">What are you aiming for?</h1>
              <p className="text-sm text-muted-foreground">
                Your goals help prioritise tasks and revision.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="goals">Study goals</Label>
              <Textarea
                id="goals"
                rows={5}
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="e.g. Pass the January calculus exam and keep up with weekly labs."
              />
            </div>
          </>
        )}

        <div className="flex gap-3 pt-2">
          {step > 0 ? (
            <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <Button className="flex-1" onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => finish(false)} disabled={saving}>
              {saving ? "Saving…" : "Start planning"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
