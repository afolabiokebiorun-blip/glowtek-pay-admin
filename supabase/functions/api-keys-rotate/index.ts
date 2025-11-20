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

    const { keyId } = await req.json();

    if (!keyId) {
      throw new Error('Missing keyId');
    }

    // Revoke old key
    const { error: revokeError } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId)
      .eq('merchant_id', user.id);

    if (revokeError) {
      throw new Error('Failed to revoke old key');
    }

    // Generate new API key
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    const apiKey = Array.from(keyBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const keyPrefix = apiKey.substring(0, 8);
    
    // Hash the key
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Store new key
    const { data: newKey, error: insertError } = await supabase
      .from('api_keys')
      .insert({
        merchant_id: user.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error('Failed to create new key');
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        data: {
          apiKey,
          keyPrefix,
          id: newKey.id,
          createdAt: newKey.created_at,
        },
        message: 'API key rotated successfully. Store this key securely.',
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
