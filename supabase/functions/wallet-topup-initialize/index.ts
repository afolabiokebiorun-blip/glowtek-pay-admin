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

    const { amount } = await req.json();

    if (!amount || amount <= 0) {
      throw new Error('Invalid amount');
    }

    // Get merchant details
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('email, business_name')
      .eq('id', user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error('Merchant not found');
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
    const reference = `TOPUP_${user.id.substring(0, 8)}_${Date.now()}`;

    // Initialize Flutterwave payment
    const paymentResponse = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flwSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: reference,
        amount: amount / 100, // Convert to decimal
        currency: 'NGN',
        redirect_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-flutterwave`,
        customer: {
          email: merchant.email,
          name: merchant.business_name,
        },
        customizations: {
          title: 'GlowWallet Top-up',
          description: 'Add funds to your GlowWallet',
          logo: 'https://your-logo-url.com/logo.png',
        },
        payment_options: 'card,banktransfer,ussd',
      }),
    });

    const paymentData = await paymentResponse.json();
    console.log('Payment initialization response:', paymentData);

    if (paymentData.status !== 'success') {
      throw new Error(`Payment initialization failed: ${paymentData.message}`);
    }

    // Create ledger entry for tracking
    const { error: ledgerError } = await supabase
      .from('ledger_entries')
      .insert({
        merchant_id: user.id,
        entry_type: 'TOPUP_PENDING',
        amount: amount,
        reference,
        metadata: { 
          type: 'wallet_topup',
          payment_link: paymentData.data.link 
        },
      });

    if (ledgerError) {
      console.error('Ledger error:', ledgerError);
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        data: {
          payment_link: paymentData.data.link,
          reference,
        },
        message: 'Payment initialized successfully',
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
