
CREATE TABLE public.net_worth_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  total_assets numeric NOT NULL DEFAULT 0,
  total_liabilities numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.net_worth_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own net worth history" ON public.net_worth_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own net worth history" ON public.net_worth_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role insert bypass" ON public.net_worth_history FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Users can update own net worth history" ON public.net_worth_history FOR UPDATE USING (auth.uid() = user_id);
