import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Eye, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";

const merchants = [
  { id: 1, name: "TechCorp Solutions", email: "contact@techcorp.com", status: "active", revenue: "$45,230", transactions: 234 },
  { id: 2, name: "Digital Ventures", email: "info@digitalventures.com", status: "active", revenue: "$32,150", transactions: 189 },
  { id: 3, name: "Global Traders", email: "support@globaltraders.com", status: "active", revenue: "$58,920", transactions: 412 },
  { id: 4, name: "Smart Retail", email: "hello@smartretail.com", status: "inactive", revenue: "$12,450", transactions: 87 },
  { id: 5, name: "Eco Markets", email: "team@ecomarkets.com", status: "active", revenue: "$28,760", transactions: 156 },
  { id: 6, name: "Urban Store", email: "info@urbanstore.com", status: "active", revenue: "$41,200", transactions: 298 },
  { id: 7, name: "Prime Goods", email: "support@primegoods.com", status: "pending", revenue: "$8,340", transactions: 45 },
  { id: 8, name: "Fashion Hub", email: "contact@fashionhub.com", status: "active", revenue: "$52,180", transactions: 367 },
];

export default function Merchants() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const filteredMerchants = merchants.filter(
    (merchant) =>
      merchant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      merchant.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Merchants</h1>
          <p className="text-muted-foreground mt-1">Manage your merchant accounts</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
          Add Merchant
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search merchants..."
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
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Merchant</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Revenue</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Transactions</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMerchants.map((merchant) => (
                  <tr key={merchant.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="py-4 px-4">
                      <p className="font-medium text-foreground">{merchant.name}</p>
                    </td>
                    <td className="py-4 px-4 text-muted-foreground">{merchant.email}</td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          merchant.status === "active"
                            ? "bg-green-100 text-green-800"
                            : merchant.status === "inactive"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {merchant.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-semibold text-foreground">{merchant.revenue}</td>
                    <td className="py-4 px-4 text-muted-foreground">{merchant.transactions}</td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/merchants/${merchant.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
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
