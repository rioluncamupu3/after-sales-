import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Users, Shield, Key } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

import { User, District } from "@/lib/data-models";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { hashPassword, sanitizeInput } from "@/lib/security-utils";

type UserWithDistrict = User & {
  district?: District;
};

const Technicians = () => {
  const [allUsers, setAllUsers] = useState<UserWithDistrict[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithDistrict | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  
  // Filter out technicians for display (users with both fullName and serviceCenter)
  const users = allUsers.filter((u) => {
    // Keep admins
    if (u.permission === "admin") return true;
    // Exclude technicians (users with both fullName and serviceCenter)
    const hasFullName = !!(u as any).fullName;
    const hasServiceCenter = !!(u as any).serviceCenter;
    return !(hasFullName && hasServiceCenter);
  });
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    permission: "view" as "view" | "editor" | "admin",
    district: "" as District | "",
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersData = (await getStorageItem<UserWithDistrict[]>(STORAGE_KEYS.USERS)) || [];
      setAllUsers(usersData);
    } catch (error) {
      console.error("Error loading users:", error);
      // Fallback to localStorage
      const usersJson = localStorage.getItem(STORAGE_KEYS.USERS);
      if (usersJson) {
        try {
          const usersData = JSON.parse(usersJson);
          setAllUsers(usersData);
        } catch (e) {
          console.error("Error parsing users:", e);
          setAllUsers([]);
        }
      }
    }
  };

  const saveUsers = async (updatedUsers: UserWithDistrict[]) => {
    try {
      // Save to localStorage directly first
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
      // Update state immediately
      setAllUsers(updatedUsers);
      // Then sync with storage utility
      await setStorageItem(STORAGE_KEYS.USERS, updatedUsers);
    } catch (error) {
      console.error("Error saving users:", error);
      // Fallback to localStorage only
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
      setAllUsers(updatedUsers);
    }
  };

  const handleOpenDialog = (user?: UserWithDistrict) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        password: "",
        permission: user.permission,
        district: user.district || "",
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: "",
        password: "",
        permission: "view",
        district: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setFormData({
      username: "",
      password: "",
      permission: "view",
      district: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Sanitize username
    const sanitizedUsername = sanitizeInput(formData.username);
    
    if (!sanitizedUsername || (!formData.password && !editingUser)) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.password && formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    const existingUsers = allUsers;
    const usernameExists = existingUsers.some(
      (u) => u.username === sanitizedUsername && u.id !== editingUser?.id
    );

    if (usernameExists) {
      toast.error("Username already exists");
      return;
    }

    try {
      if (editingUser) {
        // Update existing user
        const updatedUsers = allUsers.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                username: sanitizedUsername,
                password: formData.password ? hashPassword(formData.password) : u.password,
                permission: formData.permission,
                district: formData.district || undefined,
              }
            : u
        );
        await saveUsers(updatedUsers);
        toast.success("User updated successfully");
      } else {
        // Create new user - hash password before storing
        const newUser: UserWithDistrict = {
          id: Date.now().toString(),
          username: sanitizedUsername,
          password: hashPassword(formData.password),
          permission: formData.permission,
          district: formData.district || undefined,
          createdAt: new Date().toISOString(),
          // Explicitly mark as NOT a technician (no fullName or serviceCenter)
        };
        await saveUsers([...allUsers, newUser]);
        toast.success("User created successfully");
      }
      handleCloseDialog();
      await loadUsers(); // Reload to refresh the list
    } catch (error) {
      console.error("Error saving user:", error);
      toast.error("Failed to save user. Please try again.");
    }
  };

  const handleDeleteClick = (userId: string) => {
    setDeleteUserId(userId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteUserId) {
      const updatedUsers = allUsers.filter((u) => u.id !== deleteUserId);
      await saveUsers(updatedUsers);
      toast.success("User deleted successfully");
      setIsDeleteDialogOpen(false);
      setDeleteUserId(null);
      await loadUsers(); // Reload to refresh the list
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-gradient-to-r from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-800/40 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
              User Management
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1 text-lg">
              Create and manage user accounts with permissions 🔐
            </p>
          </div>
          <Button 
            size="sm" 
            onClick={() => handleOpenDialog()}
            className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create User
          </Button>
        </div>

        <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-fuchsia-500/5" />
          <CardHeader className="relative z-10 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-b border-gray-200/50 dark:border-gray-700/50 pb-3">
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
              Users
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300 mt-1">
              Manage user accounts and their permissions (Admin, Editor, or View)
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 pt-6">
            {users.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 mb-4">
                  <Users className="h-8 w-8 text-violet-600 dark:text-violet-400" />
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-lg font-medium mb-2">
                  No users created yet
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Click "Create User" to add a new user.
                </p>
              </div>
            ) : (
              <div className="border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-hidden shadow-inner">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
                      <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Username</TableHead>
                      <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Permission</TableHead>
                      <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">District</TableHead>
                      <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Created At</TableHead>
                      <TableHead className="h-10 text-xs font-bold py-3 px-4 text-right text-gray-700 dark:text-gray-200">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user, index) => (
                      <TableRow 
                        key={user.id} 
                        className="hover:bg-gradient-to-r hover:from-violet-50/50 hover:to-purple-50/50 dark:hover:from-violet-900/10 dark:hover:to-purple-900/10 transition-all duration-200 border-b border-gray-100 dark:border-gray-800"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <TableCell className="py-3 px-4 text-xs font-semibold text-gray-800 dark:text-gray-200">{user.username}</TableCell>
                      <TableCell className="py-3 px-4">
                        <Badge
                          className={`text-xs py-1 px-3 shadow-sm ${
                            user.permission === "admin" 
                              ? "bg-gradient-to-r from-red-500 to-rose-500 text-white" 
                              : user.permission === "editor" 
                              ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white" 
                              : "bg-gradient-to-r from-gray-500 to-slate-500 text-white"
                          }`}
                        >
                          {user.permission === "admin" 
                            ? "Admin" 
                            : user.permission === "editor" 
                            ? "Editor" 
                            : "View"}
                        </Badge>
                      </TableCell>
                        <TableCell className="py-3 px-4">
                          {user.district ? (
                            <Badge variant="outline" className="text-xs py-1 px-3 shadow-sm border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 bg-violet-50/50 dark:bg-violet-950/20">{user.district}</Badge>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-xs text-gray-600 dark:text-gray-400">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDialog(user)}
                              className="h-8 w-8 p-0 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-500 hover:to-cyan-500 hover:text-white border-blue-200 dark:border-blue-800 transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteClick(user.id)}
                              className="h-8 w-8 p-0 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit User Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Edit User" : "Create New User"}
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? "Update user information and permissions."
                  : "Create a new user account with username, password, and permission level. Admin users have full access to all features."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: sanitizeInput(e.target.value) })
                    }
                    placeholder="Enter username"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password {editingUser && "(leave blank to keep current)"}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="Enter password"
                    required={!editingUser}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="permission">Permission</Label>
                  <Select
                    value={formData.permission}
                    onValueChange={(value: "view" | "editor" | "admin") =>
                      setFormData({ ...formData, permission: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select permission" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin - Full access to all features</SelectItem>
                      <SelectItem value="editor">Editor - Can view and edit data</SelectItem>
                      <SelectItem value="view">View - Can only view data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="district">District (Optional)</Label>
                  <Input
                    id="district"
                    value={formData.district || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, district: e.target.value })
                    }
                    placeholder="Enter district or location"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingUser ? "Update User" : "Create User"}
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
                This action cannot be undone. This will permanently delete the user account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Technicians;
