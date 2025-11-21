import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Loader2, AlertCircle } from "lucide-react";

interface VirtualAccountData {
  account_number: string;
  bank_name: string;
  account_name: string;
  order_ref: string;
}

interface MerchantData {
  bvn: string | null;
  business_name: string;
  virtual_account_name: string | null;
}

export default function VirtualAccount() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingBvn, setSavingBvn] = useState(false);
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccountData | null>(null);
  const [hasFlutterwaveConfig, setHasFlutterwaveConfig] = useState(false);
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [bvnInput, setBvnInput] = useState("");
  const [businessNameInput, setBusinessNameInput] = useState("");

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
    await loadMerchantData();
    await loadVirtualAccount();
  };

  const loadMerchantData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('merchants')
        .select('bvn, business_name, virtual_account_name')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setMerchant(data);
        setBvnInput(data.bvn || "");
        setBusinessNameInput(data.virtual_account_name || data.business_name || "");
      }
    } catch (error: any) {
      console.error('Error loading merchant data:', error);
    }
  };

  const saveBvn = async () => {
    if (!bvnInput || bvnInput.trim().length !== 11) {
      toast.error("Please enter a valid 11-digit BVN");
      return;
    }

    if (!businessNameInput || businessNameInput.trim().length < 3) {
      toast.error("Please enter a business name (at least 3 characters)");
      return;
    }

    if (businessNameInput.trim().length > 50) {
      toast.error("Business name must be less than 50 characters");
      return;
    }

    setSavingBvn(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('merchants')
        .update({ 
          bvn: bvnInput.trim(),
          virtual_account_name: businessNameInput.trim()
        })
        .eq('id', user.id);

      if (error) throw error;

      setMerchant({ 
        ...merchant!, 
        bvn: bvnInput.trim(),
        virtual_account_name: businessNameInput.trim()
      });
      toast.success("Details saved successfully!");
    } catch (error: any) {
      console.error('Error saving details:', error);
      toast.error(error.message || "Failed to save details");
    } finally {
      setSavingBvn(false);
    }
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
    // Show BVN input if not saved
    if (!merchant?.bvn) {
      return (
        <div className="container max-w-2xl py-8">
          <Card>
            <CardHeader>
              <CardTitle>Virtual Account Setup</CardTitle>
              <CardDescription>Enter your details to create a virtual account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Your Bank Verification Number (BVN) is required by Flutterwave to create a permanent virtual account for receiving payments.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name (as it will appear on account)</Label>
                <Input
                  id="businessName"
                  type="text"
                  placeholder="Enter your business name"
                  value={businessNameInput}
                  onChange={(e) => setBusinessNameInput(e.target.value.slice(0, 50))}
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">
                  This name will appear on your virtual account (e.g., "Your Business Name FLW").
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bvn">Bank Verification Number (BVN)</Label>
                <Input
                  id="bvn"
                  type="text"
                  placeholder="Enter your 11-digit BVN"
                  value={bvnInput}
                  onChange={(e) => setBvnInput(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  maxLength={11}
                />
                <p className="text-xs text-muted-foreground">
                  Your BVN is kept secure and only used for virtual account creation.
                </p>
              </div>

              <Button 
                onClick={saveBvn} 
                disabled={savingBvn || bvnInput.length !== 11 || businessNameInput.trim().length < 3}
                className="w-full"
              >
                {savingBvn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save & Continue"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Show create virtual account button if BVN is saved
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
