import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const navigate = useNavigate();
  const userEmail = localStorage.getItem("userEmail");
  const userRole = localStorage.getItem("userRole");
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

  const handleLogout = () => {
    localStorage.removeItem("userRole");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("isAuthenticated");
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {appLogo ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              <img
                src={appLogo}
                alt="App Logo"
                className="h-9 w-auto max-w-[180px] object-contain"
              />
            </div>
            <div className="h-7 w-px bg-border/60" />
            <h1 className="text-base font-semibold text-muted-foreground">Welcome back!</h1>
          </div>
        ) : (
          <h1 className="text-lg font-semibold">Welcome back!</h1>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon">
          <Bell className="w-5 h-5" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <User className="w-5 h-5" />
              <span className="hidden sm:inline">{userEmail}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>{userRole}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
