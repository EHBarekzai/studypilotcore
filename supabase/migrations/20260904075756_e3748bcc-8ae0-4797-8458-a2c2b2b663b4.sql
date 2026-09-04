CREATE TABLE public.ai_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic text,
  score integer,
  total integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_activity TO authenticated;
GRANT ALL ON public.ai_activity TO service_role;
ALTER TABLE public.ai_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai_activity" ON public.ai_activity FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER ai_activity_updated_at BEFORE UPDATE ON public.ai_activity FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX ai_activity_user_created_idx ON public.ai_activity (user_id, created_at DESC);

CREATE TABLE public.study_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_files TO authenticated;
GRANT ALL ON public.study_files TO service_role;
ALTER TABLE public.study_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study_files" ON public.study_files FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER study_files_updated_at BEFORE UPDATE ON public.study_files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX study_files_user_created_idx ON public.study_files (user_id, created_at DESC);

CREATE POLICY "study uploads read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'study-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "study uploads insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'study-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "study uploads update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'study-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "study uploads delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'study-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);