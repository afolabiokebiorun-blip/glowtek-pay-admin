import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, verif-hash',
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

    // Verify Flutterwave signature
    const verifHash = req.headers.get('verif-hash');
    const webhookSecret = Deno.env.get('FLUTTERWAVE_WEBHOOK_HASH');
    
    if (!verifHash || !webhookSecret) {
      console.error('Missing webhook verification hash or secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payload = await req.json();
    
    // Verify the signature matches
    // Verify the secret hash matches the expected webhook secret
    if (verifHash !== webhookSecret) {
      console.error('Webhook signature verification failed: hash mismatch');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Flutterwave webhook received and verified:', payload);

    const eventType = payload.event;

    if (eventType === 'charge.completed' || eventType === 'payment.success') {
      // Handle successful payment
      const txRef = payload.data.tx_ref;
      const amount = payload.data.amount;
      const status = payload.data.status;
      const paymentType = payload.data.payment_type;
      
      if (status !== 'successful') {
        console.log('Payment not successful, skipping');
        return new Response(JSON.stringify({ status: 'ignored' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if it's a virtual account payment
      if (paymentType === 'bank_transfer' || paymentType === 'banktransfer') {
        console.log('Processing virtual account payment');
        
        const accountNumber = payload.data.account_number || payload.data.payment_account_number;
        
        if (!accountNumber) {
          console.error('No account number in virtual account payment');
          return new Response(JSON.stringify({ status: 'missing_account_number' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Look up virtual account
        const { data: virtualAccount, error: vaError } = await supabase
          .from('virtual_accounts')
          .select('merchant_id')
          .eq('account_number', accountNumber)
          .maybeSingle();

        if (vaError || !virtualAccount) {
          console.error('Virtual account not found:', accountNumber);
          return new Response(JSON.stringify({ status: 'virtual_account_not_found' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const merchantId = virtualAccount.merchant_id;
        const amountInKobo = Math.round(amount * 100);
        const reference = payload.data.flw_ref || payload.data.id?.toString() || `VA_${Date.now()}`;

        // Create CREDIT ledger entry for virtual account payment
        await supabase
          .from('ledger_entries')
          .insert({
            merchant_id: merchantId,
            entry_type: 'CREDIT',
            amount: amountInKobo,
            reference: reference,
            metadata: {
              type: 'virtual_account_payment',
              flw_ref: payload.data.flw_ref,
              account_number: accountNumber,
              customer_name: payload.data.customer?.name,
            },
          });

        // Update wallet balance
        const { data: wallet } = await supabase
          .from('wallets')
          .select('available_balance, balance')
          .eq('merchant_id', merchantId)
          .single();

        if (wallet) {
          await supabase
            .from('wallets')
            .update({
              balance: (wallet.balance || 0) + amountInKobo,
              available_balance: (wallet.available_balance || 0) + amountInKobo,
            })
            .eq('merchant_id', merchantId);
        }

        console.log('Virtual account payment processed successfully');
        return new Response(JSON.stringify({ status: 'success' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if it's a wallet top-up
      if (txRef && txRef.startsWith('TOPUP_')) {
        console.log('Processing wallet top-up:', txRef);
        
        // Extract merchant ID from reference (format: TOPUP_{merchantId}_{timestamp})
        const merchantIdMatch = txRef.match(/TOPUP_([a-f0-9-]+)_/);
        if (!merchantIdMatch) {
          console.error('Invalid top-up reference format:', txRef);
          return new Response(JSON.stringify({ status: 'invalid_reference' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const merchantId = merchantIdMatch[1];
        const amountInKobo = Math.round(amount * 100);

        // Create CREDIT ledger entry for top-up
        await supabase
          .from('ledger_entries')
          .insert({
            merchant_id: merchantId,
            entry_type: 'CREDIT',
            amount: amountInKobo,
            reference: txRef,
            metadata: {
              type: 'wallet_topup',
              flw_ref: payload.data.flw_ref,
            },
          });

        // Update wallet balance
        const { data: wallet } = await supabase
          .from('wallets')
          .select('available_balance, balance')
          .eq('merchant_id', merchantId)
          .single();

        if (wallet) {
          await supabase
            .from('wallets')
            .update({
              balance: (wallet.balance || 0) + amountInKobo,
              available_balance: (wallet.available_balance || 0) + amountInKobo,
            })
            .eq('merchant_id', merchantId);
        }

        console.log('Wallet top-up processed successfully');
        return new Response(JSON.stringify({ status: 'success' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle regular transaction
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .select('*, merchants(*)')
        .eq('reference', txRef)
        .maybeSingle();

      if (txError || !transaction) {
        console.log('Transaction not found for reference:', txRef);
        return new Response(JSON.stringify({ status: 'transaction_not_found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if already processed
      if (transaction.status === 'success') {
        console.log('Transaction already processed');
        return new Response(JSON.stringify({ status: 'already_processed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update transaction status
      await supabase
        .from('transactions')
        .update({ 
          status: 'success',
          processor_reference: payload.data.flw_ref || payload.data.id?.toString(),
        })
        .eq('id', transaction.id);

      // Create CREDIT ledger entry
      const amountInKobo = Math.round(amount * 100);
      await supabase
        .from('ledger_entries')
        .insert({
          merchant_id: transaction.merchant_id,
          entry_type: 'CREDIT',
          amount: amountInKobo,
          reference: txRef,
          metadata: {
            type: 'payment_success',
            transaction_id: transaction.id,
            flw_ref: payload.data.flw_ref,
          },
        });

      // Update wallet balance
      const { data: wallet } = await supabase
        .from('wallets')
        .select('available_balance')
        .eq('merchant_id', transaction.merchant_id)
        .single();

      if (wallet) {
        await supabase
          .from('wallets')
          .update({
            available_balance: (wallet.available_balance || 0) + amountInKobo,
          })
          .eq('merchant_id', transaction.merchant_id);
      }

      console.log('Payment processed successfully');
      return new Response(JSON.stringify({ status: 'success' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (eventType === 'transfer.completed') {
      // Handle transfer completion (withdrawals)
      const reference = payload.data.reference;
      const status = payload.data.status;

      const { data: withdrawal, error: wdError } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('reference', reference)
        .maybeSingle();

      if (wdError || !withdrawal) {
        console.log('Withdrawal not found for reference:', reference);
        return new Response(JSON.stringify({ status: 'withdrawal_not_found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (status === 'successful' || status === 'SUCCESSFUL') {
        // Update withdrawal status to success
        await supabase
          .from('withdrawals')
          .update({ status: 'success' })
          .eq('id', withdrawal.id);

        console.log('Withdrawal completed successfully');
      } else if (status === 'failed' || status === 'FAILED') {
        // Update withdrawal status to failed
        await supabase
          .from('withdrawals')
          .update({ status: 'failed' })
          .eq('id', withdrawal.id);

        // Create REVERSAL ledger entry to credit back the amount
        await supabase
          .from('ledger_entries')
          .insert({
            merchant_id: withdrawal.merchant_id,
            entry_type: 'REVERSAL',
            amount: withdrawal.amount,
            reference: `REV_${reference}`,
            metadata: {
              type: 'withdrawal_failed',
              original_reference: reference,
              reason: payload.data.complete_message || 'Transfer failed',
            },
          });

        // Restore balance
        const { data: wallet } = await supabase
          .from('wallets')
          .select('available_balance')
          .eq('merchant_id', withdrawal.merchant_id)
          .single();

        if (wallet) {
          await supabase
            .from('wallets')
            .update({
              available_balance: (wallet.available_balance || 0) + withdrawal.amount,
            })
            .eq('merchant_id', withdrawal.merchant_id);
        }

        console.log('Withdrawal failed, amount reversed');
      }

      return new Response(JSON.stringify({ status: 'success' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(
      JSON.stringify({ status: 'event_not_handled', event: eventType }),
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
