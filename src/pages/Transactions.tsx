import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, Filter, TrendingUp, TrendingDown, ArrowDownToLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface LedgerEntry {
  id: string;
  entry_type: string;
  amount: number;
  reference: string;
  created_at: string;
  metadata: any;
}

export default function Transactions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    async function loadTransactions() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      try {
        const { data, error } = await supabase
          .from('ledger_entries')
          .select('*')
          .eq('merchant_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setLedgerEntries(data || []);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load transactions",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    loadTransactions();
  }, [navigate, toast]);

  const filteredTransactions = ledgerEntries.filter(
    (entry) =>
      entry.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.entry_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTypeIcon = (type: string) => {
    if (type === 'CREDIT') return <TrendingUp className="h-5 w-5 text-green-600" />;
    if (type === 'DEBIT' || type === 'WITHDRAWAL') return <ArrowDownToLine className="h-5 w-5 text-orange-600" />;
    if (type === 'REVERSAL') return <TrendingUp className="h-5 w-5 text-blue-600" />;
    return <TrendingDown className="h-5 w-5 text-muted-foreground" />;
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'CREDIT': return 'Credit';
      case 'DEBIT': return 'Debit';
      case 'WITHDRAWAL': return 'Withdrawal';
      case 'REVERSAL': return 'Reversal';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Transactions</h1>
        <p>Loading transactions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Transactions</h1>
          <p className="text-muted-foreground mt-1">View and manage all payment transactions</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </Button>
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No transactions found</p>
          ) : (
            <div className="space-y-3">
              {filteredTransactions.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      {getTypeIcon(entry.entry_type)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {getTypeLabel(entry.entry_type)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {entry.reference}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(entry.created_at)} • {formatTime(entry.created_at)}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`text-lg font-semibold ${
                      entry.entry_type === 'CREDIT' || entry.entry_type === 'REVERSAL'
                        ? "text-green-600"
                        : "text-orange-600"
                    }`}
                  >
                    {entry.entry_type === 'CREDIT' || entry.entry_type === 'REVERSAL' ? "+" : "-"}
                    {formatAmount(Math.abs(entry.amount))}
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
