import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
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

    const signature = req.headers.get('x-paystack-signature');
    const body = await req.text();

    // Verify Paystack signature
    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(paystackSecret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (signature !== computedSignature) {
      console.error('Invalid signature');
      throw new Error('Invalid webhook signature');
    }

    const event = JSON.parse(body);
    console.log('Paystack webhook event:', event.event);

    if (event.event === 'charge.success') {
      const reference = event.data.reference;
      const amount = event.data.amount / 100; // Convert from kobo

      // Update transaction
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .update({ status: 'success' })
        .eq('reference', reference)
        .select()
        .single();

      if (txError) {
        console.error('Transaction update error:', txError);
        throw new Error('Transaction not found');
      }

      // Credit merchant wallet
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('merchant_id', transaction.merchant_id)
        .single();

      if (wallet) {
        await supabase
          .from('wallets')
          .update({ balance: wallet.balance + transaction.amount })
          .eq('merchant_id', transaction.merchant_id);
      }

      // Log activity
      await supabase
        .from('activity_logs')
        .insert({
          merchant_id: transaction.merchant_id,
          action: 'transaction_success',
          resource_type: 'transaction',
          resource_id: transaction.id,
          metadata: { reference, amount, processor: 'paystack' },
        });

      console.log(`Transaction ${reference} marked as success, wallet credited`);
    }

    return new Response(
      JSON.stringify({ status: 'success' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
