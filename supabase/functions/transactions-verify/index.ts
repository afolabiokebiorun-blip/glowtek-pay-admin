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

    const url = new URL(req.url);
    const reference = url.pathname.split('/').pop();

    if (!reference) {
      throw new Error('Missing transaction reference');
    }

    // Get transaction from database
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .eq('merchant_id', user.id)
      .single();

    if (txError || !transaction) {
      throw new Error('Transaction not found');
    }

    // Verify with external processor
    let status = transaction.status;
    
    if (transaction.processor === 'paystack') {
      const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY');
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          'Authorization': `Bearer ${paystackKey}`,
        },
      });

      const result = await response.json();
      if (result.status && result.data.status === 'success') {
        status = 'success';
        
        // Credit merchant wallet
        await supabase.rpc('credit_wallet', {
          p_merchant_id: user.id,
          p_amount: transaction.amount,
        });

        // Update transaction status
        await supabase
          .from('transactions')
          .update({ status: 'success' })
          .eq('id', transaction.id);
      }
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        data: {
          reference: transaction.reference,
          amount: transaction.amount,
          currency: transaction.currency,
          status,
          processor: transaction.processor,
          createdAt: transaction.created_at,
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
