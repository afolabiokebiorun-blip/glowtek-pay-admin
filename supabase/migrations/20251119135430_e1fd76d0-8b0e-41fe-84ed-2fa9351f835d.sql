-- Create processor_credentials table
CREATE TABLE public.processor_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL,
  processor payment_processor NOT NULL,
  credentials JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(merchant_id, processor)
);

-- Enable RLS
ALTER TABLE public.processor_credentials ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own credentials
CREATE POLICY "Merchants can view their own processor credentials"
ON public.processor_credentials
FOR SELECT
USING (merchant_id = auth.uid());

-- Merchants can insert their own credentials
CREATE POLICY "Merchants can insert their own processor credentials"
ON public.processor_credentials
FOR INSERT
WITH CHECK (merchant_id = auth.uid());

-- Merchants can update their own credentials
CREATE POLICY "Merchants can update their own processor credentials"
ON public.processor_credentials
FOR UPDATE
USING (merchant_id = auth.uid());

-- Merchants can delete their own credentials
CREATE POLICY "Merchants can delete their own processor credentials"
ON public.processor_credentials
FOR DELETE
USING (merchant_id = auth.uid());

-- Add trigger for updated_at
CREATE TRIGGER update_processor_credentials_updated_at
BEFORE UPDATE ON public.processor_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();