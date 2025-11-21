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
      .select('*')
      .eq('id', user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error('Merchant not found');
    }

    // Verify bank account is configured
    if (!merchant.account_number || !merchant.bank_code) {
      throw new Error('Bank account not configured. Please add your bank details first.');
    }

    // Get wallet balance
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('available_balance')
      .eq('merchant_id', user.id)
      .single();

    if (walletError || !wallet) {
      throw new Error('Wallet not found');
    }

    // Check if sufficient balance
    if (wallet.available_balance < amount) {
      throw new Error(`Insufficient balance. Available: ${wallet.available_balance / 100}`);
    }

    // Generate unique reference
    const reference = `WD_${user.id.substring(0, 8)}_${Date.now()}`;

    // Create DEBIT ledger entry
    const { error: ledgerError } = await supabase
      .from('ledger_entries')
      .insert({
        merchant_id: user.id,
        entry_type: 'WITHDRAWAL',
        amount: -amount,
        reference,
        metadata: { type: 'withdrawal_request' },
      });

    if (ledgerError) {
      console.error('Ledger error:', ledgerError);
      throw new Error('Failed to create ledger entry');
    }

    // Reduce available balance
    const { error: balanceError } = await supabase
      .from('wallets')
      .update({ 
        available_balance: wallet.available_balance - amount 
      })
      .eq('merchant_id', user.id);

    if (balanceError) {
      console.error('Balance update error:', balanceError);
      throw new Error('Failed to update balance');
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

    // Initiate Flutterwave Transfer
    const transferResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flwSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_bank: merchant.bank_code,
        account_number: merchant.account_number,
        amount: amount / 100, // Convert to decimal
        narration: `GlowPay Withdrawal for ${merchant.business_name}`,
        currency: 'NGN',
        reference,
        callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-flutterwave`,
        debit_currency: 'NGN',
      }),
    });

    const transferData = await transferResponse.json();
    console.log('Transfer response:', transferData);

    if (transferData.status !== 'success') {
      // Revert the balance
      await supabase
        .from('wallets')
        .update({ 
          available_balance: wallet.available_balance 
        })
        .eq('merchant_id', user.id);

      // Create REVERSAL ledger entry
      await supabase
        .from('ledger_entries')
        .insert({
          merchant_id: user.id,
          entry_type: 'REVERSAL',
          amount: amount,
          reference: `REV_${reference}`,
          metadata: { 
            type: 'withdrawal_failed',
            original_reference: reference,
            reason: transferData.message 
          },
        });

      throw new Error(`Transfer failed: ${transferData.message}`);
    }

    // Save withdrawal record
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from('withdrawals')
      .insert({
        merchant_id: user.id,
        amount,
        status: 'pending',
        reference,
        flw_transfer_id: transferData.data?.id?.toString() || null,
      })
      .select()
      .single();

    if (withdrawalError) {
      console.error('Withdrawal record error:', withdrawalError);
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        data: withdrawal,
        message: 'Withdrawal initiated successfully',
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
