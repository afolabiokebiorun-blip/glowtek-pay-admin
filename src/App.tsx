import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { SiteSettingsProvider } from "./contexts/SiteSettingsContext";
import Overview from "./pages/Overview";
import Merchants from "./pages/Merchants";
import MerchantDetails from "./pages/MerchantDetails";
import Transactions from "./pages/Transactions";
import Settings from "./pages/Settings";
import ProcessorSettings from "./pages/ProcessorSettings";
import ApiKeys from "./pages/ApiKeys";
import Webhooks from "./pages/Webhooks";
import Payouts from "./pages/Payouts";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import GlowWallet from "./pages/GlowWallet";
import BankSetup from "./pages/BankSetup";
import VirtualAccount from "./pages/VirtualAccount";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SiteSettingsProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Overview />} />
              <Route path="/merchants" element={<Merchants />} />
              <Route path="/merchants/:id" element={<MerchantDetails />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/processors" element={<ProcessorSettings />} />
              <Route path="/api-keys" element={<ApiKeys />} />
              <Route path="/webhooks" element={<Webhooks />} />
              <Route path="/payouts" element={<Payouts />} />
              <Route path="/glowwallet" element={<GlowWallet />} />
              <Route path="/bank-setup" element={<BankSetup />} />
              <Route path="/virtual-account" element={<VirtualAccount />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </SiteSettingsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
