import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { generateStudyPlan, smartReschedule, type PlannerScope } from "@/lib/planner.functions";

export type PlannedSession = Database["public"]["Tables"]["planned_sessions"]["Row"];
export type PlannedSessionInput = Database["public"]["Tables"]["planned_sessions"]["Insert"];

const KEY = ["planned_sessions"] as const;

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("You need to be signed in.");
  return data.user.id;
}

export function usePlannedSessions() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () =>
      unwrap(
        await supabase
          .from("planned_sessions")
          .select("*")
          .order("session_date", { ascending: true })
          .order("start_time", { ascending: true, nullsFirst: false }),
      ),
  });
}

export function useCreatePlannedSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<PlannedSessionInput, "user_id">) => {
      const userId = await currentUserId();
      return unwrap(
        await supabase
          .from("planned_sessions")
          .insert({ ...input, user_id: userId, source: input.source ?? "manual" })
          .select()
          .single(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdatePlannedSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<PlannedSession> & { id: string }) =>
      unwrap(await supabase.from("planned_sessions").update(patch).eq("id", id).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeletePlannedSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planned_sessions").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/**
 * Marks a planned session complete (or back to planned) and mirrors completed
 * work into `study_sessions` so Progress totals stay in sync.
 */
export function useCompletePlannedSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      session,
      completed,
      minutes,
    }: {
      session: PlannedSession;
      completed: boolean;
      minutes?: number;
    }) => {
      const userId = await currentUserId();
      const duration = Math.max(1, Math.round(minutes ?? session.duration_minutes));

      const updated = unwrap(
        await supabase
          .from("planned_sessions")
          .update({
            status: completed ? "completed" : "planned",
            completed_at: completed ? new Date().toISOString() : null,
            ...(completed ? { duration_minutes: duration } : {}),
          })
          .eq("id", session.id)
          .select()
          .single(),
      );

      if (completed) {
        const { error } = await supabase.from("study_sessions").insert({
          user_id: userId,
          subject_id: session.subject_id,
          task_id: session.task_id,
          duration_minutes: duration,
          notes: session.title,
          started_at: new Date(Date.now() - duration * 60_000).toISOString(),
          ended_at: new Date().toISOString(),
        });
        if (error) throw new Error(error.message);
      }

      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["study_sessions"] });
    },
  });
}

/** AI plan generation. Guarded so a second request can never run concurrently. */
export function useGeneratePlan() {
  const qc = useQueryClient();
  const generate = useServerFn(generateStudyPlan);
  const inFlight = useRef(false);

  return useMutation({
    mutationFn: async (scope: PlannerScope) => {
      if (inFlight.current) throw new Error("A plan is already being generated.");
      inFlight.current = true;
      try {
        return await generate({ data: { scope } });
      } finally {
        inFlight.current = false;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSmartReschedule() {
  const qc = useQueryClient();
  const reschedule = useServerFn(smartReschedule);
  const inFlight = useRef(false);

  return useMutation({
    mutationFn: async () => {
      if (inFlight.current) throw new Error("Reschedule already running.");
      inFlight.current = true;
      try {
        return await reschedule();
      } finally {
        inFlight.current = false;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
