import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-glowtek-key',
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

    const { amount, currency = 'NGN', processor, callbackUrl, metadata } = await req.json();

    if (!amount || !processor) {
      throw new Error('Missing required fields: amount, processor');
    }

    // Generate unique reference
    const reference = `GTP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        merchant_id: user.id,
        amount,
        currency,
        processor,
        reference,
        status: 'pending',
        callback_url: callbackUrl,
        metadata,
      })
      .select()
      .single();

    if (txError) {
      console.error('Transaction creation error:', txError);
      throw new Error('Failed to create transaction');
    }

    // Initialize payment with external processor
    let paymentUrl = '';
    let processorReference = '';

    try {
      if (processor === 'paystack') {
        const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY');
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${paystackKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amount * 100, // Convert to kobo
            email: user.email,
            reference,
            callback_url: callbackUrl,
            metadata,
          }),
        });

        const result = await response.json();
        if (result.status) {
          paymentUrl = result.data.authorization_url;
          processorReference = result.data.reference;
        }
      } else if (processor === 'monnify') {
        // Monnify integration placeholder
        paymentUrl = `https://monnify.com/pay/${reference}`;
        processorReference = reference;
      } else if (processor === 'chapa') {
        // Chapa integration placeholder
        paymentUrl = `https://chapa.co/pay/${reference}`;
        processorReference = reference;
      }

      // Update transaction with payment URL and processor reference
      await supabase
        .from('transactions')
        .update({
          payment_url: paymentUrl,
          processor_reference: processorReference,
        })
        .eq('id', transaction.id);

    } catch (error) {
      console.error('Processor API error:', error);
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        data: {
          reference,
          paymentUrl,
          amount,
          currency,
          processor,
        },
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
