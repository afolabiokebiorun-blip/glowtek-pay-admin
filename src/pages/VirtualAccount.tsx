import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, Loader2, AlertCircle } from "lucide-react";

interface VirtualAccountData {
  account_number: string;
  bank_name: string;
  account_name: string;
  order_ref: string;
}

export default function VirtualAccount() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccountData | null>(null);
  const [hasFlutterwaveConfig, setHasFlutterwaveConfig] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }
    await checkFlutterwaveConfig();
    await loadVirtualAccount();
  };

  const checkFlutterwaveConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('processor_credentials')
        .select('id')
        .eq('merchant_id', user.id)
        .eq('processor', 'flutterwave')
        .eq('is_active', true)
        .maybeSingle();

      setHasFlutterwaveConfig(!!data);
    } catch (error) {
      console.error('Error checking Flutterwave config:', error);
    }
  };

  const loadVirtualAccount = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('virtual_accounts')
        .select('*')
        .eq('merchant_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setVirtualAccount(data);
      }
    } catch (error: any) {
      console.error('Error loading virtual account:', error);
      toast.error("Failed to load virtual account");
    } finally {
      setLoading(false);
    }
  };

  const createVirtualAccount = async () => {
    if (!hasFlutterwaveConfig) {
      toast.error("Please configure Flutterwave credentials first in Processor Settings");
      navigate("/processor-settings");
      return;
    }

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke('virtual-account-create', {});

      if (error) throw error;

      if (data.status === 'success') {
        setVirtualAccount(data.data);
        toast.success("Virtual account created successfully!");
      } else {
        throw new Error(data.error || "Failed to create virtual account");
      }
    } catch (error: any) {
      console.error('Creation error:', error);
      toast.error(error.message || "Failed to create virtual account");
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasFlutterwaveConfig) {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Virtual Account</CardTitle>
            <CardDescription>Configure Flutterwave to get started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  Flutterwave Configuration Required
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  You need to add your Flutterwave API credentials before you can create a virtual account.
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/processor-settings")}>
              Go to Processor Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!virtualAccount) {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Virtual Account</CardTitle>
            <CardDescription>Create your dedicated virtual account for receiving payments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                You don't have a virtual account yet. Create one to start receiving payments.
              </p>
              <Button onClick={createVirtualAccount} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Virtual Account"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Your Virtual Account</CardTitle>
          <CardDescription>Use this account to receive payments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Bank Name</p>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{virtualAccount.bank_name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(virtualAccount.bank_name, "Bank name")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Account Number</p>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold">{virtualAccount.account_number}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(virtualAccount.account_number, "Account number")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Account Name</p>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{virtualAccount.account_name}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(virtualAccount.account_name, "Account name")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> This is your dedicated virtual account. All payments received will be credited to your GlowWallet.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
