import React, { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type ProcessorType =
  | "paystack"
  | "monnify"
  | "chapa"
  | "flutterwave"
  | "stripe"
  | "paypal"
  | "wise"
  | "coinbase"
  | "nowpayments"
  | "bitpay"
  | "coinpayments"
  | "binancepay";

interface ProcessorConfig {
  processor: ProcessorType;
  credentials: Record<string, string>;
  is_active: boolean;
}

const processorFields: Record<ProcessorType, { key: string; label: string; placeholder: string }[]> = {
  paystack: [
    { key: "secret_key", label: "Secret Key", placeholder: "sk_live_..." },
    { key: "public_key", label: "Public Key", placeholder: "pk_live_..." },
  ],

  monnify: [
    { key: "api_key", label: "API Key", placeholder: "Monnify API Key" },
    { key: "secret_key", label: "Secret Key", placeholder: "Monnify Secret Key" },
    { key: "contract_code", label: "Contract Code", placeholder: "Monnify Contract Code" },
  ],

  chapa: [{ key: "secret_key", label: "Secret Key", placeholder: "CHASECK_..." }],

  flutterwave: [
    { key: "public_key", label: "Public Key", placeholder: "FLWPUBK-..." },
    { key: "secret_key", label: "Secret Key", placeholder: "FLWSECK-..." },
    { key: "encryption_key", label: "Encryption Key", placeholder: "FLWENCK-..." },
  ],

  stripe: [
    { key: "publishable_key", label: "Publishable Key", placeholder: "pk_live_..." },
    { key: "secret_key", label: "Secret Key", placeholder: "sk_live_..." },
    { key: "webhook_secret", label: "Webhook Secret", placeholder: "whsec_..." },
  ],

  paypal: [
    { key: "client_id", label: "Client ID", placeholder: "PayPal Client ID" },
    { key: "secret", label: "Secret Key", placeholder: "PayPal Secret" },
  ],

  wise: [{ key: "api_token", label: "API Token", placeholder: "Wise API Token" }],

  coinbase: [
    { key: "api_key", label: "API Key", placeholder: "Coinbase Commerce API Key" },
    { key: "webhook_secret", label: "Webhook Secret", placeholder: "Webhook Secret" },
    { key: "shared_secret", label: "Shared Secret", placeholder: "Shared Secret" },
  ],

  nowpayments: [
    { key: "api_key", label: "API Key", placeholder: "NOWPayments API Key" },
    { key: "ipn_secret", label: "IPN Secret", placeholder: "IPN Secret" },
  ],

  bitpay: [{ key: "api_token", label: "API Token", placeholder: "BitPay API Token" }],

  coinpayments: [
    { key: "merchant_id", label: "Merchant ID", placeholder: "Merchant ID" },
    { key: "public_key", label: "Public Key", placeholder: "Public Key" },
    { key: "private_key", label: "Private Key", placeholder: "Private Key" },
  ],

  binancepay: [
    { key: "api_key", label: "API Key", placeholder: "Binance Pay API Key" },
    { key: "secret_key", label: "Secret Key", placeholder: "Binance Pay Secret Key" },
    { key: "merchant_id", label: "Merchant ID", placeholder: "Merchant ID" },
  ],
};

export default function ProcessorSettings() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<Record<ProcessorType, ProcessorConfig | null>>({
    paystack: null,
    monnify: null,
    chapa: null,
    flutterwave: null,
    stripe: null,
    paypal: null,
    wise: null,
    coinbase: null,
    nowpayments: null,
    bitpay: null,
    coinpayments: null,
    binancepay: null,
  });

  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication and fetch processor credentials
  useEffect(() => {
    async function checkAuthAndLoad() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }
      
      setIsAuthenticated(true);
      
      const { data, error } = await supabase.functions.invoke("processor-credentials-get");
      if (!error && data) {
        const map = { ...configs };
        data.data?.forEach((row: any) => {
          map[row.processor as ProcessorType] = row;
        });
        setConfigs(map);
      }
    }
    checkAuthAndLoad();
  }, [navigate]);

  async function saveConfig(processor: ProcessorType) {
    setLoading(true);

    const config = configs[processor];
    const { data, error } = await supabase.functions.invoke("processor-credentials-upsert", {
      body: {
        processor,
        credentials: config?.credentials || {},
        is_active: true,
      },
    });

    setLoading(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: `${processor} updated successfully.` });
    }
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="p-6 space-y-12">
      <h1 className="text-2xl font-bold mb-6">Payment Processors</h1>

      {Object.keys(processorFields).map((processorKey) => {
        const processor = processorKey as ProcessorType;
        const fields = processorFields[processor];
        const config = configs[processor] || { credentials: {} };

        return (
          <div key={processor} className="p-6 border rounded-lg shadow-sm bg-white">
            <h2 className="text-xl font-bold capitalize mb-4">{processor}</h2>

            {fields.map((field) => (
              <div key={field.key} className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {field.label}
                </label>
                <input
                  type="text"
                  placeholder={field.placeholder}
                  className="w-full border p-3 rounded"
                  value={config.credentials[field.key] || ""}
                  onChange={(e) =>
                    setConfigs({
                      ...configs,
                      [processor]: {
                        processor,
                        is_active: true,
                        credentials: {
                          ...config.credentials,
                          [field.key]: e.target.value,
                        },
                      },
                    })
                  }
                />
              </div>
            ))}

            <button
              className="bg-purple-600 text-white px-4 py-2 rounded w-full"
              disabled={loading}
              onClick={() => saveConfig(processor)}
            >
              {loading ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
