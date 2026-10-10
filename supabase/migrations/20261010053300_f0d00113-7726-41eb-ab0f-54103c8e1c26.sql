-- Billing-cycle start for a user (anchored to subscription start, plan period length)
CREATE OR REPLACE FUNCTION public.billing_cycle_start(_user_id uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (s.started_at + make_interval(days => (floor(extract(epoch FROM (now() - s.started_at)) / 86400 / GREATEST(p.period_days,1))::int * GREATEST(p.period_days,1))))::date
  FROM public.subscriptions s JOIN public.plans p ON p.id = s.plan_id WHERE s.user_id = _user_id
$$;
REVOKE ALL ON FUNCTION public.billing_cycle_start(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_pdf_summary(_size_bytes bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _plan text; _limits jsonb; _limit integer; _mb integer;
  _period date; _new integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  _plan := public.effective_plan(_uid);
  IF _plan IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_subscription'); END IF;
  SELECT limits INTO _limits FROM public.plans WHERE id = _plan;
  IF COALESCE((_limits->>'pdf_summarizer')::boolean, false) = false THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'disabled', 'plan', _plan);
  END IF;
  _mb := (_limits->>'summary_file_mb')::integer;
  IF _mb IS NOT NULL AND COALESCE(_size_bytes,0) > _mb::bigint * 1024 * 1024 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_large', 'max_mb', _mb);
  END IF;
  _limit := (_limits->>'pdf_summaries')::integer;
  _period := COALESCE(public.billing_cycle_start(_uid), date_trunc('month', now())::date);
  INSERT INTO public.usage_counters AS u (user_id, metric, period_start, count)
  VALUES (_uid, 'pdf_summaries', _period, 1)
  ON CONFLICT (user_id, metric, period_start)
  DO UPDATE SET count = u.count + 1, updated_at = now()
    WHERE _limit IS NULL OR u.count + 1 <= _limit
  RETURNING count INTO _new;
  IF _new IS NULL OR (_limit IS NOT NULL AND _new > _limit) THEN
    IF _new IS NOT NULL THEN
      UPDATE public.usage_counters SET count = count - 1 WHERE user_id = _uid AND metric = 'pdf_summaries' AND period_start = _period;
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'limit', 'limit', _limit);
  END IF;
  RETURN jsonb_build_object('ok', true, 'used', _new, 'limit', _limit, 'period_start', _period);
END; $$;
REVOKE ALL ON FUNCTION public.consume_pdf_summary(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_pdf_summary(bigint) TO authenticated;

-- Refund only via server (service role) when generation never started
CREATE OR REPLACE FUNCTION public.refund_pdf_summary(_user_id uuid, _period date)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.usage_counters SET count = GREATEST(count - 1, 0), updated_at = now()
  WHERE user_id = _user_id AND metric = 'pdf_summaries' AND period_start = _period
$$;
REVOKE ALL ON FUNCTION public.refund_pdf_summary(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_pdf_summary(uuid, date) TO service_role;

CREATE OR REPLACE FUNCTION public.pdf_summary_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _plan text; _limits jsonb; _period date; _used integer; _days integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  _plan := public.effective_plan(_uid);
  IF _plan IS NULL THEN RETURN jsonb_build_object('active', false); END IF;
  SELECT limits, period_days INTO _limits, _days FROM public.plans WHERE id = _plan;
  _period := COALESCE(public.billing_cycle_start(_uid), date_trunc('month', now())::date);
  SELECT count INTO _used FROM public.usage_counters WHERE user_id = _uid AND metric = 'pdf_summaries' AND period_start = _period;
  RETURN jsonb_build_object('active', true, 'plan', _plan,
    'enabled', COALESCE((_limits->>'pdf_summarizer')::boolean, false),
    'limit', _limits->'pdf_summaries', 'max_mb', _limits->'summary_file_mb',
    'used', COALESCE(_used, 0), 'period_start', _period, 'resets_on', _period + GREATEST(_days,1));
END; $$;
REVOKE ALL ON FUNCTION public.pdf_summary_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pdf_summary_status() TO authenticated;

-- Saved summaries
CREATE TABLE public.pdf_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  source_name text,
  scope text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pdf_summaries_user_idx ON public.pdf_summaries(user_id, created_at DESC);
GRANT SELECT, DELETE ON public.pdf_summaries TO authenticated;
GRANT ALL ON public.pdf_summaries TO service_role;
ALTER TABLE public.pdf_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own summaries read" ON public.pdf_summaries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own summaries delete" ON public.pdf_summaries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- User requests
CREATE TABLE public.user_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('suggestion','feature','complaint','bug','feedback')),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  attachment_path text,
  attachment_name text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_review','planned','resolved','rejected')),
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_requests_user_idx ON public.user_requests(user_id, created_at DESC);
CREATE INDEX user_requests_created_idx ON public.user_requests(created_at DESC);
GRANT SELECT, INSERT ON public.user_requests TO authenticated;
GRANT ALL ON public.user_requests TO service_role;
ALTER TABLE public.user_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own requests read" ON public.user_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own requests insert" ON public.user_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'new' AND admin_reply IS NULL AND replied_at IS NULL
    AND (attachment_path IS NULL OR split_part(attachment_path, '/', 1) = auth.uid()::text));
CREATE TRIGGER user_requests_updated_at BEFORE UPDATE ON public.user_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Admin-only internal notes (no user access)
CREATE TABLE public.user_request_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.user_requests(id) ON DELETE CASCADE,
  author_email text,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.user_request_notes TO service_role;
ALTER TABLE public.user_request_notes ENABLE ROW LEVEL SECURITY;

-- Personal notifications
CREATE TABLE public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_notifications_user_idx ON public.user_notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.user_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications mark read" ON public.user_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Request attachments bucket policies
CREATE POLICY "request attachments insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'request-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "request attachments read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'request-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);