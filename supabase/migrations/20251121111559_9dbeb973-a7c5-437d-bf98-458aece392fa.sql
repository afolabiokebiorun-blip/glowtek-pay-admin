-- Add BVN field to merchants table
ALTER TABLE public.merchants
ADD COLUMN bvn text;

-- Add comment
COMMENT ON COLUMN public.merchants.bvn IS 'Bank Verification Number for Flutterwave virtual account creation';