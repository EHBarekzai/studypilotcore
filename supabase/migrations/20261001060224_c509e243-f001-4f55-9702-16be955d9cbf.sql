
-- ROLES
CREATE TYPE public.app_role AS ENUM ('super_admin','admin','user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- PROFILES status
ALTER TABLE public.profiles ADD COLUMN account_status text NOT NULL DEFAULT 'active';

-- PLANS
CREATE TABLE public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  period_days integer NOT NULL DEFAULT 30,
  purchasable boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated, anon;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable" ON public.plans FOR SELECT TO authenticated, anon USING (true);
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.plans (id, name, price_cents, period_days, purchasable, sort_order, limits) VALUES
('trial','Free Trial',0,7,false,0,'{"homework":30,"image_questions":20,"pdfs":10,"file_mb":25,"flashcards":1000,"quizzes":10,"quiz_questions":20,"ai_plans":30,"reschedules":10,"tasks":100,"subjects":10,"exams":10,"pdf_exports":2,"ai_insights":5,"history_days":30,"analytics":"basic","priority":false}'),
('starter','Starter',499,30,true,1,'{"homework":30,"image_questions":20,"pdfs":10,"file_mb":25,"flashcards":1000,"quizzes":10,"quiz_questions":20,"ai_plans":30,"reschedules":10,"tasks":100,"subjects":10,"exams":10,"pdf_exports":2,"ai_insights":5,"history_days":30,"analytics":"basic","priority":false}'),
('pro','Pro',799,30,true,2,'{"homework":100,"image_questions":75,"pdfs":30,"file_mb":50,"flashcards":4000,"quizzes":40,"quiz_questions":50,"ai_plans":100,"reschedules":50,"tasks":500,"subjects":30,"exams":50,"pdf_exports":10,"ai_insights":30,"history_days":365,"analytics":"advanced","priority":false}'),
('ultimate','Ultimate',1199,30,true,3,'{"homework":250,"image_questions":200,"pdfs":75,"file_mb":50,"flashcards":10000,"quizzes":100,"quiz_questions":100,"ai_plans":250,"reschedules":150,"tasks":null,"subjects":null,"exams":null,"pdf_exports":null,"ai_insights":100,"history_days":null,"analytics":"full","priority":true}');

-- SUBSCRIPTIONS
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'trial',
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL,
  cancelled_at timestamptz,
  last_payment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription read" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PAYMENTS
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  order_id text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'noholdpay',
  provider_payment_id text UNIQUE,
  environment text NOT NULL DEFAULT 'test',
  plan_id text NOT NULL REFERENCES public.plans(id),
  fiat_amount numeric(10,2) NOT NULL,
  fiat_currency text NOT NULL DEFAULT 'USD',
  coin text,
  chain text,
  amount_received text,
  tx_hash text,
  status text NOT NULL DEFAULT 'pending',
  checkout_url text,
  error text,
  paid_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_user_idx ON public.payments(user_id, created_at DESC);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payments read" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id text NOT NULL UNIQUE,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- USAGE
CREATE TABLE public.usage_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric text NOT NULL,
  period_start date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, metric, period_start)
);
GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own usage read" ON public.usage_counters FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- AUDIT / NOTIFICATIONS / SETTINGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  category text NOT NULL DEFAULT 'admin',
  action text NOT NULL,
  target_user_id uuid,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON public.audit_logs(created_at DESC);
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active notifications read" ON public.notifications FOR SELECT TO authenticated USING (active);

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_settings (key, value) VALUES
('payments', '{"mode":"test","accepted_coins":[],"accepted_chains":[],"restrict_to_accepted":false}'),
('system', '{"maintenance_message":""}');

