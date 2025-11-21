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

    // Get merchant details
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error('Merchant not found');
    }

    // Check if virtual account already exists
    const { data: existingAccount } = await supabase
      .from('virtual_accounts')
      .select('*')
      .eq('merchant_id', user.id)
      .maybeSingle();

    if (existingAccount) {
      return new Response(
        JSON.stringify({
          status: 'success',
          data: existingAccount,
          message: 'Virtual account already exists',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    if (!flwSecretKey) {
      throw new Error('Flutterwave secret key not found');
    }

    // Check if merchant has BVN
    if (!merchant.bvn || merchant.bvn.trim() === '') {
      throw new Error('BVN is required to create a virtual account. Please update your profile with your BVN first.');
    }

    // Create Virtual Account directly
    const virtualAccountResponse = await fetch('https://api.flutterwave.com/v3/virtual-account-numbers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flwSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: merchant.email,
        is_permanent: true,
        bvn: merchant.bvn,
        tx_ref: `va_${user.id}_${Date.now()}`,
        narration: `${merchant.business_name} FLW`,
      }),
    });

    if (!virtualAccountResponse.ok) {
      const errorText = await virtualAccountResponse.text();
      console.error('Flutterwave virtual account creation failed:', errorText);
      throw new Error(`Flutterwave API error: ${virtualAccountResponse.status} - ${errorText}`);
    }

    const virtualAccountData = await virtualAccountResponse.json();
    console.log('Virtual account creation response:', virtualAccountData);

    if (virtualAccountData.status !== 'success') {
      throw new Error(`Failed to create virtual account: ${virtualAccountData.message}`);
    }

    const vaData = virtualAccountData.data;

    // Save to database
    const { data: virtualAccount, error: insertError } = await supabase
      .from('virtual_accounts')
      .insert({
        merchant_id: user.id,
        account_number: vaData.account_number,
        bank_name: vaData.bank_name,
        account_name: vaData.note || `${merchant.business_name} FLW`,
        order_ref: vaData.order_ref || vaData.flw_ref,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error('Failed to save virtual account');
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        data: virtualAccount,
        message: 'Virtual account created successfully',
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
