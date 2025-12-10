import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Loader2, AlertCircle, Plus } from "lucide-react";

interface VirtualAccountData {
  id: string;
  account_number: string;
  bank_name: string;
  account_name: string;
  order_ref: string;
  currency: string;
}

interface MerchantData {
  bvn: string | null;
  phone: string | null;
  business_name: string;
  virtual_account_name: string | null;
}

const SUPPORTED_CURRENCIES = [
  { code: 'NGN', name: 'Nigerian Naira', flag: '🇳🇬', requiresBvn: true },
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸', requiresBvn: false },
  { code: 'GBP', name: 'British Pound', flag: '🇬🇧', requiresBvn: false },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺', requiresBvn: false },
  { code: 'KES', name: 'Kenyan Shilling', flag: '🇰🇪', requiresBvn: false },
  { code: 'GHS', name: 'Ghanaian Cedi', flag: '🇬🇭', requiresBvn: false },
  { code: 'ZAR', name: 'South African Rand', flag: '🇿🇦', requiresBvn: false },
];

export default function VirtualAccount() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingBvn, setSavingBvn] = useState(false);
  const [virtualAccounts, setVirtualAccounts] = useState<VirtualAccountData[]>([]);
  const [hasFlutterwaveConfig, setHasFlutterwaveConfig] = useState(false);
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [bvnInput, setBvnInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [businessNameInput, setBusinessNameInput] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("NGN");
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }
    await Promise.all([
      checkFlutterwaveConfig(),
      loadMerchantData(),
      loadVirtualAccounts(),
    ]);
  };

  const loadMerchantData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('merchants')
        .select('bvn, phone, business_name, virtual_account_name')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setMerchant(data);
        setPhoneInput(data.phone || "");
        setBvnInput(data.bvn || "");
        setBusinessNameInput(data.virtual_account_name || data.business_name || "");
      }
    } catch (error: any) {
      console.error('Error loading merchant data:', error);
    }
  };

  const saveDetails = async () => {
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

      const updateData: Record<string, string> = {
        virtual_account_name: businessNameInput.trim()
      };

      // Only update BVN if provided and valid
      if (bvnInput && bvnInput.trim().length === 11) {
        updateData.bvn = bvnInput.trim();
      }

      // Only update phone if provided
      if (phoneInput && phoneInput.trim().length >= 10) {
        updateData.phone = phoneInput.trim();
      }

      const { error } = await supabase
        .from('merchants')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      setMerchant({ 
        ...merchant!, 
        bvn: updateData.bvn || merchant?.bvn || null,
        phone: updateData.phone || merchant?.phone || null,
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

  const loadVirtualAccounts = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('virtual_accounts')
        .select('*')
        .eq('merchant_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setVirtualAccounts(data);
      }
    } catch (error: any) {
      console.error('Error loading virtual accounts:', error);
      toast.error("Failed to load virtual accounts");
    } finally {
      setLoading(false);
    }
  };

  const getAvailableCurrencies = () => {
    const existingCurrencies = virtualAccounts.map(va => va.currency);
    return SUPPORTED_CURRENCIES.filter(c => !existingCurrencies.includes(c.code));
  };

  const createVirtualAccount = async () => {
    if (!hasFlutterwaveConfig) {
      toast.error("Please configure Flutterwave credentials first in Processor Settings");
      navigate("/processor-settings");
      return;
    }

    const trimmedName = businessNameInput.trim();

    if (!trimmedName || trimmedName.length < 3) {
      toast.error("Please enter a business name (at least 3 characters)");
      return;
    }

    if (trimmedName.length > 50) {
      toast.error("Business name must be less than 50 characters");
      return;
    }

    const currencyConfig = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency);
    if (currencyConfig?.requiresBvn && !merchant?.bvn) {
      toast.error("BVN is required for NGN accounts. Please save your BVN first.");
      return;
    }

    // Phone is required for non-NGN accounts
    if (!currencyConfig?.requiresBvn && !merchant?.phone) {
      toast.error("Phone number is required for foreign currency accounts. Please save your phone number first.");
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: updateError } = await supabase
        .from('merchants')
        .update({ virtual_account_name: trimmedName })
        .eq('id', user.id);

      if (updateError) throw updateError;

      const { data, error } = await supabase.functions.invoke('virtual-account-create', {
        body: { currency: selectedCurrency }
      });

      if (error) throw error;

      if (data.status === 'success') {
        setVirtualAccounts(prev => [data.data, ...prev]);
        setShowCreateForm(false);
        toast.success(`${selectedCurrency} virtual account created successfully!`);
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

  const getCurrencyInfo = (code: string) => {
    return SUPPORTED_CURRENCIES.find(c => c.code === code);
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

  const availableCurrencies = getAvailableCurrencies();

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Setup Section - Show if missing BVN or phone */}
      {(!merchant?.bvn || !merchant?.phone) && (
        <Card>
          <CardHeader>
            <CardTitle>Account Setup</CardTitle>
            <CardDescription>Complete your profile to create virtual accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Requirements:</strong>
                <br />• BVN is required for NGN accounts
                <br />• Phone number is required for foreign currency accounts (USD, GBP, EUR, etc.)
              </p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  type="text"
                  placeholder="Enter your business name"
                  value={businessNameInput}
                  onChange={(e) => setBusinessNameInput(e.target.value.slice(0, 50))}
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number {merchant?.phone && <span className="text-green-600">✓</span>}</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="e.g., 08012345678"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/[^\d+]/g, '').slice(0, 15))}
                  maxLength={15}
                />
                <p className="text-xs text-muted-foreground">Required for foreign currency accounts</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bvn">BVN (11 digits) {merchant?.bvn && <span className="text-green-600">✓</span>}</Label>
                <Input
                  id="bvn"
                  type="text"
                  placeholder="Enter your 11-digit BVN"
                  value={bvnInput}
                  onChange={(e) => setBvnInput(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  maxLength={11}
                />
                <p className="text-xs text-muted-foreground">Required for NGN accounts</p>
              </div>
            </div>

            <Button 
              onClick={saveDetails} 
              disabled={savingBvn || businessNameInput.trim().length < 3}
            >
              {savingBvn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Details"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Existing Virtual Accounts */}
      {virtualAccounts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Virtual Accounts</CardTitle>
              <CardDescription>Use these accounts to receive payments in different currencies</CardDescription>
            </div>
            {availableCurrencies.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Currency
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {virtualAccounts.map((account) => {
              const currencyInfo = getCurrencyInfo(account.currency);
              return (
                <div key={account.id} className="p-4 bg-muted rounded-lg space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{currencyInfo?.flag}</span>
                    <span className="font-semibold text-lg">{account.currency}</span>
                    <span className="text-muted-foreground text-sm">- {currencyInfo?.name}</span>
                  </div>
                  
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Bank Name</p>
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{account.bank_name}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(account.bank_name, "Bank name")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Account Number</p>
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-lg">{account.account_number}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(account.account_number, "Account number")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Account Name</p>
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{account.account_name}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(account.account_name, "Account name")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Create New Account Form */}
      {(showCreateForm || virtualAccounts.length === 0) && availableCurrencies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {virtualAccounts.length === 0 ? 'Create Virtual Account' : 'Add New Currency Account'}
            </CardTitle>
            <CardDescription>
              Create a virtual account to receive payments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Currency</Label>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a currency" />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      <span className="flex items-center gap-2">
                        <span>{currency.flag}</span>
                        <span>{currency.code}</span>
                        <span className="text-muted-foreground">- {currency.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency)?.requiresBvn && !merchant?.bvn && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900">BVN Required</p>
                  <p className="text-sm text-amber-700 mt-1">
                    Please save your BVN above before creating an NGN account.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="createBusinessName">Business Name</Label>
              <Input
                id="createBusinessName"
                type="text"
                placeholder="Enter your business name"
                value={businessNameInput}
                onChange={(e) => setBusinessNameInput(e.target.value.slice(0, 50))}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                This name will appear on your virtual account.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={createVirtualAccount}
                disabled={
                  creating || 
                  businessNameInput.trim().length < 3 ||
                  (SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency)?.requiresBvn && !merchant?.bvn)
                }
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  `Create ${selectedCurrency} Account`
                )}
              </Button>
              {virtualAccounts.length > 0 && (
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Note */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> All payments received to your virtual accounts will be credited to your GlowWallet.
        </p>
      </div>
    </div>
  );
}