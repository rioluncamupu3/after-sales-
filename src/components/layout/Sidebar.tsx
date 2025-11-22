import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Package,
  ClipboardList,
  Users,
  Upload,
  BarChart3,
  UserCheck,
  Settings,
} from "lucide-react";

const Sidebar = () => {
  const userRole = localStorage.getItem("userRole");
  const isAdmin = userRole === "admin";
  const [appLogo, setAppLogo] = useState<string | null>(null);

  useEffect(() => {
    const loadLogo = () => {
      const logo = localStorage.getItem("appLogo");
      setAppLogo(logo);
    };
    
    loadLogo();
    
    // Listen for logo updates
    window.addEventListener("logoUpdated", loadLogo);
    return () => window.removeEventListener("logoUpdated", loadLogo);
  }, []);

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: FileText, label: "Cases", path: "/cases" },
    { icon: Package, label: "Spare Parts", path: "/spare-parts" },
    { icon: ClipboardList, label: "Pending Items", path: "/pending" },
    { icon: UserCheck, label: "Technicians", path: "/manage-technicians" },
    ...(isAdmin ? [
      { icon: Users, label: "Users", path: "/technicians" },
      { icon: Upload, label: "Import Data", path: "/import" },
      { icon: BarChart3, label: "Reports", path: "/reports" },
    ] : []),
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  return (
    <aside className="w-64 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 border-r border-gray-700/50 flex flex-col shadow-2xl">
      <div className="p-5 border-b border-gray-700/50 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
        {appLogo ? (
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-full flex items-center justify-center py-1">
              <img
                src={appLogo}
                alt="App Logo"
                className="h-16 w-auto max-w-full object-contain drop-shadow-lg"
              />
            </div>
            <p className="text-xs font-medium text-gray-300 text-center bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
              {isAdmin ? "Admin Panel" : "User Portal"}
            </p>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              After-Sales System
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {isAdmin ? "Admin Panel" : "User Portal"}
            </p>
          </div>
        )}
      </div>
      
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 transition-all duration-200 relative overflow-hidden",
                "hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-purple-600/20 hover:text-white hover:shadow-lg hover:scale-105",
                isActive && "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105 font-semibold"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-r from-blue-600/0 to-purple-600/0 transition-opacity duration-200",
                  "group-hover:from-blue-600/10 group-hover:to-purple-600/10"
                )} />
                <item.icon className="w-5 h-5 relative z-10 group-hover:scale-110 transition-transform duration-200" />
                <span className="relative z-10 flex-1">{item.label}</span>
                {isActive && (
                  <div className="absolute right-2 w-2 h-2 bg-white rounded-full animate-pulse" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
