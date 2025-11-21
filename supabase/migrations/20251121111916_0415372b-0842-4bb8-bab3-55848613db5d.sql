-- Add virtual_account_name field to merchants table
ALTER TABLE public.merchants
ADD COLUMN virtual_account_name text;

-- Add comment
COMMENT ON COLUMN public.merchants.virtual_account_name IS 'Custom business name to display on virtual account';