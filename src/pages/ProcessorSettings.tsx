import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Save, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ProcessorType = 'paystack' | 'monnify' | 'chapa';

interface ProcessorConfig {
  processor: ProcessorType;
  credentials: Record<string, string>;
  is_active: boolean;
}

const processorFields = {
  paystack: [
    { key: 'secret_key', label: 'Secret Key', placeholder: 'sk_live_...' },
    { key: 'public_key', label: 'Public Key', placeholder: 'pk_live_...' },
  ],
  monnify: [
    { key: 'api_key', label: 'API Key', placeholder: 'Your Monnify API Key' },
    { key: 'secret_key', label: 'Secret Key', placeholder: 'Your Monnify Secret Key' },
    { key: 'contract_code', label: 'Contract Code', placeholder: 'Your Contract Code' },
  ],
  chapa: [
    { key: 'secret_key', label: 'Secret Key', placeholder: 'CHASECK_...' },
  ],
};

export default function ProcessorSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<Record<ProcessorType, Record<string, string>>>({
    paystack: {},
    monnify: {},
    chapa: {},
  });
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [savedProcessors, setSavedProcessors] = useState<Set<ProcessorType>>(new Set());

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('processor-credentials-get', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.data) {
        const newConfigs = { ...configs };
        const saved = new Set<ProcessorType>();
        
        data.data.forEach((cred: ProcessorConfig) => {
          newConfigs[cred.processor] = cred.credentials;
          if (cred.is_active) {
            saved.add(cred.processor);
          }
        });
        
        setConfigs(newConfigs);
        setSavedProcessors(saved);
      }
    } catch (error) {
      console.error('Error fetching credentials:', error);
    }
  };

  const handleSave = async (processor: ProcessorType) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const credentials = configs[processor];
      
      // Validate that required fields are filled
      const requiredFields = processorFields[processor];
      const hasAllFields = requiredFields.every(field => credentials[field.key]?.trim());
      
      if (!hasAllFields) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.functions.invoke('processor-credentials-upsert', {
        body: { processor, credentials },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setSavedProcessors(prev => new Set(prev).add(processor));
      
      toast({
        title: "Success",
        description: `${processor.charAt(0).toUpperCase() + processor.slice(1)} credentials saved successfully`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (processor: ProcessorType, fieldKey: string, value: string) => {
    setConfigs(prev => ({
      ...prev,
      [processor]: {
        ...prev[processor],
        [fieldKey]: value,
      },
    }));
  };

  const toggleShowSecret = (fieldId: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [fieldId]: !prev[fieldId],
    }));
  };

  const renderProcessorCard = (processor: ProcessorType, title: string, description: string) => {
    const isSaved = savedProcessors.has(processor);
    
    return (
      <Card key={processor} className="shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {title}
                {isSaved && <CheckCircle2 className="w-5 h-5 text-green-600" />}
              </CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {processorFields[processor].map((field) => {
            const fieldId = `${processor}-${field.key}`;
            const isSecret = field.key.includes('key') || field.key.includes('secret');
            
            return (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={fieldId}>{field.label}</Label>
                <div className="relative">
                  <Input
                    id={fieldId}
                    type={isSecret && !showSecrets[fieldId] ? "password" : "text"}
                    value={configs[processor][field.key] || ''}
                    onChange={(e) => handleFieldChange(processor, field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="pr-10"
                  />
                  {isSecret && (
                    <button
                      type="button"
                      onClick={() => toggleShowSecret(fieldId)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSecrets[fieldId] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          
          <Button
            onClick={() => handleSave(processor)}
            disabled={loading}
            className="w-full gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaved ? 'Update' : 'Save'} Configuration
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Payment Processors</h1>
        <p className="text-muted-foreground mt-1">
          Configure your payment processor credentials to start accepting payments
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {renderProcessorCard(
          'paystack',
          'Paystack',
          'Accept payments in Nigeria, Ghana, South Africa, and Kenya'
        )}
        {renderProcessorCard(
          'monnify',
          'Monnify',
          'Nigeria-focused payment gateway with bank transfers and cards'
        )}
        {renderProcessorCard(
          'chapa',
          'Chapa',
          'Accept payments across Ethiopia and East Africa'
        )}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Security Notice</h3>
          <p className="text-sm text-muted-foreground">
            Your API keys and secrets are encrypted and stored securely. Never share your credentials 
            with anyone. Always use live keys in production and test keys during development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}