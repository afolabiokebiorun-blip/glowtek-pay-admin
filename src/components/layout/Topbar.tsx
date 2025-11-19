import { Bell, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Topbar = () => {
  return (
    <header className="fixed top-0 right-0 left-64 h-16 bg-card/70 backdrop-blur-lg border-b border-border z-10 px-6 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search merchants, transactions..."
            className="pl-10 bg-background/50 border-border"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 hover:bg-muted rounded-lg transition-colors">
          <Bell className="w-5 h-5 text-foreground" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full"></span>
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <User className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-foreground">Admin User</p>
            <p className="text-xs text-muted-foreground">admin@glowtek.com</p>
          </div>
        </div>
      </div>
    </header>
  );
};
