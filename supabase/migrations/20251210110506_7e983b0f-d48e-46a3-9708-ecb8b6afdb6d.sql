-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create site_settings table for storing branding configuration
CREATE TABLE public.site_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL DEFAULT 'Glowtek Pay',
  primary_color TEXT NOT NULL DEFAULT '#4C1D95',
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(merchant_id)
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own site settings"
ON public.site_settings
FOR SELECT
USING (auth.uid() = merchant_id);

CREATE POLICY "Users can insert their own site settings"
ON public.site_settings
FOR INSERT
WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Users can update their own site settings"
ON public.site_settings
FOR UPDATE
USING (auth.uid() = merchant_id);

-- Create trigger for updated_at
CREATE TRIGGER update_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();