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

    const { amount, bankAccount } = await req.json();

    if (!amount || !bankAccount) {
      throw new Error('Missing required fields: amount, bankAccount');
    }

    // Check wallet balance
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('merchant_id', user.id)
      .single();

    if (walletError || !wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    // Generate reference
    const reference = `PYO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create payout request
    const { data: payout, error: payoutError } = await supabase
      .from('payouts')
      .insert({
        merchant_id: user.id,
        amount,
        reference,
        bank_account: bankAccount,
        status: 'pending',
      })
      .select()
      .single();

    if (payoutError) {
      console.error('Payout creation error:', payoutError);
      throw new Error('Failed to create payout request');
    }

    // Deduct from wallet (pending settlement)
    await supabase
      .from('wallets')
      .update({ balance: wallet.balance - amount })
      .eq('merchant_id', user.id);

    return new Response(
      JSON.stringify({
        status: 'success',
        data: {
          reference: payout.reference,
          amount: payout.amount,
          status: payout.status,
          createdAt: payout.created_at,
        },
        message: 'Payout request submitted. Admin will process it shortly.',
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
