import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Plus, Edit, Trash2, UserCheck, Building2, Users, Calendar } from "lucide-react";
import { User, District } from "@/lib/data-models";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { toast } from "sonner";

type UserWithDistrict = User & {
  district?: District;
  fullName?: string;
  serviceCenter?: string;
};

const ViewTechnicians = () => {
  const [users, setUsers] = useState<UserWithDistrict[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<UserWithDistrict | null>(null);
  const [deleteTechnicianId, setDeleteTechnicianId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    serviceCenter: "",
  });

  useEffect(() => {
    loadUsers();
  }, []);

  // Debug: Log when users change
  useEffect(() => {
    console.log("=== USERS STATE CHANGED ===");
    console.log("Users state updated:", users.length, "users");
    if (users.length > 0) {
      console.log("Sample user:", {
        id: users[0].id,
        username: users[0].username,
        fullName: (users[0] as any).fullName,
        serviceCenter: (users[0] as any).serviceCenter,
        permission: users[0].permission
      });
    }
    const techs = users.filter((u) => {
      if (u.permission === "admin") return false;
      const hasFullName = !!(u as any).fullName;
      const hasServiceCenter = !!(u as any).serviceCenter;
      const isTech = hasFullName && hasServiceCenter;
      if (isTech) {
        console.log("Found technician:", (u as any).fullName || u.username);
      }
      return isTech;
    });
    console.log("Technicians filtered:", techs.length, "technicians");
    if (techs.length > 0) {
      console.log("Technicians list:", techs.map(t => ({ 
        id: t.id,
        name: (t as any).fullName || t.username, 
        serviceCenter: (t as any).serviceCenter 
      })));
    }
    console.log("=== END USERS STATE CHANGE ===");
  }, [users]);

  const loadUsers = async () => {
    try {
      // Read directly from localStorage to bypass any cache issues
      const localData = localStorage.getItem(STORAGE_KEYS.USERS);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          if (Array.isArray(parsed)) {
            setUsers(parsed);
            console.log("Loaded users from localStorage:", parsed.length);
            return; // Use localStorage data if available
          }
        } catch (parseError) {
          console.error("Error parsing localStorage data:", parseError);
        }
      }
      // Fallback to storage utility
      const usersData = (await getStorageItem<UserWithDistrict[]>(STORAGE_KEYS.USERS)) || [];
      if (Array.isArray(usersData)) {
        setUsers(usersData);
        console.log("Loaded users from storage utility:", usersData.length);
      } else {
        console.log("No users found, setting empty array");
        setUsers([]);
      }
    } catch (error) {
      console.error("Error loading users:", error);
      setUsers([]);
    }
  };

  const saveUsers = async (updatedUsers: UserWithDistrict[]) => {
    try {
      console.log("=== SAVE USERS START ===");
      console.log("Saving users:", updatedUsers.length, "total users");
      
      // Save to localStorage directly first for immediate persistence
      const jsonString = JSON.stringify(updatedUsers);
      localStorage.setItem(STORAGE_KEYS.USERS, jsonString);
      console.log("✓ Saved to localStorage, key:", STORAGE_KEYS.USERS);
      
      // Verify it was saved before proceeding
      const verify = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!verify) {
        throw new Error("Failed to save to localStorage!");
      }
      const parsed = JSON.parse(verify);
      console.log("✓ Verified saved users count:", parsed.length);
      
      // Update state immediately - this triggers re-render
      // Create new array reference to force React to detect the change
      setUsers([...updatedUsers]);
      console.log("✓ State updated with", updatedUsers.length, "users");
      
      // Verify technicians in the array we just set
      const techsInState = updatedUsers.filter((u) => {
        if (u.permission === "admin") return false;
        const userAny = u as any;
        const hasFullName = userAny.fullName && typeof userAny.fullName === 'string' && userAny.fullName.trim().length > 0;
        const hasServiceCenter = userAny.serviceCenter && typeof userAny.serviceCenter === 'string' && userAny.serviceCenter.trim().length > 0;
        return hasFullName && hasServiceCenter;
      });
      console.log("✓ Technicians in state array:", techsInState.length);
      
      // Log technicians in the updated array for debugging
      console.log("=== CHECKING FOR TECHNICIANS IN SAVED ARRAY ===");
      updatedUsers.forEach((u, index) => {
        const hasFullName = !!(u as any).fullName;
        const hasServiceCenter = !!(u as any).serviceCenter;
        const isAdmin = u.permission === "admin";
        console.log(`User ${index}:`, {
          id: u.id,
          username: u.username,
          permission: u.permission,
          hasFullName,
          hasServiceCenter,
          fullName: (u as any).fullName,
          serviceCenter: (u as any).serviceCenter,
          isAdmin,
          isTechnician: !isAdmin && hasFullName && hasServiceCenter
        });
      });
      
      const techsInUpdated = updatedUsers.filter((u) => {
        if (u.permission === "admin") return false;
        const hasFullName = !!(u as any).fullName;
        const hasServiceCenter = !!(u as any).serviceCenter;
        return hasFullName && hasServiceCenter;
      });
      console.log("✓ Technicians in saved array:", techsInUpdated.length);
      if (techsInUpdated.length > 0) {
        console.log("Technicians found:", techsInUpdated.map(t => ({
          id: t.id,
          name: (t as any).fullName,
          serviceCenter: (t as any).serviceCenter
        })));
      }
      
      // Then use the storage utility for proper sync (Supabase if configured) - non-blocking
      // Note: setStorageItem also saves to localStorage, but we already did that above
      // This is just for Supabase sync, so we pass the same data
      setStorageItem(STORAGE_KEYS.USERS, updatedUsers).catch(err => {
        console.error("Background sync error (non-critical):", err);
      });
      
      // Final verification - check what's actually in localStorage after all operations
      setTimeout(() => {
        const finalCheck = localStorage.getItem(STORAGE_KEYS.USERS);
        if (finalCheck) {
          const finalParsed = JSON.parse(finalCheck);
          const finalTechs = finalParsed.filter((u: any) => {
            if (u.permission === "admin") return false;
            return !!(u.fullName) && !!(u.serviceCenter);
          });
          console.log("=== FINAL VERIFICATION ===");
          console.log("Total users in localStorage:", finalParsed.length);
          console.log("Technicians found:", finalTechs.length);
          if (finalTechs.length > 0) {
            console.log("Technicians:", finalTechs.map((t: any) => ({ id: t.id, name: t.fullName, serviceCenter: t.serviceCenter })));
          }
        }
      }, 500);
      
      console.log("=== SAVE USERS END ===");
    } catch (error) {
      console.error("Error in saveUsers:", error);
      throw error; // Re-throw to be caught by handleSubmit
    }
  };

  const handleOpenDialog = (technician?: UserWithDistrict) => {
    if (technician) {
      setEditingTechnician(technician);
      setFormData({
        fullName: technician.fullName || technician.username || "",
        serviceCenter: technician.serviceCenter || "",
      });
    } else {
      setEditingTechnician(null);
      setFormData({
        fullName: "",
        serviceCenter: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTechnician(null);
    setFormData({
      fullName: "",
      serviceCenter: "",
    });
  };

  const handleDeleteClick = (technicianId: string) => {
    setDeleteTechnicianId(technicianId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTechnicianId) {
      const updatedUsers = users.filter((u) => u.id !== deleteTechnicianId);
      await saveUsers(updatedUsers);
      toast.success("Technician deleted successfully");
      setIsDeleteDialogOpen(false);
      setDeleteTechnicianId(null);
      loadUsers(); // Reload to refresh the list
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName || !formData.serviceCenter) {
      toast.error("Please fill in all required fields (Full Name and Service Center)");
      return;
    }

    try {
      // Check if we're editing or creating - explicitly check for null/undefined
      const isEditing = editingTechnician !== null && editingTechnician !== undefined;
      
      if (isEditing) {
        // Update existing technician
        const updatedUsers = users.map((u) =>
          u.id === editingTechnician.id
            ? {
                ...u,
                username: formData.fullName.toLowerCase().replace(/\s+/g, "."),
                fullName: formData.fullName,
                serviceCenter: formData.serviceCenter,
              }
            : u
        );
        await saveUsers(updatedUsers);
        await loadUsers(); // Reload to refresh the list
        toast.success("Technician updated successfully");
        handleCloseDialog();
      } else {
        // Create new technician
        // Generate unique username
        let baseUsername = formData.fullName.toLowerCase().replace(/\s+/g, ".");
        let username = baseUsername;
        let counter = 1;
        
        // Check if username already exists
        while (users.some((u) => u.username === username)) {
          username = `${baseUsername}.${counter}`;
          counter++;
        }

        // Create new technician with all required fields
        const newUser: any = {
          id: Date.now().toString(),
          username: username,
          password: "changeme", // Default password - should be changed on first login
          permission: "view", // Default permission
          fullName: formData.fullName.trim(),
          serviceCenter: formData.serviceCenter.trim(),
          createdAt: new Date().toISOString(),
        };
        
        // Ensure fields are not empty strings
        if (!newUser.fullName || !newUser.serviceCenter) {
          toast.error("Full Name and Service Center are required");
          return;
        }
        
        console.log("=== CREATING NEW TECHNICIAN ===");
        console.log("Form data:", formData);
        console.log("New user object:", JSON.stringify(newUser, null, 2));
        console.log("New user fullName:", newUser.fullName, "type:", typeof newUser.fullName, "length:", newUser.fullName?.length);
        console.log("New user serviceCenter:", newUser.serviceCenter, "type:", typeof newUser.serviceCenter, "length:", newUser.serviceCenter?.length);
        console.log("Current users count:", users.length);
        
        // Create updated array with new technician
        const updatedUsers = [...users, newUser];
        console.log("Updated users count:", updatedUsers.length);
        console.log("Last user in array:", JSON.stringify(updatedUsers[updatedUsers.length - 1], null, 2));
        
        // Verify the new user has the required fields before saving
        const lastUser = updatedUsers[updatedUsers.length - 1] as any;
        if (!lastUser.fullName || !lastUser.serviceCenter) {
          console.error("ERROR: New user missing required fields!");
          console.error("fullName:", lastUser.fullName);
          console.error("serviceCenter:", lastUser.serviceCenter);
          toast.error("Failed to create technician: Missing required fields");
          return;
        }
        
        // Save the users - this will update state internally and save to localStorage
        await saveUsers(updatedUsers);
        
        // Verify the technician was saved correctly
        const savedData = localStorage.getItem(STORAGE_KEYS.USERS);
        if (savedData) {
          const parsed = JSON.parse(savedData);
          console.log("=== VERIFYING SAVED DATA ===");
          console.log("Total users in localStorage:", parsed.length);
          const savedTech = parsed.find((u: any) => u.id === newUser.id);
          if (savedTech) {
            console.log("Found saved technician:", JSON.stringify(savedTech, null, 2));
            console.log("Has fullName:", !!savedTech.fullName, "value:", savedTech.fullName);
            console.log("Has serviceCenter:", !!savedTech.serviceCenter, "value:", savedTech.serviceCenter);
            if (savedTech.fullName && savedTech.serviceCenter) {
              console.log("✓ Technician verified in localStorage:", savedTech.fullName);
            } else {
              console.error("✗ Technician missing required fields!");
              console.error("fullName:", savedTech.fullName);
              console.error("serviceCenter:", savedTech.serviceCenter);
            }
          } else {
            console.error("✗ Technician not found in localStorage by ID:", newUser.id);
            console.log("All saved users:", parsed.map((u: any) => ({ id: u.id, username: u.username, hasFullName: !!u.fullName, hasServiceCenter: !!u.serviceCenter })));
          }
        } else {
          console.error("✗ No data found in localStorage!");
        }
        
        // Show success message
        toast.success("Technician saved successfully");
        
        // Close dialog first
        handleCloseDialog();
        
        // Force a state update by reloading users
        // Use a small delay to ensure localStorage write is complete
        setTimeout(async () => {
          console.log("=== RELOADING USERS AFTER SAVE ===");
          await loadUsers();
          
          // Double-check after reload
          const checkData = localStorage.getItem(STORAGE_KEYS.USERS);
          if (checkData) {
            const checkParsed = JSON.parse(checkData);
            const checkTechs = checkParsed.filter((u: any) => {
              const hasFullName = u.fullName && typeof u.fullName === 'string' && u.fullName.trim().length > 0;
              const hasServiceCenter = u.serviceCenter && typeof u.serviceCenter === 'string' && u.serviceCenter.trim().length > 0;
              return u.permission !== "admin" && hasFullName && hasServiceCenter;
            });
            console.log("After reload - Technicians found:", checkTechs.length);
            if (checkTechs.length > 0) {
              console.log("Technicians:", checkTechs.map((t: any) => ({ id: t.id, name: t.fullName, serviceCenter: t.serviceCenter })));
            }
          }
        }, 300);
      }
    } catch (error) {
      console.error("Error saving technician:", error);
      toast.error("Failed to save technician. Please try again.");
    }
  };

  // Filter technicians - ONLY show technicians created in this page
  // Technicians are identified by having both fullName AND serviceCenter
  // Regular users (created in User Management) should NOT appear here
  const technicians = users.filter((u) => {
    // Exclude admins
    if (u.permission === "admin") return false;
    
    // ONLY include if it has BOTH fullName AND serviceCenter (technicians created here)
    // Regular users created in User Management don't have these fields
    const userAny = u as any;
    const hasFullName = userAny.fullName && typeof userAny.fullName === 'string' && userAny.fullName.trim().length > 0;
    const hasServiceCenter = userAny.serviceCenter && typeof userAny.serviceCenter === 'string' && userAny.serviceCenter.trim().length > 0;
    
    const isTechnician = hasFullName && hasServiceCenter;
    
    // Debug log for troubleshooting
    if (!isTechnician && userAny.fullName) {
      console.log("User has fullName but not recognized as technician:", {
        id: u.id,
        username: u.username,
        fullName: userAny.fullName,
        serviceCenter: userAny.serviceCenter,
        hasFullName,
        hasServiceCenter
      });
    }
    
    return isTechnician;
  });

  const filteredTechnicians = technicians.filter((tech) => {
    const fullName = tech.fullName || tech.username || "";
    const serviceCenter = tech.serviceCenter || "";
    const search = searchTerm.toLowerCase();
    return (
      fullName.toLowerCase().includes(search) ||
      serviceCenter.toLowerCase().includes(search)
    );
  });

  // Calculate statistics
  const totalTechnicians = technicians.length;
  const uniqueServiceCenters = Array.from(new Set(technicians.map(t => t.serviceCenter).filter(Boolean))).length;
  const techniciansCreatedThisMonth = technicians.filter(t => {
    const created = new Date(t.createdAt);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-gradient-to-r from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-800/40 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Technicians
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1 text-lg">
              Manage technicians and their service centers 👥
            </p>
          </div>
          <Button 
            onClick={handleOpenDialog}
            className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Technician
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-blue-500 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Total Technicians
              </CardTitle>
              <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-indigo-500 to-blue-500 bg-clip-text text-transparent">
                {totalTechnicians}
              </div>
            </CardContent>
          </Card>
          
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Service Centers
              </CardTitle>
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
                {uniqueServiceCenters}
              </div>
            </CardContent>
          </Card>
          
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-teal-500 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Added This Month
              </CardTitle>
              <div className="bg-cyan-100 dark:bg-cyan-900/30 p-2 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Calendar className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-cyan-500 to-teal-500 bg-clip-text text-transparent">
                {techniciansCreatedThisMonth}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-blue-500/5 to-cyan-500/5" />
          <CardHeader className="relative z-10 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                  Technicians Directory
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300 mt-1">
                  Browse all technicians in the system and their locations
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name or service center..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-700/50 focus:border-indigo-500 dark:focus:border-indigo-500"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 pt-6">
            {technicians.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 mb-4">
                  <UserCheck className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-lg font-medium mb-2">
                  No technicians found
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Click "Add Technician" above to create your first technician.
                </p>
              </div>
            ) : filteredTechnicians.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 mb-4">
                  <Search className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-lg font-medium mb-2">
                  No technicians match your search
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Try a different search term.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" key={`tech-grid-${technicians.length}-${users.length}`}>
                {filteredTechnicians.map((user, index) => (
                  <div
                    key={user.id}
                    className="group relative p-5 border border-gray-200/50 dark:border-gray-700/50 rounded-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm hover:bg-gradient-to-br hover:from-indigo-50/50 hover:to-blue-50/50 dark:hover:from-indigo-900/10 dark:hover:to-blue-900/10 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-blue-500/0 group-hover:from-indigo-500/5 group-hover:to-blue-500/5 transition-opacity duration-300" />
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 p-2.5 rounded-lg group-hover:scale-110 transition-transform duration-300">
                              <UserCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="font-bold text-lg bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                              {user.fullName || user.username}
                            </div>
                          </div>
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2 p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
                              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block">Service Center</span>
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                                  {user.serviceCenter || "Not assigned"}
                                </span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                              Created: {new Date(user.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(user)}
                          className="flex-1 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-500 hover:to-cyan-500 hover:text-white border-blue-200 dark:border-blue-800 transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClick(user.id)}
                          className="flex-1 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Technician Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            handleCloseDialog();
          }
        }}>
          <DialogContent className="border-0 shadow-2xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-blue-500/5 to-cyan-500/5" />
            <DialogHeader className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 p-2 rounded-lg">
                  <UserCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <DialogTitle className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                  {editingTechnician ? "Edit Technician" : "Create New Technician"}
                </DialogTitle>
              </div>
              <DialogDescription className="text-gray-600 dark:text-gray-300">
                {editingTechnician
                  ? "Update technician information."
                  : "Add a new technician to the system with their full name and service center."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="relative z-10">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-gray-700 dark:text-gray-200 font-medium">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    placeholder="Enter technician's full name"
                    required
                    className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-700/50 focus:border-indigo-500 dark:focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceCenter" className="text-gray-700 dark:text-gray-200 font-medium">Service Center *</Label>
                  <Input
                    id="serviceCenter"
                    value={formData.serviceCenter}
                    onChange={(e) =>
                      setFormData({ ...formData, serviceCenter: e.target.value })
                    }
                    placeholder="Enter service center name"
                    required
                    className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-700/50 focus:border-indigo-500 dark:focus:border-indigo-500"
                  />
                </div>
              </div>
              <DialogFooter className="relative z-10">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleCloseDialog}
                  className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the technician from the system.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default ViewTechnicians;

