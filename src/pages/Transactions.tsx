import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, Filter } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

const transactions = [
  { id: "TXN001", merchant: "TechCorp Solutions", amount: "$2,400", status: "completed", date: "2024-01-15", time: "10:30 AM", trend: [40, 55, 45, 60, 50, 70, 65] },
  { id: "TXN002", merchant: "Digital Ventures", amount: "$1,800", status: "completed", date: "2024-01-15", time: "09:15 AM", trend: [30, 40, 35, 50, 45, 55, 60] },
  { id: "TXN003", merchant: "Global Traders", amount: "$5,200", status: "pending", date: "2024-01-15", time: "08:45 AM", trend: [50, 65, 60, 75, 70, 85, 80] },
  { id: "TXN004", merchant: "Smart Retail", amount: "$980", status: "completed", date: "2024-01-14", time: "04:20 PM", trend: [20, 25, 30, 28, 35, 32, 40] },
  { id: "TXN005", merchant: "Eco Markets", amount: "$3,150", status: "completed", date: "2024-01-14", time: "02:30 PM", trend: [45, 50, 48, 55, 60, 58, 65] },
  { id: "TXN006", merchant: "Urban Store", amount: "$1,450", status: "failed", date: "2024-01-14", time: "01:15 PM", trend: [35, 30, 32, 28, 30, 25, 20] },
  { id: "TXN007", merchant: "Fashion Hub", amount: "$2,890", status: "completed", date: "2024-01-14", time: "11:00 AM", trend: [40, 45, 50, 48, 55, 52, 60] },
  { id: "TXN008", merchant: "Prime Goods", amount: "$720", status: "completed", date: "2024-01-13", time: "05:45 PM", trend: [15, 20, 18, 25, 22, 28, 30] },
];

export default function Transactions() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTransactions = transactions.filter(
    (txn) =>
      txn.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.merchant.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Transaction ID</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Merchant</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Amount</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Time</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Trend</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((txn) => (
                  <tr key={txn.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="py-4 px-4">
                      <p className="font-medium text-foreground">{txn.id}</p>
                    </td>
                    <td className="py-4 px-4 text-muted-foreground">{txn.merchant}</td>
                    <td className="py-4 px-4 font-semibold text-foreground">{txn.amount}</td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          txn.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : txn.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {txn.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-muted-foreground">{txn.date}</td>
                    <td className="py-4 px-4 text-muted-foreground">{txn.time}</td>
                    <td className="py-4 px-4">
                      <div className="w-24 h-8">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={txn.trend.map((value, index) => ({ value, index }))}>
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="hsl(var(--primary-light))"
                              strokeWidth={2}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
