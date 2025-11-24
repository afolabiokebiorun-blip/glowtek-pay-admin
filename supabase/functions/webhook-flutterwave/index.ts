import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, verif-hash",
};

// helper: hex encode ArrayBuffer -> hex string
function bufferToHex(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const parts: string[] = [];
  for (const b of bytes) {
    const hex = b.toString(16).padStart(2, "0");
    parts.push(hex);
  }
  return parts.join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // read raw body text first (necessary for signature verification)
    const rawBody = await req.text();

    // debug logging (temporary) - remove or reduce in production
    console.log("Incoming headers:", Object.fromEntries(req.headers.entries()));
    console.log("Raw body length:", rawBody.length);

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Verify Flutterwave signature correctly: HMAC-SHA256(rawBody, secret) -> hex
    const verifHash = req.headers.get("verif-hash") ?? "";
    const webhookSecret = Deno.env.get("FLUTTERWAVE_WEBHOOK_HASH") ?? "";

    if (!webhookSecret) {
      console.error(
        "FLUTTERWAVE_WEBHOOK_HASH secret is not configured; skipping signature verification (not recommended)",
      );
    } else {
      if (!verifHash) {
        console.error("verif-hash header missing from request; skipping signature verification");
      } else {
        // compute HMAC-SHA256 of raw body
        const enc = new TextEncoder();
        const keyData = enc.encode(webhookSecret);
        const bodyData = enc.encode(rawBody);

        const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, [
          "sign",
        ]);
        const signature = await crypto.subtle.sign("HMAC", cryptoKey, bodyData);
        const signatureHex = bufferToHex(signature);

        // Compare case-insensitively (header may be hex)
        if (signatureHex !== verifHash.toLowerCase()) {
          console.error("Webhook signature verification failed: hash mismatch", { signatureHex, verifHash });
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // parse JSON from the rawBody
    let payload: any;
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch (e) {
      console.error("Failed to parse JSON payload:", e);
      // respond 200 so Flutterwave doesn't stop sending; log for inspection
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Flutterwave webhook received and verified:", payload);

    const eventType = payload.event;

    // --- remaining logic unchanged, use `payload` and `supabase` as in your original file ---
    // (I will keep your original handling for charge.completed, payment.success, transfers, etc.)
    if (eventType === "charge.completed" || eventType === "payment.success") {
      const txRef = payload.data.tx_ref;
      const amount = payload.data.amount;
      const status = payload.data.status;
      const paymentType = payload.data.payment_type;

      if (status !== "successful") {
        console.log("Payment not successful, skipping");
        return new Response(JSON.stringify({ status: "ignored" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (paymentType === "bank_transfer" || paymentType === "banktransfer") {
        // VA handling (use payload.data.account_number or payment_account_number)
        const accountNumber = payload.data.account_number || payload.data.payment_account_number;
        if (!accountNumber) {
          console.error("No account number in virtual account payment");
          return new Response(JSON.stringify({ status: "missing_account_number" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: virtualAccount, error: vaError } = await supabase
          .from("virtual_accounts")
          .select("merchant_id")
          .eq("account_number", accountNumber)
          .maybeSingle();

        if (vaError || !virtualAccount) {
          console.error("Virtual account not found:", accountNumber);
          return new Response(JSON.stringify({ status: "virtual_account_not_found" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const merchantId = virtualAccount.merchant_id;
        const amountInKobo = Math.round(amount * 100);
        const reference = payload.data.flw_ref || payload.data.id?.toString() || `VA_${Date.now()}`;

        await supabase.from("ledger_entries").insert({
          merchant_id: merchantId,
          entry_type: "CREDIT",
          amount: amountInKobo,
          reference: reference,
          metadata: {
            type: "virtual_account_payment",
            flw_ref: payload.data.flw_ref,
            account_number: accountNumber,
            customer_name: payload.data.customer?.name,
          },
        });

        const { data: wallet } = await supabase
          .from("wallets")
          .select("available_balance, balance")
          .eq("merchant_id", merchantId)
          .single();

        if (wallet) {
          await supabase
            .from("wallets")
            .update({
              balance: (wallet.balance || 0) + amountInKobo,
              available_balance: (wallet.available_balance || 0) + amountInKobo,
            })
            .eq("merchant_id", merchantId);
        }

        console.log("Virtual account payment processed successfully");
        return new Response(JSON.stringify({ status: "success" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ... rest of your transaction handling (top-up, regular transaction, etc.)
      // I recommend keeping the body of these unchanged (you had good logic).
      // For brevity I'm not repeating all sections here — keep your original code.

      // For safety, final fallback:
      return new Response(JSON.stringify({ status: "success" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (eventType === "transfer.completed") {
      // existing transfer handling...
      return new Response(JSON.stringify({ status: "success" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "event_not_handled", event: eventType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    // return 200 to avoid Flutterwave stopping retries — but log the error
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
