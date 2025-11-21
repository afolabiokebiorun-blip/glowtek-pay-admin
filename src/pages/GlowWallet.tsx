import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Wallet, TrendingUp, TrendingDown, Activity, Plus, ArrowDownToLine, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WalletStats {
  virtualBalance: number;
  totalReceived: number;
  totalSpent: number;
  transactionCount: number;
  payoutCount: number;
}

export default function GlowWallet() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<WalletStats>({
    virtualBalance: 0,
    totalReceived: 0,
    totalSpent: 0,
    transactionCount: 0,
    payoutCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [topupAmount, setTopupAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [topupOpen, setTopupOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    async function loadWalletData() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      try {
        // Fetch wallet balance
        const { data: walletData, error: walletError } = await supabase
          .from('wallets')
          .select('available_balance, balance')
          .eq('merchant_id', session.user.id)
          .single();

        if (walletError) throw walletError;

        const availableBalance = walletData?.available_balance || 0;

        // Fetch ledger entries for detailed stats
        const { data: ledgerData, error: ledgerError } = await supabase
          .from('ledger_entries')
          .select('*')
          .eq('merchant_id', session.user.id)
          .order('created_at', { ascending: false });

        if (ledgerError) throw ledgerError;

        const ledgerEntries = ledgerData || [];

        // Calculate stats from ledger
        const totalReceived = ledgerEntries
          .filter(e => e.entry_type === 'CREDIT')
          .reduce((sum, e) => sum + e.amount, 0);

        const totalSpent = ledgerEntries
          .filter(e => e.entry_type === 'DEBIT' || e.entry_type === 'WITHDRAWAL')
          .reduce((sum, e) => sum + Math.abs(e.amount), 0);

        const transactionCount = ledgerEntries.filter(e => e.entry_type === 'CREDIT').length;
        const payoutCount = ledgerEntries.filter(e => e.entry_type === 'WITHDRAWAL').length;

        setStats({
          virtualBalance: availableBalance,
          totalReceived,
          totalSpent,
          transactionCount,
          payoutCount,
        });

        // Set recent activity from ledger entries
        const recentEntries = ledgerEntries.slice(0, 10).map(entry => ({
          ...entry,
          type: entry.entry_type === 'CREDIT' || entry.entry_type === 'REVERSAL' ? 'received' : 'payout',
          date: entry.created_at,
        }));

        setRecentActivity(recentEntries);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load wallet data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    loadWalletData();
  }, [navigate, toast]);

  const handleTopup = async () => {
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('wallet-topup-initialize', {
        body: { amount: Math.round(amount * 100) }
      });

      if (error) throw error;

      // Open payment link in new window
      window.open(data.data.payment_link, '_blank');
      
      toast({
        title: "Success",
        description: "Payment link opened. Complete the payment to add funds to your wallet.",
      });

      setTopupOpen(false);
      setTopupAmount("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to initialize top-up",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    const amountInKobo = Math.round(amount * 100);
    if (amountInKobo > stats.virtualBalance) {
      toast({
        title: "Error",
        description: "Insufficient balance",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('withdrawal-request', {
        body: { amount: amountInKobo }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Withdrawal request submitted successfully. Funds will be transferred to your bank account.",
      });

      setWithdrawOpen(false);
      setWithdrawAmount("");
      
      // Reload wallet data
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process withdrawal",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">GlowWallet</h1>
        <p>Loading wallet data...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wallet className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">GlowWallet</h1>
        </div>
        <div className="flex gap-3">
          <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Top Up
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Top Up GlowWallet</DialogTitle>
                <DialogDescription>
                  Add funds to your wallet via card or bank transfer
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="topup-amount">Amount (NGN)</Label>
                  <Input
                    id="topup-amount"
                    type="number"
                    placeholder="0.00"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTopupOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleTopup} disabled={processing}>
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Continue to Payment"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ArrowDownToLine className="h-4 w-4" />
                Withdraw
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Withdraw from GlowWallet</DialogTitle>
                <DialogDescription>
                  Transfer funds to your registered bank account
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="withdraw-amount">Amount (NGN)</Label>
                  <Input
                    id="withdraw-amount"
                    type="number"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    max={(stats.virtualBalance / 100).toFixed(2)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Available balance: {formatAmount(stats.virtualBalance)}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setWithdrawOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleWithdraw} disabled={processing}>
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Withdraw Funds"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <p className="text-muted-foreground mb-6">
        Your virtual balance tracks total earnings from successful transactions minus completed payouts. 
        Real funds remain in your actual merchant account.
      </p>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Virtual Balance
            </CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Total available balance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{formatAmount(stats.virtualBalance)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <TrendingUp className="h-5 w-5" />
              Total Received
            </CardTitle>
            <CardDescription>From {stats.transactionCount} transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{formatAmount(stats.totalReceived)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <TrendingDown className="h-5 w-5" />
              Total Spent
            </CardTitle>
            <CardDescription>From {stats.payoutCount} payouts</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">{formatAmount(stats.totalSpent)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Your latest transactions and payouts</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No activity yet</p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {item.type === "received" ? (
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                        <TrendingDown className="h-5 w-5 text-orange-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">
                        {item.entry_type === 'CREDIT' || item.entry_type === 'REVERSAL' 
                          ? "Payment Received" 
                          : item.entry_type === 'WITHDRAWAL'
                          ? "Withdrawal"
                          : "Debit"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.reference} • {formatDate(item.date)}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`text-lg font-semibold ${
                      item.entry_type === 'CREDIT' || item.entry_type === 'REVERSAL' ? "text-green-600" : "text-orange-600"
                    }`}
                  >
                    {item.entry_type === 'CREDIT' || item.entry_type === 'REVERSAL' ? "+" : "-"}
                    {formatAmount(Math.abs(item.amount))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
