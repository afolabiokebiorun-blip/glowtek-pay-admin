import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, DollarSign, Wallet, CreditCard, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Overview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    balance: 0,
    totalTransactions: 0,
    successfulTransactions: 0,
    successRate: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  async function checkAuthAndLoadData() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/login");
      return;
    }

    await loadData();
  }

  async function loadData() {
    setLoading(true);
    
    // Load wallet balance
    const { data: walletData } = await supabase.functions.invoke("wallet-balance");
    const balance = walletData?.data?.balance || 0;

    // Load transactions
    const { data: txData } = await supabase.functions.invoke("transactions-list", {
      body: { page: 1, limit: 50 },
    });
    const transactions = txData?.data || [];
    
    const successfulTx = transactions.filter((tx: any) => tx.status === "success");
    const successRate = transactions.length > 0 
      ? (successfulTx.length / transactions.length) * 100 
      : 0;

    setStats({
      balance,
      totalTransactions: transactions.length,
      successfulTransactions: successfulTx.length,
      successRate,
    });

    setRecentTransactions(transactions.slice(0, 5));
    setLoading(false);
  }

  const statCards = [
    {
      title: "Wallet Balance",
      value: `₦${(stats.balance / 100).toLocaleString()}`,
      change: "+12.5%",
      trend: "up" as const,
      icon: Wallet,
    },
    {
      title: "Total Transactions",
      value: stats.totalTransactions.toString(),
      change: "+8.2%",
      trend: "up" as const,
      icon: CreditCard,
    },
    {
      title: "Successful Transactions",
      value: stats.successfulTransactions.toString(),
      change: "+23.1%",
      trend: "up" as const,
      icon: DollarSign,
    },
    {
      title: "Success Rate",
      value: `${stats.successRate.toFixed(1)}%`,
      change: "-0.3%",
      trend: stats.successRate >= 95 ? "up" as const : "down" as const,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Overview</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's what's happening today.</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat) => (
              <Card key={stat.title} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <stat.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div
                      className={`flex items-center gap-1 text-sm font-medium ${
                        stat.trend === "up" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {stat.trend === "up" ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                      {stat.change}
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {recentTransactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No transactions yet</p>
              ) : (
                <div className="space-y-4">
                  {recentTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between pb-4 border-b last:border-0">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-foreground font-mono">{tx.reference}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <p className="font-semibold text-sm text-foreground">
                          ₦{(tx.amount / 100).toLocaleString()}
                        </p>
                        <Badge
                          variant={
                            tx.status === "success"
                              ? "default"
                              : tx.status === "pending"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
