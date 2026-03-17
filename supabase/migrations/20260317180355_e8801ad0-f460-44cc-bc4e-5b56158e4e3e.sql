
-- Add destination_wallet_id for transfers
ALTER TABLE public.expenses ADD COLUMN destination_wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL DEFAULT NULL;
