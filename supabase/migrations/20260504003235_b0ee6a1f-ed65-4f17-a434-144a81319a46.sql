-- Reconciliation guard: block retroactive recurring duplicates in past months
-- when a transaction with the same signature already exists.
CREATE OR REPLACE FUNCTION public.prevent_retroactive_recurring_duplicates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start date;
  v_today_month date;
  v_existing_id uuid;
BEGIN
  -- Templates (is_recurring=true) and installment groups are intentional;
  -- never block them.
  IF COALESCE(NEW.is_recurring, false) = true THEN
    RETURN NEW;
  END IF;
  IF NEW.installment_group_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.date IS NULL THEN
    RETURN NEW;
  END IF;

  v_month_start := date_trunc('month', NEW.date)::date;
  v_today_month := date_trunc('month', CURRENT_DATE)::date;

  -- Only guard PAST months. Current/future months can legitimately receive
  -- new entries (e.g. user re-creates a record on purpose).
  IF v_month_start >= v_today_month THEN
    RETURN NEW;
  END IF;

  -- Look for a same-signature transaction already in that month for this user.
  SELECT id
    INTO v_existing_id
    FROM public.expenses
   WHERE user_id = NEW.user_id
     AND type = NEW.type
     AND lower(trim(description)) = lower(trim(NEW.description))
     AND date >= v_month_start
     AND date < (v_month_start + INTERVAL '1 month')::date
     AND (NEW.id IS NULL OR id <> NEW.id)
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Reconciliação: já existe uma transação "%" do tipo "%" em % para este usuário (id=%). Inserção retroativa bloqueada para evitar duplicidade.',
      NEW.description, NEW.type, to_char(v_month_start, 'YYYY-MM'), v_existing_id
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_retroactive_recurring_duplicates_trg ON public.expenses;

CREATE TRIGGER prevent_retroactive_recurring_duplicates_trg
BEFORE INSERT ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.prevent_retroactive_recurring_duplicates();