-- ENTITLEMENT HELPERS
CREATE OR REPLACE FUNCTION public.effective_plan(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.plan_id FROM public.subscriptions s
  JOIN public.profiles p ON p.id = s.user_id
  WHERE s.user_id = _user_id AND s.current_period_end > now()
    AND s.status IN ('trial','active','manual','cancelled')
    AND p.account_status = 'active'
$$;

CREATE OR REPLACE FUNCTION public.consume_usage(_metric text, _amount integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _plan text;
  _limit integer;
  _period date := date_trunc('month', now())::date;
  _new integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _amount < 1 THEN _amount := 1; END IF;
  _plan := public.effective_plan(_uid);
  IF _plan IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_subscription');
  END IF;
  SELECT (limits->>_metric)::integer INTO _limit FROM public.plans WHERE id = _plan;
  INSERT INTO public.usage_counters AS u (user_id, metric, period_start, count)
  VALUES (_uid, _metric, _period, _amount)
  ON CONFLICT (user_id, metric, period_start)
  DO UPDATE SET count = u.count + _amount, updated_at = now()
    WHERE _limit IS NULL OR u.count + _amount <= _limit
  RETURNING count INTO _new;
  IF _new IS NULL OR (_limit IS NOT NULL AND _new > _limit) THEN
    IF _new IS NOT NULL THEN
      UPDATE public.usage_counters SET count = count - _amount
      WHERE user_id = _uid AND metric = _metric AND period_start = _period;
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'limit', 'limit', _limit, 'plan', _plan);
  END IF;
  RETURN jsonb_build_object('ok', true, 'used', _new, 'limit', _limit, 'plan', _plan);
END; $$;
REVOKE ALL ON FUNCTION public.consume_usage(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_usage(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_item_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _plan text; _limit integer; _count integer; _metric text := TG_ARGV[0];
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF; -- server/service operations
  _plan := public.effective_plan(NEW.user_id);
  IF _plan IS NULL THEN
    RAISE EXCEPTION 'An active subscription is required. Your trial or plan has ended — choose a plan in Billing.';
  END IF;
  IF _metric = 'files' THEN
    SELECT (limits->>'file_mb')::integer, (limits->>'pdfs')::integer INTO _limit, _count FROM public.plans WHERE id = _plan;
    IF _limit IS NOT NULL AND NEW.size_bytes > _limit::bigint * 1024 * 1024 THEN
      RAISE EXCEPTION 'This file is larger than your plan allows (% MB).', _limit;
    END IF;
    IF NEW.mime_type = 'application/pdf' AND _count IS NOT NULL AND (
      SELECT count(*) FROM public.study_files WHERE user_id = NEW.user_id AND mime_type = 'application/pdf'
        AND created_at >= date_trunc('month', now())) >= _count THEN
      RAISE EXCEPTION 'You reached your monthly PDF limit (%). Upgrade for more.', _count;
    END IF;
    RETURN NEW;
  END IF;
  SELECT (limits->>_metric)::integer INTO _limit FROM public.plans WHERE id = _plan;
  IF _limit IS NULL THEN RETURN NEW; END IF;
  EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = $1', _metric) INTO _count USING NEW.user_id;
  IF _count >= _limit THEN
    RAISE EXCEPTION 'You reached your plan limit of % %. Upgrade to add more.', _limit, _metric;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_item_limit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tasks_limit BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.enforce_item_limit('tasks');
CREATE TRIGGER subjects_limit BEFORE INSERT ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.enforce_item_limit('subjects');
CREATE TRIGGER exams_limit BEFORE INSERT ON public.exams FOR EACH ROW EXECUTE FUNCTION public.enforce_item_limit('exams');
CREATE TRIGGER study_files_limit BEFORE INSERT ON public.study_files FOR EACH ROW EXECUTE FUNCTION public.enforce_item_limit('files');

-- Prevent users from changing their own account_status
CREATE OR REPLACE FUNCTION public.protect_account_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.account_status IS DISTINCT FROM OLD.account_status THEN
    NEW.account_status := OLD.account_status;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_protect_status BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_account_status();

-- New user: profile + 7-day trial + owner role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NULLIF(NEW.raw_user_meta_data->>'full_name',''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.subscriptions (user_id, plan_id, status, started_at, current_period_end)
  VALUES (NEW.id, 'trial', 'trial', now(), now() + interval '7 days')
  ON CONFLICT (user_id) DO NOTHING;
  IF lower(NEW.email) = 'erfanhussainbarekzai@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin'), (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

-- Backfill
INSERT INTO public.subscriptions (user_id, plan_id, status, started_at, current_period_end)
SELECT id, 'trial', 'trial', now(), now() + interval '7 days' FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.user_roles (user_id, role)
SELECT id, r.role FROM auth.users, (VALUES ('super_admin'::public.app_role), ('admin'::public.app_role)) AS r(role)
WHERE lower(email) = 'erfanhussainbarekzai@gmail.com'
ON CONFLICT DO NOTHING;

-- Cascade user deletion for study data
ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey, ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.subjects DROP CONSTRAINT subjects_user_id_fkey, ADD CONSTRAINT subjects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.tasks DROP CONSTRAINT tasks_user_id_fkey, ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.exams DROP CONSTRAINT exams_user_id_fkey, ADD CONSTRAINT exams_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.study_sessions DROP CONSTRAINT study_sessions_user_id_fkey, ADD CONSTRAINT study_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.study_plans DROP CONSTRAINT study_plans_user_id_fkey, ADD CONSTRAINT study_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.planned_sessions DROP CONSTRAINT planned_sessions_user_id_fkey, ADD CONSTRAINT planned_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.ai_activity DROP CONSTRAINT ai_activity_user_id_fkey, ADD CONSTRAINT ai_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.study_files DROP CONSTRAINT study_files_user_id_fkey, ADD CONSTRAINT study_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
