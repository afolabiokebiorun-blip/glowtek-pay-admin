import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wallet, Plus, DollarSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Payout {
  id: string;
  amount: number;
  status: string;
  reference: string;
  created_at: string;
  processed_at: string | null;
  bank_account: any;
}

export default function Payouts() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  async function checkAuthAndLoadData() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/login");
      return;
    }

    await Promise.all([loadWalletBalance(), loadPayouts()]);
  }

  async function loadWalletBalance() {
    const { data, error } = await supabase.functions.invoke("wallet-balance");
    
    if (!error && data) {
      setWalletBalance(data.data.balance || 0);
    }
  }

  async function loadPayouts() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("payouts-list");
    
    if (!error && data) {
      setPayouts(data.data || []);
    }
    setLoading(false);
  }

  async function requestPayout() {
    const amountNum = parseFloat(amount);
    
    if (!amountNum || amountNum <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (amountNum > walletBalance) {
      toast({
        title: "Error",
        description: "Insufficient wallet balance",
        variant: "destructive",
      });
      return;
    }

    if (!accountName || !accountNumber || !bankName) {
      toast({
        title: "Error",
        description: "Please fill in all bank account details",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.functions.invoke("payouts-request", {
      body: {
        amount: amountNum,
        bankAccount: {
          accountName,
          accountNumber,
          bankName,
        },
      },
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to request payout",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Payout requested successfully",
      });
      setAmount("");
      setAccountName("");
      setAccountNumber("");
      setBankName("");
      setShowRequestDialog(false);
      await Promise.all([loadWalletBalance(), loadPayouts()]);
    }
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      sent: "default",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Payouts</h1>
          <p className="text-muted-foreground">Request withdrawals and view payout history</p>
        </div>
        <Button onClick={() => setShowRequestDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Request Payout
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Available Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">
            ₦{(walletBalance / 100).toLocaleString()}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Minimum payout: ₦1,000
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>Track your withdrawal requests and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading payouts...</p>
          ) : payouts.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No payouts yet</p>
              <Button onClick={() => setShowRequestDialog(true)}>Request Your First Payout</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Processed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-mono text-sm">{payout.reference}</TableCell>
                    <TableCell>₦{(payout.amount / 100).toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(payout.status)}</TableCell>
                    <TableCell>{new Date(payout.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      {payout.processed_at
                        ? new Date(payout.processed_at).toLocaleString()
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>
              Enter the amount and bank account details for your withdrawal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount (₦)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="10000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available: ₦{(walletBalance / 100).toLocaleString()}
              </p>
            </div>
            <div>
              <Label htmlFor="accountName">Account Name</Label>
              <Input
                id="accountName"
                placeholder="John Doe"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input
                id="accountNumber"
                placeholder="0123456789"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                placeholder="GTBank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>
              Cancel
            </Button>
            <Button onClick={requestPayout}>Request Payout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
