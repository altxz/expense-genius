
-- Add closing strategy fields to credit_cards
ALTER TABLE public.credit_cards
  ADD COLUMN closing_strategy text NOT NULL DEFAULT 'fixed',
  ADD COLUMN closing_days_before_due integer NOT NULL DEFAULT 7;

-- Add payment_method and invoice_month to expenses
ALTER TABLE public.expenses
  ADD COLUMN payment_method text DEFAULT NULL,
  ADD COLUMN invoice_month text DEFAULT NULL;
