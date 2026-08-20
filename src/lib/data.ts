import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Subject = Database["public"]["Tables"]["subjects"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Exam = Database["public"]["Tables"]["exams"]["Row"];
export type StudySession = Database["public"]["Tables"]["study_sessions"]["Row"];
export type StudyPlan = Database["public"]["Tables"]["study_plans"]["Row"];

export type TaskInput = Database["public"]["Tables"]["tasks"]["Insert"];
export type ExamInput = Database["public"]["Tables"]["exams"]["Insert"];

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("You need to be signed in.");
  return data.user.id;
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/* ---------------------------------- profile --------------------------------- */

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const userId = await currentUserId();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as Profile | null;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("profiles")
          .upsert({ id: userId, ...patch })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

/* --------------------------------- subjects --------------------------------- */

export function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: async () =>
      unwrap(await supabase.from("subjects").select("*").order("name", { ascending: true })),
  });
}

export function useCreateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string }) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("subjects")
          .insert({ user_id: userId, name: input.name, color: input.color ?? "teal" })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["exams"] });
    },
  });
}

/* ----------------------------------- tasks ---------------------------------- */

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("tasks")
          .select("*")
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }),
      ),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TaskInput, "user_id">) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("tasks")
          .insert({ ...input, user_id: userId })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) =>
      unwrap(await supabase.from("tasks").update(patch).eq("id", id).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

/* ----------------------------------- exams ---------------------------------- */

export function useExams() {
  return useQuery({
    queryKey: ["exams"],
    queryFn: async () =>
      unwrap(await supabase.from("exams").select("*").order("exam_date", { ascending: true })),
  });
}

export function useCreateExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ExamInput, "user_id">) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("exams")
          .insert({ ...input, user_id: userId })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exams"] }),
  });
}

export function useDeleteExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exams").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exams"] }),
  });
}

/* ------------------------------ study sessions ------------------------------ */

export function useStudySessions() {
  return useQuery({
    queryKey: ["study_sessions"],
    queryFn: async () =>
      unwrap(
        await supabase
          .from("study_sessions")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(200),
      ),
  });
}

export function useLogStudySession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      duration_minutes: number;
      subject_id?: string | null;
      task_id?: string | null;
      notes?: string | null;
    }) => {
      const userId = await currentUserId();
      const startedAt = new Date(Date.now() - input.duration_minutes * 60_000).toISOString();
      return unwrap(
        await supabase
          .from("study_sessions")
          .insert({
            user_id: userId,
            duration_minutes: input.duration_minutes,
            subject_id: input.subject_id ?? null,
            task_id: input.task_id ?? null,
            notes: input.notes ?? null,
            started_at: startedAt,
            ended_at: new Date().toISOString(),
          })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_sessions"] }),
  });
}

/* ------------------------------- study plans -------------------------------- */

export function useStudyPlans() {
  return useQuery({
    queryKey: ["study_plans"],
    queryFn: async () =>
      unwrap(
        await supabase.from("study_plans").select("*").order("start_date", { ascending: false }),
      ),
  });
}
