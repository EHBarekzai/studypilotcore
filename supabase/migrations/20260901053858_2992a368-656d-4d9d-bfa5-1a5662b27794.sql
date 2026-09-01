CREATE TABLE public.planned_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL,
  session_date date NOT NULL,
  start_time time without time zone,
  duration_minutes integer NOT NULL DEFAULT 45,
  title text NOT NULL,
  focus text,
  status text NOT NULL DEFAULT 'planned',
  completed_at timestamp with time zone,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planned_sessions TO authenticated;
GRANT ALL ON public.planned_sessions TO service_role;

ALTER TABLE public.planned_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own planned_sessions" ON public.planned_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER planned_sessions_updated_at
  BEFORE UPDATE ON public.planned_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX planned_sessions_user_date_idx ON public.planned_sessions (user_id, session_date);