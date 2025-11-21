import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Wallet, TrendingUp, TrendingDown, Activity } from "lucide-react";
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

  useEffect(() => {
    async function loadWalletData() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      try {
        // Fetch successful transactions
        const { data: transactionsData, error: transError } = await supabase.functions.invoke(
          "transactions-list",
          { body: { page: 1, limit: 100 } }
        );

        if (transError) throw transError;

        const transactions = transactionsData?.data || [];
        const successfulTransactions = transactions.filter((t: any) => t.status === "success");
        const totalReceived = successfulTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);

        // Fetch payouts
        const { data: payoutsData, error: payoutError } = await supabase.functions.invoke(
          "payouts-list"
        );

        if (payoutError) throw payoutError;

        const payouts = payoutsData?.data || [];
        const completedPayouts = payouts.filter((p: any) => p.status === "sent");
        const totalSpent = completedPayouts.reduce((sum: number, p: any) => sum + p.amount, 0);

        // Calculate virtual balance
        const virtualBalance = totalReceived - totalSpent;

        setStats({
          virtualBalance,
          totalReceived,
          totalSpent,
          transactionCount: successfulTransactions.length,
          payoutCount: completedPayouts.length,
        });

        // Combine recent transactions and payouts for activity feed
        const recentTransactions = successfulTransactions.slice(0, 5).map((t: any) => ({
          ...t,
          type: "received",
          date: t.created_at,
        }));

        const recentPayouts = completedPayouts.slice(0, 5).map((p: any) => ({
          ...p,
          type: "payout",
          date: p.created_at,
        }));

        const combined = [...recentTransactions, ...recentPayouts]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10);

        setRecentActivity(combined);
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
      <div className="flex items-center gap-3 mb-6">
        <Wallet className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">GlowWallet</h1>
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
                        {item.type === "received" ? "Payment Received" : "Payout Sent"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.reference} • {formatDate(item.date)}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`text-lg font-semibold ${
                      item.type === "received" ? "text-green-600" : "text-orange-600"
                    }`}
                  >
                    {item.type === "received" ? "+" : "-"}
                    {formatAmount(item.amount)}
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
