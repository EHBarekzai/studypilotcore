export const PRIORITIES = ["low", "medium", "high"] as const;
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const STATUSES = ["todo", "in_progress", "done"] as const;

export const SUBJECT_COLORS = [
  "teal",
  "violet",
  "amber",
  "rose",
  "sky",
  "emerald",
  "indigo",
  "orange",
] as const;

export const SUBJECT_ICONS = [
  "book",
  "calculator",
  "flask",
  "globe",
  "code",
  "palette",
  "music",
  "dumbbell",
] as const;

export type SubjectColor = (typeof SUBJECT_COLORS)[number];

const COLOR_CLASS: Record<string, string> = {
  teal: "bg-teal-500/15 text-teal-600 dark:text-teal-300",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  sky: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  indigo: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
  orange: "bg-orange-500/15 text-orange-600 dark:text-orange-300",
};

export function colorClass(color?: string | null) {
  return COLOR_CLASS[color ?? "teal"] ?? COLOR_CLASS["teal"]!;
}

export function priorityClass(priority: string) {
  if (priority === "high") return "bg-destructive/10 text-destructive";
  if (priority === "low") return "bg-muted text-muted-foreground";
  return "bg-amber-500/15 text-amber-600 dark:text-amber-300";
}

export function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function todayISO() {
  const now = new Date();
  const tz = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tz).toISOString().slice(0, 10);
}

/** Whole days from today to an ISO date (negative = in the past). */
export function daysUntil(isoDate: string) {
  const target = new Date(`${isoDate}T00:00:00`);
  const today = new Date(`${todayISO()}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatDate(isoDate?: string | null) {
  if (!isoDate) return "No date";
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(time?: string | null) {
  if (!time) return null;
  const [h, m] = time.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m ?? 0), 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function countdownLabel(isoDate: string) {
  const diff = daysUntil(isoDate);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1) return `In ${diff} days`;
  if (diff === -1) return "Yesterday";
  return `${Math.abs(diff)} days ago`;
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export type ValidationErrors = Record<string, string>;

export function requireText(value: string, label: string, max = 120): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  if (trimmed.length > max) return `${label} must be under ${max} characters.`;
  return null;
}
