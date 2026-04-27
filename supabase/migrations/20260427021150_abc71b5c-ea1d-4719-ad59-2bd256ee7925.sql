-- Tabela para registrar exceções de transações recorrentes
-- (ocorrências individuais que o usuário escolheu pular/excluir apenas para um mês específico)
CREATE TABLE public.recurring_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template_id UUID NOT NULL,
  occurrence_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (template_id, occurrence_date)
);

CREATE INDEX idx_recurring_exceptions_user ON public.recurring_exceptions(user_id);
CREATE INDEX idx_recurring_exceptions_template ON public.recurring_exceptions(template_id);

ALTER TABLE public.recurring_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recurring exceptions"
ON public.recurring_exceptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recurring exceptions"
ON public.recurring_exceptions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring exceptions"
ON public.recurring_exceptions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring exceptions"
ON public.recurring_exceptions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);