import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

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

    // Generate API key
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    const apiKey = `gtp_live_${Array.from(keyBytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
    
    const keyPrefix = apiKey.substring(0, 15);
    
    // Hash the full key for storage
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Store in database
    const { data: apiKeyRecord, error: keyError } = await supabase
      .from('api_keys')
      .insert({
        merchant_id: user.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        is_active: true,
      })
      .select()
      .single();

    if (keyError) {
      console.error('API key creation error:', keyError);
      throw new Error('Failed to create API key');
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        data: {
          apiKey, // Only shown once
          keyPrefix,
          id: apiKeyRecord.id,
          createdAt: apiKeyRecord.created_at,
        },
        message: 'Store this API key securely. It will not be shown again.',
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
