import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { requireAuth } from "@/lib/security-utils";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "admin" | "editor" | "view";
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = () => {
      const authorized = requireAuth(requiredRole);
      setIsAuthorized(authorized);
    };

    checkAuth();
    // Check auth on mount and periodically
    const interval = setInterval(checkAuth, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [requiredRole]);

  if (isAuthorized === null) {
    // Still checking
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    // Redirect to login with return path
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

