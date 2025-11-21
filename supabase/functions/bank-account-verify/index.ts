import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { account_number, bank_code, bank_name } = await req.json();

    if (!account_number || !bank_code) {
      throw new Error('Missing required fields: account_number, bank_code');
    }

    // Get Flutterwave credentials
    const { data: credentials, error: credError } = await supabase
      .from('processor_credentials')
      .select('credentials')
      .eq('merchant_id', user.id)
      .eq('processor', 'flutterwave')
      .eq('is_active', true)
      .maybeSingle();

    if (credError || !credentials) {
      throw new Error('Flutterwave credentials not configured');
    }

    const flwSecretKey = credentials.credentials.secret_key;

    // Verify account using Flutterwave
    const response = await fetch(
      `https://api.flutterwave.com/v3/accounts/resolve?account_number=${account_number}&account_bank=${bank_code}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${flwSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    console.log('Account resolution response:', data);

    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to verify account');
    }

    const resolved_account_name = data.data.account_name;

    // Save to merchant record
    const { error: updateError } = await supabase
      .from('merchants')
      .update({
        bank_code,
        bank_name: bank_name || '',
        account_number,
        resolved_account_name,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error('Failed to save bank details');
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        data: {
          account_number,
          account_name: resolved_account_name,
          bank_code,
          bank_name,
        },
        message: 'Bank account verified and saved successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
