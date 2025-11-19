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

    const { processor, credentials } = await req.json();

    if (!processor || !credentials) {
      throw new Error('Missing required fields: processor, credentials');
    }

    // Validate processor
    const validProcessors = ['paystack', 'monnify', 'chapa'];
    if (!validProcessors.includes(processor)) {
      throw new Error('Invalid processor');
    }

    // Upsert processor credentials
    const { data, error } = await supabase
      .from('processor_credentials')
      .upsert({
        merchant_id: user.id,
        processor,
        credentials,
        is_active: true,
      }, {
        onConflict: 'merchant_id,processor'
      })
      .select()
      .single();

    if (error) {
      console.error('Credentials upsert error:', error);
      throw new Error('Failed to save credentials');
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        data,
        message: 'Processor credentials saved successfully',
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