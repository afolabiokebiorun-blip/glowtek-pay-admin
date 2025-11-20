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

    // GET - Fetch merchant profile
    if (req.method === 'GET') {
      const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', user.id)
        .single();

      if (merchantError) {
        throw new Error('Failed to fetch profile');
      }

      return new Response(
        JSON.stringify({
          status: 'success',
          data: merchant,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT - Update merchant profile
    if (req.method === 'PUT') {
      const body = await req.json();
      const { business_name, phone } = body;

      const updates: any = {};
      if (business_name) updates.business_name = business_name;
      if (phone) updates.phone = phone;

      const { data: updatedMerchant, error: updateError } = await supabase
        .from('merchants')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        throw new Error('Failed to update profile');
      }

      return new Response(
        JSON.stringify({
          status: 'success',
          data: updatedMerchant,
          message: 'Profile updated successfully',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Method not allowed');

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
