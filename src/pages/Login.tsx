import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { STORAGE_KEYS } from "@/lib/storage-utils";
import { 
  hashPassword, 
  verifyPassword, 
  setSession, 
  checkLoginRateLimit, 
  recordLoginAttempt,
  sanitizeInput 
} from "@/lib/security-utils";
import { Eye, EyeOff } from "lucide-react";

interface User {
  id: string;
  username: string;
  password: string;
  permission: "view" | "editor" | "admin";
  createdAt: string;
  district?: string;
}

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [focusField, setFocusField] = useState<"username" | "password" | null>(null);
  const supportEmailFallback = "support@service-tracker.local";

  useEffect(() => {
    const loadLogo = () => {
      const storedLogo = localStorage.getItem("appLogo");
      setAppLogo(storedLogo);
    };

    loadLogo();
    window.addEventListener("logoUpdated", loadLogo);
    return () => window.removeEventListener("logoUpdated", loadLogo);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Sanitize inputs
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedPassword = password; // Don't sanitize password, but validate
    
    if (!sanitizedUsername || !sanitizedPassword) {
      toast.error("Please enter both username and password");
      setIsLoading(false);
      return;
    }

    // Check rate limiting
    const rateLimitCheck = checkLoginRateLimit();
    if (!rateLimitCheck.allowed) {
      toast.error(
        `Too many failed login attempts. Please try again in ${rateLimitCheck.remainingTime} minutes.`
      );
      setIsLoading(false);
      return;
    }

    // Check admin credentials (hash stored admin password)
    // For initial setup, we'll check plain text but then migrate to hashed
    const adminPasswordHash = localStorage.getItem("adminPasswordHash");
    let adminAuthenticated = false;

    if (sanitizedUsername === "admin") {
      if (adminPasswordHash) {
        // Use hashed password
        adminAuthenticated = verifyPassword(sanitizedPassword, adminPasswordHash);
      } else {
        // First time login - check plain text and migrate
        if (sanitizedPassword === "admin123") {
          adminAuthenticated = true;
          // Hash and store for future use
          const hash = hashPassword(sanitizedPassword);
          localStorage.setItem("adminPasswordHash", hash);
        }
      }

      if (adminAuthenticated) {
        const userRole = "admin";
        setSession(userRole);
        localStorage.setItem("userEmail", sanitizedUsername);
        localStorage.setItem("userPermission", "admin");
        localStorage.setItem("isAuthenticated", "true");
        recordLoginAttempt(true);
        toast.success("Logged in as admin");
        
        const from = (location.state as any)?.from?.pathname || "/dashboard";
        navigate(from, { replace: true });
        setIsLoading(false);
        return;
      }
    }

    // Check created users
    let usersJson = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!usersJson) {
      usersJson = localStorage.getItem("users");
    }
    
    if (usersJson) {
      try {
        const users: User[] = JSON.parse(usersJson);
        const user = users.find(u => u.username === sanitizedUsername);
        
        if (user) {
          // Check if password is hashed (contains ':') or plain text
          let passwordValid = false;
          if (user.password.includes(':')) {
            // Hashed password
            passwordValid = verifyPassword(sanitizedPassword, user.password);
          } else {
            // Plain text password - verify and migrate
            if (user.password === sanitizedPassword) {
              passwordValid = true;
              // Migrate to hashed password
              const hash = hashPassword(sanitizedPassword);
              const updatedUsers = users.map(u => 
                u.id === user.id ? { ...u, password: hash } : u
              );
              localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
            }
          }

          if (passwordValid) {
            const userRole = user.permission === "admin" ? "admin" : "user";
            setSession(userRole);
            localStorage.setItem("userEmail", sanitizedUsername);
            localStorage.setItem("userId", user.id);
            localStorage.setItem("userPermission", user.permission);
            if (user.district) {
              localStorage.setItem("userDistrict", user.district);
            }
            localStorage.setItem("isAuthenticated", "true");
            recordLoginAttempt(true);
            
            const roleDisplay = user.permission === "admin" ? "admin" : user.permission;
            toast.success(`Logged in as ${roleDisplay}`);
            
            const from = (location.state as any)?.from?.pathname || "/dashboard";
            navigate(from, { replace: true });
            setIsLoading(false);
            return;
          }
        }
      } catch (error) {
        console.error("Error parsing users:", error);
      }
    }

    // Failed login
    recordLoginAttempt(false);
    toast.error("Invalid username or password");
    setIsLoading(false);
  };

  const handleRequestAccess = () => {
    const configuredEmail =
      localStorage.getItem("supportEmail") ||
      localStorage.getItem("adminEmail") ||
      supportEmailFallback;
    const subject = encodeURIComponent("Access Request - Service Tracker");
    const body = encodeURIComponent(
      "Hello Team,\n\nI need access to the service tracker portal. Please help me get onboarded.\n\nThank you!"
    );

    toast.info(`Opening an email draft to ${configuredEmail}`);
    window.location.href = `mailto:${configuredEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.25),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(248,113,113,0.2),_transparent_60%)]" />
      <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-gradient-to-br from-sky-500/30 via-indigo-500/20 to-purple-500/20 blur-3xl animate-blob" />
      <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-gradient-to-br from-emerald-500/20 via-lime-500/20 to-yellow-500/20 blur-3xl animate-blob animation-delay-2000" />

      <div className="relative z-10 w-full max-w-lg">
        <Card className="border border-white/20 bg-slate-900/70 text-white shadow-2xl shadow-cyan-500/30 backdrop-blur-md">
          <CardHeader className="space-y-4 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-inner shadow-black/20">
                {appLogo ? (
                  <img
                    src={appLogo}
                    alt="App Logo"
                    className="max-h-14 w-auto object-contain"
                  />
                ) : (
                  <span className="text-lg font-semibold text-white/80">Service</span>
                )}
              </div>
              <CardTitle className="text-3xl font-semibold">Welcome Back</CardTitle>
              <CardDescription className="text-base text-white/70">
                Enter your credentials to access the dashboard.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium text-white/80">
                  Username
                </Label>
                <div className={`relative rounded-2xl border px-4 py-2 transition focus-within:border-cyan-400 ${focusField === "username" ? "border-cyan-400 bg-cyan-400/5" : "border-white/20 bg-white/10"}`}>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(sanitizeInput(e.target.value))}
                    onFocus={() => setFocusField("username")}
                    onBlur={() => setFocusField(null)}
                    required
                    autoComplete="username"
                    className="border-none bg-transparent text-base text-white placeholder-white/50 focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-white/80">
                  Password
                </Label>
                <div className={`relative rounded-2xl border px-4 py-2 transition focus-within:border-fuchsia-400 ${focusField === "password" ? "border-fuchsia-400 bg-fuchsia-400/5" : "border-white/20 bg-white/10"}`}>
                  <Input
                    id="password"
                    type={isPasswordVisible ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusField("password")}
                    onBlur={() => setFocusField(null)}
                    required
                    autoComplete="current-password"
                    className="border-none bg-transparent text-base text-white placeholder-white/50 focus-visible:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible((prev) => !prev)}
                    className="absolute inset-y-0 right-3 flex items-center text-white/60 transition hover:text-white"
                    aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                  >
                    {isPasswordVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Having trouble? Contact your admin</span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleRequestAccess}
                  className="h-8 rounded-full border border-white/20 bg-white/5 text-xs text-white hover:bg-white/20"
                >
                  Request Access
                </Button>
              </div>

              <Button
                type="submit"
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 py-6 text-lg font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:scale-[1.01]"
                disabled={isLoading}
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
