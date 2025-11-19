import { LayoutDashboard, Users, CreditCard, Settings, Plug, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", path: "/" },
  { icon: Users, label: "Merchants", path: "/merchants" },
  { icon: CreditCard, label: "Transactions", path: "/transactions" },
  { icon: Plug, label: "Processors", path: "/processors" },
  { icon: Settings, label: "Site Content", path: "/settings" },
];

export const Sidebar = () => {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-2xl font-bold text-sidebar-foreground">GlowPay</h1>
        <p className="text-xs text-sidebar-foreground/70 mt-1">Admin Dashboard</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 transition-all duration-200"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-lg"
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <button className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-foreground/10 transition-all duration-200 w-full">
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};
