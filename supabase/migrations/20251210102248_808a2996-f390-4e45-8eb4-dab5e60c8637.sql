-- Add currency column to virtual_accounts
ALTER TABLE public.virtual_accounts 
ADD COLUMN currency text NOT NULL DEFAULT 'NGN';