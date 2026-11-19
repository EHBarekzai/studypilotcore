import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ----------------------------- shared helpers ------------------------------ */

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const HORIZON_DAYS = 7;

export type PlannerScope = "day" | "week";

type ProfileRow = {
  daily_study_minutes: number;
  preferred_days: string[];
  preferred_start_hour: number;
  preferred_end_hour: number;
  study_goals: string | null;
};

type GeneratedSession = {
  date: string;
  start_time: string;
  duration_minutes: number;
  title: string;
  focus?: string;
  subject?: string;
  task?: string;
  exam?: string;
};

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

function dayKey(iso: string) {
  return DAY_KEYS[new Date(`${iso}T00:00:00`).getDay()]!;
}

function clampHour(value: number, fallback: number) {
  return Number.isFinite(value) && value >= 0 && value <= 23 ? value : fallback;
}

function hhmm(minutesFromMidnight: number) {
  const m = Math.max(0, Math.min(23 * 60 + 55, Math.round(minutesFromMidnight)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function toMinutes(time?: string | null) {
  if (!time) return null;
  const [h, m] = time.split(":");
  const total = Number(h) * 60 + Number(m ?? 0);
  return Number.isFinite(total) ? total : null;
}

/** Human-readable message for a Lovable AI Gateway failure status. */

/* ------------------------------ AI generation ------------------------------ */

export const generateStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scope?: PlannerScope }) => ({
    scope: input?.scope === "day" ? ("day" as const) : ("week" as const),
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { consumeUsage } = await import("./billing.server");
    await consumeUsage(supabase, "ai_plans");

    const today = isoDate(new Date());
    const days = data.scope === "day" ? 1 : HORIZON_DAYS;
    const endDate = addDays(today, days - 1);

    const [profileRes, subjectsRes, tasksRes, examsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("daily_study_minutes, preferred_days, preferred_start_hour, preferred_end_hour, study_goals")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("subjects").select("id, name, difficulty, priority").eq("archived", false),
      supabase
        .from("tasks")
        .select("id, title, subject_id, due_date, estimated_minutes, priority, difficulty, status")
        .neq("status", "done"),
      supabase.from("exams").select("id, title, subject_id, exam_date, difficulty, topics").gte("exam_date", today),
    ]);

    for (const res of [profileRes, subjectsRes, tasksRes, examsRes]) {
      if (res.error) throw new Error(res.error.message);
    }

    const profile: ProfileRow = {
      daily_study_minutes: profileRes.data?.daily_study_minutes ?? 60,
      preferred_days: profileRes.data?.preferred_days?.length
        ? profileRes.data.preferred_days
        : ["mon", "tue", "wed", "thu", "fri"],
      preferred_start_hour: clampHour(profileRes.data?.preferred_start_hour ?? 17, 17),
      preferred_end_hour: clampHour(profileRes.data?.preferred_end_hour ?? 21, 21),
      study_goals: profileRes.data?.study_goals ?? null,
    };

    const subjects = subjectsRes.data ?? [];
    const tasks = tasksRes.data ?? [];
    const exams = examsRes.data ?? [];

    if (!subjects.length && !tasks.length && !exams.length) {
      throw new Error("Add at least one subject, task or exam before generating a plan.");
    }

    const subjectName = new Map(subjects.map((s) => [s.id, s.name]));

    // Compact, structured prompt input — keeps token cost predictable.
    const payload = {
      today,
      end_date: endDate,
      daily_minutes: profile.daily_study_minutes,
      study_days: profile.preferred_days,
      window: `${String(profile.preferred_start_hour).padStart(2, "0")}:00-${String(profile.preferred_end_hour).padStart(2, "0")}:00`,
      goals: profile.study_goals?.slice(0, 200) ?? null,
      subjects: subjects.slice(0, 30).map((s) => ({ n: s.name, d: s.difficulty, p: s.priority })),
      tasks: tasks.slice(0, 40).map((t) => ({
        t: t.title.slice(0, 80),
        s: t.subject_id ? subjectName.get(t.subject_id) ?? null : null,
        due: t.due_date,
        min: t.estimated_minutes,
        p: t.priority,
        d: t.difficulty,
      })),
      exams: exams.slice(0, 20).map((e) => ({
        t: e.title.slice(0, 80),
        s: e.subject_id ? subjectName.get(e.subject_id) ?? null : null,
        date: e.exam_date,
        d: e.difficulty,
        topics: (e.topics ?? []).slice(0, 8),
      })),
    };

    const system = [
      "You are a study scheduler. Output ONLY JSON matching:",
      '{"sessions":[{"date":"YYYY-MM-DD","start_time":"HH:MM","duration_minutes":25,"title":"","focus":"","subject":"","task":"","exam":""}]}',
      "Rules: schedule only on study_days between the given window; never exceed daily_minutes per date;",
      "sessions are 25-90 minutes and must not overlap; prioritise nearest deadlines, then high priority, then hard difficulty;",
      "finish task work before its due date and exam revision before the exam date;",
      "subject/task/exam must copy an exact name from the input or be omitted; keep titles under 60 chars.",
    ].join(" ");

    const { aiChatJson } = await import("./ai.server");
    const parsed = (await aiChatJson(system, JSON.stringify(payload), "planner")) as {
      sessions?: GeneratedSession[];
    };

    const subjectByName = new Map(subjects.map((s) => [s.name.toLowerCase(), s.id]));
    const taskByTitle = new Map(tasks.map((t) => [t.title.toLowerCase(), t]));
    const examByTitle = new Map(exams.map((e) => [e.title.toLowerCase(), e]));

    const perDayMinutes = new Map<string, number>();
    const rows = (parsed.sessions ?? [])
      .slice(0, 60)
      .map((s) => {
        if (typeof s?.date !== "string" || s.date < today || s.date > endDate) return null;
        if (!profile.preferred_days.includes(dayKey(s.date))) return null;

        const duration = Math.max(15, Math.min(120, Math.round(Number(s.duration_minutes) || 45)));
        const used = perDayMinutes.get(s.date) ?? 0;
        if (used + duration > profile.daily_study_minutes + 15) return null;
        perDayMinutes.set(s.date, used + duration);

        const startMinutes =
          toMinutes(s.start_time) ?? profile.preferred_start_hour * 60 + used;
        const task = s.task ? taskByTitle.get(s.task.toLowerCase()) : undefined;
        const exam = s.exam ? examByTitle.get(s.exam.toLowerCase()) : undefined;
        const subjectId =
          (s.subject ? subjectByName.get(s.subject.toLowerCase()) : undefined) ??
          task?.subject_id ??
          exam?.subject_id ??
          null;

        return {
          user_id: userId,
          session_date: s.date,
          start_time: hhmm(startMinutes),
          duration_minutes: duration,
          title: (s.title || task?.title || exam?.title || "Study session").slice(0, 80),
          focus: s.focus ? s.focus.slice(0, 240) : null,
          subject_id: subjectId,
          task_id: task?.id ?? null,
          exam_id: exam?.id ?? null,
          status: "planned",
          source: "ai",
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (!rows.length) throw new Error("The AI planner produced no usable sessions. Please retry.");

    // Replace only future AI-generated sessions that are still pending.
    const { error: deleteError } = await supabase
      .from("planned_sessions")
      .delete()
      .eq("user_id", userId)
      .eq("status", "planned")
      .eq("source", "ai")
      .gte("session_date", today)
      .lte("session_date", endDate);
    if (deleteError) throw new Error(deleteError.message);

    const { error: insertError } = await supabase.from("planned_sessions").insert(rows);
    if (insertError) throw new Error(insertError.message);

    return { created: rows.length, from: today, to: endDate };
  });

/* ---------------------------- smart reschedule ----------------------------- */

export const smartReschedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { consumeUsage } = await import("./billing.server");
    await consumeUsage(supabase, "reschedules");
    const today = isoDate(new Date());

    const [profileRes, sessionsRes, tasksRes, examsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("daily_study_minutes, preferred_days, preferred_start_hour, preferred_end_hour")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("planned_sessions").select("*").order("session_date", { ascending: true }),
      supabase.from("tasks").select("id, due_date"),
      supabase.from("exams").select("id, exam_date"),
    ]);
    for (const res of [profileRes, sessionsRes, tasksRes, examsRes]) {
      if (res.error) throw new Error(res.error.message);
    }

    const dailyMinutes = profileRes.data?.daily_study_minutes ?? 60;
    const preferredDays = profileRes.data?.preferred_days?.length
      ? profileRes.data.preferred_days
      : ["mon", "tue", "wed", "thu", "fri"];
    const startHour = clampHour(profileRes.data?.preferred_start_hour ?? 17, 17);

    const sessions = sessionsRes.data ?? [];
    const missed = sessions.filter((s) => s.status === "planned" && s.session_date < today);
    if (!missed.length) return { moved: 0, unplaceable: 0 };

    const taskDue = new Map((tasksRes.data ?? []).map((t) => [t.id, t.due_date]));
    const examDate = new Map((examsRes.data ?? []).map((e) => [e.id, e.exam_date]));

    // Remaining capacity per upcoming study day, accounting for existing sessions.
    const horizon = Array.from({ length: 21 }, (_, i) => addDays(today, i)).filter((d) =>
      preferredDays.includes(dayKey(d)),
    );
    const load = new Map<string, number>();
    for (const day of horizon) load.set(day, 0);
    for (const s of sessions) {
      if (s.session_date >= today && s.status !== "skipped" && load.has(s.session_date)) {
        load.set(s.session_date, (load.get(s.session_date) ?? 0) + s.duration_minutes);
      }
    }

    const deadlineOf = (s: (typeof sessions)[number]) =>
      (s.exam_id ? examDate.get(s.exam_id) : null) ??
      (s.task_id ? taskDue.get(s.task_id) : null) ??
      null;

    const ordered = [...missed].sort((a, b) => {
      const da = deadlineOf(a) ?? "9999-12-31";
      const db = deadlineOf(b) ?? "9999-12-31";
      if (da !== db) return da < db ? -1 : 1;
      return a.session_date < b.session_date ? -1 : 1;
    });

    let moved = 0;
    let unplaceable = 0;

    for (const session of ordered) {
      const deadline = deadlineOf(session);
      const candidates = horizon.filter((day) => (!deadline || day <= deadline));
      let target = candidates.find(
        (day) => (load.get(day) ?? 0) + session.duration_minutes <= dailyMinutes,
      );
      // Deadline is too tight for a free slot: use the last day before it anyway.
      if (!target) target = candidates[0] ?? horizon.find((d) => (load.get(d) ?? 0) + session.duration_minutes <= dailyMinutes);
      if (!target) {
        unplaceable += 1;
        continue;
      }

      const used = load.get(target) ?? 0;
      const { error } = await supabase
        .from("planned_sessions")
        .update({
          session_date: target,
          start_time: hhmm(startHour * 60 + used),
        })
        .eq("id", session.id);
      if (error) throw new Error(error.message);

      load.set(target, used + session.duration_minutes);
      moved += 1;
    }

    return { moved, unplaceable };
  });
