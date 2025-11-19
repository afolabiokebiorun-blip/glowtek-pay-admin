import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export const DashboardLayout = () => {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col ml-64">
        <Topbar />
        <main className="flex-1 p-6 mt-16">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
