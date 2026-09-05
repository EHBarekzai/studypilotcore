import type { AiActivity, Exam, StudySession, Subject, Task } from "@/lib/data";
import { todayISO } from "@/lib/study";

export type DayPoint = {
  date: string;
  label: string;
  minutes: number;
  sessions: number;
  tasksDone: number;
};

export type SubjectPerformance = {
  id: string;
  name: string;
  color: string;
  minutes: number;
  tasksTotal: number;
  tasksDone: number;
  completion: number;
  quizAverage: number | null;
  exams: number;
};

function isoOf(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function shiftDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoOf(d);
}

function pctChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export type Analytics = ReturnType<typeof buildAnalytics>;

export function buildAnalytics(input: {
  tasks: Task[];
  exams: Exam[];
  sessions: StudySession[];
  subjects: Subject[];
  activity: AiActivity[];
}) {
  const { tasks, exams, sessions, subjects, activity } = input;
  const today = todayISO();

  /* ------------------------------- daily series ------------------------------ */
  const minutesByDay = new Map<string, number>();
  const countByDay = new Map<string, number>();
  for (const s of sessions) {
    const day = isoOf(s.started_at);
    minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + s.duration_minutes);
    countByDay.set(day, (countByDay.get(day) ?? 0) + 1);
  }
  const tasksDoneByDay = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === "done" && t.completed_at) {
      const day = isoOf(t.completed_at);
      tasksDoneByDay.set(day, (tasksDoneByDay.get(day) ?? 0) + 1);
    }
  }

  const series = (length: number): DayPoint[] =>
    Array.from({ length }, (_, i) => {
      const date = shiftDays(today, -(length - 1 - i));
      return {
        date,
        label: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        minutes: minutesByDay.get(date) ?? 0,
        sessions: countByDay.get(date) ?? 0,
        tasksDone: tasksDoneByDay.get(date) ?? 0,
      };
    });

  const last7 = series(7);
  const last30 = series(30);

  const sumRange = (from: string, to: string) => {
    let minutes = 0;
    let count = 0;
    let done = 0;
    for (const [day, value] of minutesByDay) {
      if (day >= from && day <= to) minutes += value;
    }
    for (const [day, value] of countByDay) {
      if (day >= from && day <= to) count += value;
    }
    for (const [day, value] of tasksDoneByDay) {
      if (day >= from && day <= to) done += value;
    }
    return { minutes, sessions: count, tasksDone: done };
  };

  const thisWeek = sumRange(shiftDays(today, -6), today);
  const lastWeek = sumRange(shiftDays(today, -13), shiftDays(today, -7));
  const thisMonth = sumRange(shiftDays(today, -29), today);
  const lastMonth = sumRange(shiftDays(today, -59), shiftDays(today, -30));

  /* ---------------------------------- streaks -------------------------------- */
  const studyDays = new Set([...minutesByDay.entries()].filter(([, m]) => m > 0).map(([d]) => d));
  let currentStreak = 0;
  for (let i = 0; i < 400; i += 1) {
    const day = shiftDays(today, -i);
    if (studyDays.has(day)) currentStreak += 1;
    else if (i > 0 || !studyDays.has(today)) break;
  }
  let bestStreak = 0;
  let run = 0;
  const sortedDays = [...studyDays].sort();
  sortedDays.forEach((day, index) => {
    const prev = sortedDays[index - 1];
    run = prev && shiftDays(prev, 1) === day ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
  });

  /* ------------------------------- ai activity ------------------------------- */
  const quizzes = activity.filter((a) => a.kind === "quiz" && a.total);
  const quizScores = quizzes.map((q) => Math.round(((q.score ?? 0) / (q.total || 1)) * 100));
  const quizAverage = quizScores.length
    ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
    : null;
  const quizTrend = quizzes
    .slice()
    .reverse()
    .map((q, i) => ({
      label: `#${i + 1}`,
      score: Math.round(((q.score ?? 0) / (q.total || 1)) * 100),
      date: isoOf(q.created_at),
    }));
  const flashcardActivity = activity.filter((a) => a.kind === "flashcards");
  const cardsGenerated = flashcardActivity.reduce((sum, a) => sum + (a.total ?? 0), 0);
  const homeworkSolved = activity
    .filter((a) => a.kind === "homework")
    .reduce((sum, a) => sum + (a.total ?? 1), 0);

  /* ---------------------------- subject performance -------------------------- */
  const quizBySubject = new Map<string, number[]>();
  for (const q of quizzes) {
    if (!q.subject_id) continue;
    const list = quizBySubject.get(q.subject_id) ?? [];
    list.push(Math.round(((q.score ?? 0) / (q.total || 1)) * 100));
    quizBySubject.set(q.subject_id, list);
  }

  const perSubject: SubjectPerformance[] = subjects
    .filter((s) => !s.archived)
    .map((subject) => {
      const subjectTasks = tasks.filter((t) => t.subject_id === subject.id);
      const tasksDone = subjectTasks.filter((t) => t.status === "done").length;
      const minutes = sessions
        .filter((s) => s.subject_id === subject.id)
        .reduce((sum, s) => sum + s.duration_minutes, 0);
      const scores = quizBySubject.get(subject.id) ?? [];
      return {
        id: subject.id,
        name: subject.name,
        color: subject.color,
        minutes,
        tasksTotal: subjectTasks.length,
        tasksDone,
        completion: subjectTasks.length ? Math.round((tasksDone / subjectTasks.length) * 100) : 0,
        quizAverage: scores.length
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null,
        exams: exams.filter((e) => e.subject_id === subject.id).length,
      };
    })
    .sort((a, b) => b.minutes - a.minutes);

  /* ----------------------------------- totals -------------------------------- */
  const totalMinutes = sessions.reduce((sum, s) => sum + s.duration_minutes, 0);
  const tasksDoneTotal = tasks.filter((t) => t.status === "done").length;
  const overdue = tasks.filter(
    (t) => t.status !== "done" && t.due_date && t.due_date < today,
  ).length;
  const upcomingExams = exams.filter((e) => e.exam_date >= today).length;

  return {
    today,
    last7,
    last30,
    totals: {
      totalMinutes,
      sessions: sessions.length,
      tasksTotal: tasks.length,
      tasksDone: tasksDoneTotal,
      completion: tasks.length ? Math.round((tasksDoneTotal / tasks.length) * 100) : 0,
      overdue,
      upcomingExams,
      examsTotal: exams.length,
      subjects: subjects.filter((s) => !s.archived).length,
      avgMinutesPerDay: Math.round(thisMonth.minutes / 30),
    },
    streaks: { current: currentStreak, best: bestStreak, activeDays: studyDays.size },
    comparisons: {
      week: {
        current: thisWeek,
        previous: lastWeek,
        minutesChange: pctChange(thisWeek.minutes, lastWeek.minutes),
        tasksChange: pctChange(thisWeek.tasksDone, lastWeek.tasksDone),
      },
      month: {
        current: thisMonth,
        previous: lastMonth,
        minutesChange: pctChange(thisMonth.minutes, lastMonth.minutes),
        tasksChange: pctChange(thisMonth.tasksDone, lastMonth.tasksDone),
      },
    },
    ai: {
      quizAttempts: quizzes.length,
      quizAverage,
      quizBest: quizScores.length ? Math.max(...quizScores) : null,
      quizTrend,
      flashcardDecks: flashcardActivity.length,
      cardsGenerated,
      homeworkSolved,
      totalActions: activity.length,
    },
    perSubject,
  };
}
