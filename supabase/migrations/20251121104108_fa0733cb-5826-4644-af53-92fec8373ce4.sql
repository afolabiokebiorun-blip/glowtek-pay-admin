-- Create virtual_accounts table
CREATE TABLE IF NOT EXISTS public.virtual_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  order_ref TEXT,
  flw_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create ledger_entries table (immutable ledger)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('CREDIT', 'DEBIT', 'WITHDRAWAL', 'REVERSAL')),
  amount INTEGER NOT NULL,
  reference TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create withdrawals table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  reference TEXT NOT NULL UNIQUE,
  flw_transfer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add bank account fields to merchants table
ALTER TABLE public.merchants 
  ADD COLUMN IF NOT EXISTS bank_code TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS resolved_account_name TEXT,
  ADD COLUMN IF NOT EXISTS flw_customer_id TEXT;

-- Update wallets table to have available_balance and pending_balance
ALTER TABLE public.wallets 
  ADD COLUMN IF NOT EXISTS available_balance INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_balance INTEGER DEFAULT 0;

-- Enable RLS on new tables
ALTER TABLE public.virtual_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS policies for virtual_accounts
CREATE POLICY "Merchants can view their own virtual account"
  ON public.virtual_accounts FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Admins can view all virtual accounts"
  ON public.virtual_accounts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for ledger_entries
CREATE POLICY "Merchants can view their own ledger entries"
  ON public.ledger_entries FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Admins can view all ledger entries"
  ON public.ledger_entries FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for withdrawals
CREATE POLICY "Merchants can view their own withdrawals"
  ON public.withdrawals FOR SELECT
  USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can request withdrawals"
  ON public.withdrawals FOR INSERT
  WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Admins can view all withdrawals"
  ON public.withdrawals FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update withdrawals"
  ON public.withdrawals FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_merchant_id ON public.virtual_accounts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_merchant_id ON public.ledger_entries(merchant_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_created_at ON public.ledger_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_merchant_id ON public.withdrawals(merchant_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_reference ON public.withdrawals(reference);

-- Trigger for updating withdrawals updated_at
CREATE TRIGGER update_withdrawals_updated_at
  BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();