import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Cases from "./pages/Cases";
import SpareParts from "./pages/SpareParts";
import Pending from "./pages/Pending";
import Technicians from "./pages/Technicians";
import ManageTechnicians from "./pages/ManageTechnicians";
import Import from "./pages/Import";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/cases" 
              element={
                <ProtectedRoute>
                  <Cases />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/spare-parts" 
              element={
                <ProtectedRoute>
                  <SpareParts />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/pending" 
              element={
                <ProtectedRoute>
                  <Pending />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/technicians" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Technicians />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/manage-technicians" 
              element={
                <ProtectedRoute>
                  <ManageTechnicians />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/import" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Import />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Reports />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
