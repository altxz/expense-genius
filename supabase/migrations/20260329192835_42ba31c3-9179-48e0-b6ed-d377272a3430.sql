
CREATE OR REPLACE FUNCTION public.get_starting_balance(p_user_id uuid, p_before_date date)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(
      (SELECT SUM(w.initial_balance) FROM public.wallets w WHERE w.user_id = p_user_id),
      0
    )
    +
    COALESCE(
      (SELECT SUM(
        CASE 
          WHEN e.type = 'income' THEN e.value
          WHEN e.type = 'transfer' THEN 0
          WHEN e.credit_card_id IS NOT NULL THEN 0
          ELSE -e.value
        END
      )
      FROM public.expenses e 
      WHERE e.user_id = p_user_id 
        AND e.is_paid = true 
        AND e.date < p_before_date),
      0
    );
$$;
