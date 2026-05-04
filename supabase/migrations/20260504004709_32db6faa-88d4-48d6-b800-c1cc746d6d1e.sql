DROP TRIGGER IF EXISTS prevent_retroactive_recurring_duplicates_trg ON public.expenses;
DROP FUNCTION IF EXISTS public.prevent_retroactive_recurring_duplicates();