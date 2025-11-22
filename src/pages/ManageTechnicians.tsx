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
import { Search, Plus, Edit, Trash2 } from "lucide-react";
import { User, District } from "@/lib/data-models";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { toast } from "sonner";

type Technician = User & {
  fullName: string;
  serviceCenter: string;
};

const ManageTechnicians = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);
  const [deleteTechnicianId, setDeleteTechnicianId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    serviceCenter: "",
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersData = (await getStorageItem<User[]>(STORAGE_KEYS.USERS)) || [];
      setUsers(usersData);
    } catch (error) {
      console.error("Error loading users:", error);
      setUsers([]);
    }
  };

  const saveUsers = async (updatedUsers: User[]) => {
    try {
      // Save to localStorage
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
      // Update state
      setUsers(updatedUsers);
      // Sync with storage utility
      await setStorageItem(STORAGE_KEYS.USERS, updatedUsers);
    } catch (error) {
      console.error("Error saving users:", error);
      toast.error("Failed to save technicians");
      throw error;
    }
  };

  const handleOpenDialog = (technician?: Technician) => {
    if (technician) {
      setEditingTechnician(technician);
      setFormData({
        fullName: technician.fullName || "",
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
      await loadUsers();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName.trim() || !formData.serviceCenter.trim()) {
      toast.error("Please fill in all required fields (Full Name and Service Center)");
      return;
    }

    try {
      if (editingTechnician) {
        // Update existing technician
        const updatedUsers = users.map((u) =>
          u.id === editingTechnician.id
            ? {
                ...u,
                username: formData.fullName.toLowerCase().replace(/\s+/g, "."),
                fullName: formData.fullName.trim(),
                serviceCenter: formData.serviceCenter.trim(),
              }
            : u
        );
        await saveUsers(updatedUsers);
        await loadUsers();
        toast.success("Technician updated successfully");
        handleCloseDialog();
      } else {
        // Create new technician
        let baseUsername = formData.fullName.toLowerCase().replace(/\s+/g, ".");
        let username = baseUsername;
        let counter = 1;
        
        // Check if username already exists
        while (users.some((u) => u.username === username)) {
          username = `${baseUsername}.${counter}`;
          counter++;
        }

        const newTechnician: any = {
          id: Date.now().toString(),
          username: username,
          password: "changeme",
          permission: "view",
          fullName: formData.fullName.trim(),
          serviceCenter: formData.serviceCenter.trim(),
          createdAt: new Date().toISOString(),
        };

        const updatedUsers = [...users, newTechnician];
        await saveUsers(updatedUsers);
        
        toast.success("Technician saved successfully");
        handleCloseDialog();
        
        // Reload after a brief delay
        setTimeout(async () => {
          await loadUsers();
        }, 200);
      }
    } catch (error) {
      console.error("Error saving technician:", error);
      toast.error("Failed to save technician. Please try again.");
    }
  };

  // Filter technicians - users with both fullName and serviceCenter
  const technicians = users.filter((u) => {
    if (u.permission === "admin") return false;
    const userAny = u as any;
    const hasFullName = userAny.fullName && typeof userAny.fullName === 'string' && userAny.fullName.trim().length > 0;
    const hasServiceCenter = userAny.serviceCenter && typeof userAny.serviceCenter === 'string' && userAny.serviceCenter.trim().length > 0;
    return hasFullName && hasServiceCenter;
  }) as Technician[];

  const filteredTechnicians = technicians.filter((tech) => {
    const fullName = tech.fullName || tech.username || "";
    const serviceCenter = tech.serviceCenter || "";
    const search = searchTerm.toLowerCase();
    return (
      fullName.toLowerCase().includes(search) ||
      serviceCenter.toLowerCase().includes(search)
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex justify-between items-center bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-pink-500/10 dark:from-violet-900/30 dark:via-purple-900/30 dark:to-pink-900/30 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-violet-200/60 dark:border-violet-800/60">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Technicians
            </h1>
            <p className="text-gray-700 dark:text-gray-300 mt-1 text-lg">
              Manage technicians and their service centers 🔧
            </p>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Technician
          </Button>
        </div>

        {/* Directory card */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/80 dark:from-gray-900 dark:to-gray-800/80 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />
          <CardHeader className="relative z-10 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-b border-gray-200/60 dark:border-gray-700/60">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  Technicians Directory
                </CardTitle>
                <CardDescription className="text-gray-700 dark:text-gray-300 mt-1">
                  View and manage all technicians in the system
                </CardDescription>
              </div>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or service center..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-gray-200/60 dark:border-gray-700/60 focus-visible:ring-violet-500"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 pt-6">
            {technicians.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg mb-2">No technicians found</p>
                <p className="text-sm">Click &quot;Add Technician&quot; above to create your first technician.</p>
              </div>
            ) : filteredTechnicians.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg mb-2">No technicians match your search</p>
                <p className="text-sm">Try a different search term.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTechnicians.map((tech, index) => {
                  const initials = (tech.fullName || tech.username || "")
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((n) => n[0]?.toUpperCase())
                    .join("");

                  return (
                    <div
                      key={tech.id}
                      className="group relative p-4 rounded-2xl border border-violet-100/80 dark:border-violet-900/60 bg-gradient-to-br from-white via-violet-50/60 to-purple-50/60 dark:from-gray-900 dark:via-violet-950/40 dark:to-purple-950/40 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      <div className="relative z-10 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-sm font-semibold shadow-md group-hover:scale-110 transition-transform duration-300">
                            {initials || "T"}
                          </div>
                          <div>
                            <div className="font-semibold text-base text-gray-900 dark:text-gray-50">
                              {tech.fullName || tech.username}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">Username:</span>
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                                {tech.username}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="relative z-10 mt-4 space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Service Center:</span>
                          <Badge className="text-xs py-1 px-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-sm">
                            {tech.serviceCenter || "Not assigned"}
                          </Badge>
                        </div>
                        {tech.district && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">District:</span>
                            <Badge
                              variant="outline"
                              className="text-xs py-1 px-2 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 bg-violet-50/70 dark:bg-violet-950/30"
                            >
                              {tech.district}
                            </Badge>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-3 pt-2 border-t border-violet-100/80 dark:border-violet-800/50">
                          Created: {new Date(tech.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="relative z-10 flex gap-2 mt-4 pt-3 border-t border-violet-100/80 dark:border-violet-800/50">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(tech)}
                          className="flex-1 h-8 text-xs bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 hover:from-blue-500 hover:to-cyan-500 hover:text-white border-blue-200 dark:border-blue-800 transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClick(tech.id)}
                          className="flex-1 h-8 text-xs bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Technician Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            handleCloseDialog();
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTechnician ? "Edit Technician" : "Add New Technician"}
              </DialogTitle>
              <DialogDescription>
                {editingTechnician
                  ? "Update technician information."
                  : "Add a new technician with their full name and service center."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    placeholder="Enter technician's full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceCenter">Service Center *</Label>
                  <Input
                    id="serviceCenter"
                    value={formData.serviceCenter}
                    onChange={(e) =>
                      setFormData({ ...formData, serviceCenter: e.target.value })
                    }
                    placeholder="Enter service center name"
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingTechnician ? "Update" : "Save"}
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

export default ManageTechnicians;

