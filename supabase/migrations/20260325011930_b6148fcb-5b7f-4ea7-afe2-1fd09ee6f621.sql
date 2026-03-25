ALTER TABLE public.expenses
  ADD COLUMN installment_group_id text DEFAULT NULL,
  ADD COLUMN installment_info text DEFAULT NULL;