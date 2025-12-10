import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Flutterwave supported currencies for virtual accounts
const SUPPORTED_CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'KES', 'GHS', 'ZAR'];

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

    // Parse request body for currency
    let currency = 'NGN';
    try {
      const body = await req.json();
      if (body.currency && SUPPORTED_CURRENCIES.includes(body.currency)) {
        currency = body.currency;
      }
    } catch {
      // Default to NGN if no body or invalid JSON
    }

    console.log(`Creating virtual account with currency: ${currency}`);

    // Get merchant details
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, email, business_name, bvn, virtual_account_name')
      .eq('id', user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error('Merchant not found');
    }

    // Check if virtual account already exists for this currency
    const { data: existingAccount } = await supabase
      .from('virtual_accounts')
      .select('*')
      .eq('merchant_id', user.id)
      .eq('currency', currency)
      .maybeSingle();

    if (existingAccount) {
      return new Response(
        JSON.stringify({
          status: 'success',
          data: existingAccount,
          message: `Virtual account for ${currency} already exists`,
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

    // BVN is required for NGN accounts
    if (currency === 'NGN' && (!merchant.bvn || merchant.bvn.trim() === '')) {
      throw new Error('BVN is required to create a NGN virtual account. Please update your profile with your BVN first.');
    }

    // Get the business name to use
    const accountName = merchant.virtual_account_name?.trim() || merchant.business_name;

    // Build request body based on currency
    const requestBody: Record<string, any> = {
      email: merchant.email,
      is_permanent: true,
      tx_ref: `va_${user.id}_${currency}_${Date.now()}`,
      narration: accountName,
    };

    // Add BVN only for NGN accounts
    if (currency === 'NGN') {
      requestBody.bvn = merchant.bvn;
    }

    // For non-NGN currencies, use different endpoint or add currency
    let apiUrl = 'https://api.flutterwave.com/v3/virtual-account-numbers';
    
    // For foreign currency accounts, use the payout subaccounts endpoint
    if (currency !== 'NGN') {
      apiUrl = 'https://api.flutterwave.com/v3/payout-subaccounts';
      requestBody.country = getCurrencyCountry(currency);
      requestBody.account_name = accountName;
      requestBody.mobilenumber = merchant.email; // Use email as identifier
      delete requestBody.narration;
      delete requestBody.is_permanent;
      delete requestBody.tx_ref;
    }

    console.log(`Calling Flutterwave API: ${apiUrl}`);
    console.log('Request body:', JSON.stringify(requestBody));

    const virtualAccountResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${flwSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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

    // Parse response based on account type
    let accountNumber: string;
    let bankName: string;
    let accountNameResult: string;
    let orderRef: string;

    if (currency === 'NGN') {
      accountNumber = vaData.account_number;
      bankName = vaData.bank_name;
      accountNameResult = vaData.note || accountName;
      orderRef = vaData.order_ref || vaData.flw_ref;
    } else {
      // For payout subaccounts (foreign currency)
      accountNumber = vaData.account_number || vaData.nuban || vaData.account_reference;
      bankName = vaData.bank_name || `${currency} Virtual Account`;
      accountNameResult = vaData.account_name || accountName;
      orderRef = vaData.id?.toString() || vaData.account_reference;
    }

    // Save to database
    const { data: virtualAccount, error: insertError } = await supabase
      .from('virtual_accounts')
      .insert({
        merchant_id: user.id,
        account_number: accountNumber,
        bank_name: bankName,
        account_name: accountNameResult,
        order_ref: orderRef,
        currency: currency,
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
        message: `${currency} virtual account created successfully`,
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

function getCurrencyCountry(currency: string): string {
  const currencyCountryMap: Record<string, string> = {
    'USD': 'US',
    'GBP': 'GB',
    'EUR': 'EU',
    'KES': 'KE',
    'GHS': 'GH',
    'ZAR': 'ZA',
  };
  return currencyCountryMap[currency] || 'NG';
}