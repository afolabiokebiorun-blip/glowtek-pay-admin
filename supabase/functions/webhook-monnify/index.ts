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

    const body = await req.text();
    const event = JSON.parse(body);

    console.log('Monnify webhook received:', event);

    // Monnify webhook verification
    const monnifySignature = req.headers.get('monnify-signature');
    if (!monnifySignature) {
      throw new Error('Missing Monnify signature');
    }

    // Handle successful payment
    if (event.eventType === 'SUCCESSFUL_TRANSACTION') {
      const reference = event.eventData.transactionReference;
      const amount = event.eventData.amountPaid;

      // Update transaction status
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
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance')
        .eq('merchant_id', transaction.merchant_id)
        .single();

      if (!walletError && wallet) {
        await supabase
          .from('wallets')
          .update({ balance: wallet.balance + amount })
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
          metadata: { processor: 'monnify', reference, amount },
        });
    }

    return new Response(
      JSON.stringify({ status: 'success' }),
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
