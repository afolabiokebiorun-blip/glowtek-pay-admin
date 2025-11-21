import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

const NIGERIAN_BANKS = [
  { code: "044", name: "Access Bank" },
  { code: "063", name: "Access Bank (Diamond)" },
  { code: "035A", name: "ALAT by WEMA" },
  { code: "401", name: "ASO Savings and Loans" },
  { code: "50931", name: "Bowen Microfinance Bank" },
  { code: "FC40163", name: "CEMCS Microfinance Bank" },
  { code: "023", name: "Citibank Nigeria" },
  { code: "559", name: "Coronation Merchant Bank" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "562", name: "Ekondo Microfinance Bank" },
  { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank" },
  { code: "501", name: "FSDH Merchant Bank Limited" },
  { code: "00103", name: "Globus Bank" },
  { code: "058", name: "Guaranty Trust Bank" },
  { code: "030", name: "Heritage Bank" },
  { code: "301", name: "Jaiz Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "50211", name: "Kuda Bank" },
  { code: "526", name: "Parallex Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "125", name: "Rubies MFB" },
  { code: "51310", name: "Sparkle Microfinance Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "100", name: "Suntrust Bank" },
  { code: "302", name: "TAJ Bank" },
  { code: "51211", name: "TCF MFB" },
  { code: "102", name: "Titan Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank For Africa" },
  { code: "215", name: "Unity Bank" },
  { code: "566", name: "VFD Microfinance Bank Limited" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
];

export default function BankSetup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [existingDetails, setExistingDetails] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }
    loadExistingDetails();
  };

  const loadExistingDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: merchant, error } = await supabase
        .from('merchants')
        .select('bank_code, bank_name, account_number, resolved_account_name')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (merchant && merchant.account_number) {
        setExistingDetails(merchant);
        setBankCode(merchant.bank_code || "");
        setAccountNumber(merchant.account_number || "");
        setAccountName(merchant.resolved_account_name || "");
        setIsVerified(true);
      }
    } catch (error) {
      console.error('Error loading bank details:', error);
    }
  };

  const verifyAccount = async () => {
    if (!bankCode || !accountNumber) {
      toast.error("Please select bank and enter account number");
      return;
    }

    if (accountNumber.length !== 10) {
      toast.error("Account number must be 10 digits");
      return;
    }

    setVerifying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const selectedBank = NIGERIAN_BANKS.find(b => b.code === bankCode);

      const { data, error } = await supabase.functions.invoke('bank-account-verify', {
        body: {
          account_number: accountNumber,
          bank_code: bankCode,
          bank_name: selectedBank?.name || "",
        },
      });

      if (error) throw error;

      if (data.status === 'success') {
        setAccountName(data.data.account_name);
        setIsVerified(true);
        toast.success("Bank account verified and saved!");
        setTimeout(() => navigate("/settings"), 1500);
      } else {
        throw new Error(data.error || "Failed to verify account");
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      toast.error(error.message || "Failed to verify account");
      setIsVerified(false);
      setAccountName("");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Bank Account Setup</CardTitle>
          <CardDescription>
            Add your bank account details for withdrawals. Your account will be verified using Flutterwave.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {existingDetails && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Current Bank Account
              </div>
              <div className="text-sm space-y-1 pl-6">
                <p><span className="font-medium">Bank:</span> {existingDetails.bank_name}</p>
                <p><span className="font-medium">Account Number:</span> {existingDetails.account_number}</p>
                <p><span className="font-medium">Account Name:</span> {existingDetails.resolved_account_name}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="bank">Select Bank</Label>
            <Select value={bankCode} onValueChange={setBankCode}>
              <SelectTrigger>
                <SelectValue placeholder="Choose your bank" />
              </SelectTrigger>
              <SelectContent>
                {NIGERIAN_BANKS.map((bank) => (
                  <SelectItem key={bank.code} value={bank.code}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              placeholder="Enter 10-digit account number"
              value={accountNumber}
              onChange={(e) => {
                setAccountNumber(e.target.value);
                setIsVerified(false);
                setAccountName("");
              }}
              maxLength={10}
            />
          </div>

          {accountName && isVerified && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800 font-medium">
                <CheckCircle2 className="h-5 w-5" />
                Account Verified
              </div>
              <p className="text-sm text-green-700 mt-1">
                Account Name: {accountName}
              </p>
            </div>
          )}

          <Button
            onClick={verifyAccount}
            disabled={verifying || !bankCode || !accountNumber || accountNumber.length !== 10}
            className="w-full"
          >
            {verifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify & Save Account"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
