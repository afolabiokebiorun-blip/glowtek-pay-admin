import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, MapPin, DollarSign, TrendingUp, Activity } from "lucide-react";

const merchantData: Record<string, {
  name: string;
  email: string;
  phone: string;
  address: string;
  status: string;
  joinedDate: string;
  totalRevenue: string;
  transactions: number;
  successRate: string;
  averageTransaction: string;
}> = {
  "1": {
    name: "TechCorp Solutions",
    email: "contact@techcorp.com",
    phone: "+1 (555) 123-4567",
    address: "123 Tech Street, San Francisco, CA 94102",
    status: "active",
    joinedDate: "Jan 15, 2024",
    totalRevenue: "$45,230",
    transactions: 234,
    successRate: "98.5%",
    averageTransaction: "$193.29",
  },
};

export default function MerchantDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const merchant = merchantData[id || "1"] || merchantData["1"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/merchants")}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{merchant.name}</h1>
          <p className="text-muted-foreground mt-1">Merchant Details & Analytics</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">Suspend Account</Button>
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
            Send Message
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Merchant Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Email Address</p>
                <p className="font-medium text-foreground">{merchant.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Phone Number</p>
                <p className="font-medium text-foreground">{merchant.phone}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Business Address</p>
                <p className="font-medium text-foreground">{merchant.address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Activity className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Account Status</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">
                  {merchant.status}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Joined Date</p>
                <p className="font-medium text-foreground">{merchant.joinedDate}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-xl font-bold text-foreground">{merchant.totalRevenue}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary-light/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-primary-light" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="text-xl font-bold text-foreground">{merchant.transactions}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-xl font-bold text-foreground">{merchant.successRate}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
