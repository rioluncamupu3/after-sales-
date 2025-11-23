import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Moon, Sun, User, Lock, Trash2, LogOut, Image, X, Plus, Edit, Settings as SettingsIcon, Database, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getStorageItem, setStorageItem, STORAGE_KEYS, clearOldStorageData, getStorageInfo } from "@/lib/storage-utils";
import { hashPassword, verifyPassword, clearSession } from "@/lib/security-utils";

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [appLogo, setAppLogo] = useState<string | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [standardizedIssueDetails, setStandardizedIssueDetails] = useState<string[]>([]);
  const [isIssueDetailsDialogOpen, setIsIssueDetailsDialogOpen] = useState(false);
  const [editingIssueDetail, setEditingIssueDetail] = useState<string | null>(null);
  const [newIssueDetail, setNewIssueDetail] = useState("");
  const [storageInfo, setStorageInfo] = useState({ used: 0, available: 0, percentage: 0 });
  const [isClearStorageDialogOpen, setIsClearStorageDialogOpen] = useState(false);

  const userRole = localStorage.getItem("userRole");
  const userEmail = localStorage.getItem("userEmail");
  const userId = localStorage.getItem("userId");
  const isAdmin = userRole === "admin";

  useEffect(() => {
    // Sync with theme on mount and when theme changes
    const currentTheme = theme || localStorage.getItem("theme") || "light";
    setIsDarkMode(currentTheme === "dark");
    
    // Load app logo
    const logo = localStorage.getItem("appLogo");
    setAppLogo(logo);

    // Load standardized issue details
    loadStandardizedIssueDetails();
    
    // Load storage info
    updateStorageInfo();
  }, [theme]);

  const updateStorageInfo = () => {
    const info = getStorageInfo();
    setStorageInfo(info);
  };

  const handleClearOldStorage = () => {
    const cleared = clearOldStorageData();
    updateStorageInfo();
    toast.success(`Cleared ${cleared} old storage items. Storage freed up.`);
    setIsClearStorageDialogOpen(false);
  };

  const loadStandardizedIssueDetails = async () => {
    const details = (await getStorageItem<string[]>(STORAGE_KEYS.STANDARDIZED_ISSUE_DETAILS)) || [];
    if (details.length === 0) {
      // Initialize with default list
      const defaultDetails = [
        "Battery Cannot Charge",
        "Broken TV screen",
        "Cannot Display",
        "Charging Base Faulty",
        "Faulty 2000",
        "Fault 1000",
        "Overload errors",
        "USB port overload",
        "Battery too hot",
        "Battery too cold",
        "Communication error",
        "Battery locked",
        "Faulty Keypad",
        "Faulty panel",
        "Faulty phone",
        "Faulty Remote",
        "Faulty TV Cable",
        "Lines on TV screen",
        "PCB burned",
        "Sensor Issue",
        "Showing Disable",
        "totally off",
        "TV sound issue",
        "USB slot faulty",
        "Visible damaged",
      ];
      await setStorageItem(STORAGE_KEYS.STANDARDIZED_ISSUE_DETAILS, defaultDetails);
      setStandardizedIssueDetails(defaultDetails);
    } else {
      setStandardizedIssueDetails(details);
    }
  };

  const handleAddIssueDetail = async () => {
    if (!newIssueDetail.trim()) {
      toast.error("Please enter an issue detail");
      return;
    }

    if (standardizedIssueDetails.includes(newIssueDetail.trim())) {
      toast.error("This issue detail already exists");
      return;
    }

    const updated = [...standardizedIssueDetails, newIssueDetail.trim()].sort();
    await setStorageItem(STORAGE_KEYS.STANDARDIZED_ISSUE_DETAILS, updated);
    setStandardizedIssueDetails(updated);
    setNewIssueDetail("");
    setIsIssueDetailsDialogOpen(false);
    toast.success("Issue detail added successfully");
  };

  const handleEditIssueDetail = async (oldValue: string, newValue: string) => {
    if (!newValue.trim()) {
      toast.error("Issue detail cannot be empty");
      return;
    }

    if (oldValue === newValue.trim()) {
      setEditingIssueDetail(null);
      return;
    }

    if (standardizedIssueDetails.includes(newValue.trim()) && oldValue !== newValue.trim()) {
      toast.error("This issue detail already exists");
      return;
    }

    const updated = standardizedIssueDetails.map(item => 
      item === oldValue ? newValue.trim() : item
    ).sort();
    await setStorageItem(STORAGE_KEYS.STANDARDIZED_ISSUE_DETAILS, updated);
    setStandardizedIssueDetails(updated);
    setEditingIssueDetail(null);
    toast.success("Issue detail updated successfully");
  };

  const handleDeleteIssueDetail = async (value: string) => {
    const updated = standardizedIssueDetails.filter(item => item !== value);
    await setStorageItem(STORAGE_KEYS.STANDARDIZED_ISSUE_DETAILS, updated);
    setStandardizedIssueDetails(updated);
    toast.success("Issue detail deleted successfully");
  };

  const handleThemeToggle = (checked: boolean) => {
    setIsDarkMode(checked);
    setTheme(checked ? "dark" : "light");
    toast.success(`Switched to ${checked ? "dark" : "light"} mode`);
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    // For admin
    if (isAdmin) {
      const adminPasswordHash = localStorage.getItem("adminPasswordHash");
      let currentPasswordValid = false;

      if (adminPasswordHash) {
        // Use hashed password verification
        currentPasswordValid = verifyPassword(passwordData.currentPassword, adminPasswordHash);
      } else {
        // First time - check plain text and migrate
        if (passwordData.currentPassword === "admin123") {
          currentPasswordValid = true;
        }
      }

      if (!currentPasswordValid) {
        toast.error("Current password is incorrect");
        return;
      }

      // Hash and store new password
      const newPasswordHash = hashPassword(passwordData.newPassword);
      localStorage.setItem("adminPasswordHash", newPasswordHash);
      toast.success("Admin password changed successfully");
      setIsChangePasswordOpen(false);
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
      return;
    }

    // For regular users
    const users = (await getStorageItem<any[]>(STORAGE_KEYS.USERS)) || [];
    const user = users.find((u) => u.id === userId);

    if (!user) {
      toast.error("User not found");
      return;
    }

    // Verify current password (handle both hashed and plain text)
    let currentPasswordValid = false;
    if (user.password.includes(':')) {
      // Hashed password
      currentPasswordValid = verifyPassword(passwordData.currentPassword, user.password);
    } else {
      // Plain text password (legacy)
      if (user.password === passwordData.currentPassword) {
        currentPasswordValid = true;
      }
    }

    if (!currentPasswordValid) {
      toast.error("Current password is incorrect");
      return;
    }

    // Hash and update password
    const newPasswordHash = hashPassword(passwordData.newPassword);
    const updatedUsers = users.map((u) =>
      u.id === userId ? { ...u, password: newPasswordHash } : u
    );
    await setStorageItem(STORAGE_KEYS.USERS, updatedUsers);

    toast.success("Password changed successfully");
    setIsChangePasswordOpen(false);
    setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
  };

  const handleMasterDelete = () => {
    if (deletePassword !== "Masterpassword") {
      toast.error("Incorrect master password");
      setDeletePassword("");
      return;
    }

    // Delete all data
    localStorage.removeItem(STORAGE_KEYS.CASES);
    localStorage.removeItem(STORAGE_KEYS.RAW_DATA);
    localStorage.removeItem(STORAGE_KEYS.SPARE_PARTS);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    
    // Clear user session
    clearSession();

    toast.success("All data has been deleted. Redirecting to login...");
    setIsDeleteDialogOpen(false);
    setDeletePassword("");
    
    setTimeout(() => {
      navigate("/login");
    }, 2000);
  };

  const handleLogout = () => {
    clearSession();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      localStorage.setItem("appLogo", base64);
      setAppLogo(base64);
      toast.success("Logo uploaded successfully");
      // Trigger a custom event to notify other components
      window.dispatchEvent(new Event("logoUpdated"));
    };
    reader.onerror = () => {
      toast.error("Error reading file");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    localStorage.removeItem("appLogo");
    setAppLogo(null);
    toast.success("Logo removed successfully");
    window.dispatchEvent(new Event("logoUpdated"));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex justify-between items-center bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 dark:from-emerald-900/30 dark:via-teal-900/30 dark:to-cyan-900/30 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-emerald-200/60 dark:border-emerald-800/60">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
              Settings
            </h1>
            <p className="text-gray-700 dark:text-gray-300 mt-1 text-lg">
              Manage your account settings and preferences ⚙️
            </p>
          </div>
        </div>

        {/* User Profile Section */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/80 dark:from-gray-900 dark:to-gray-800/80 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5 pointer-events-none" />
          <CardHeader className="relative z-10 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b border-gray-200/60 dark:border-gray-700/60">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-50">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md">
                <User className="h-4 w-4" />
              </span>
              User Profile
            </CardTitle>
            <CardDescription className="text-gray-700 dark:text-gray-300">
              Your account information
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={userEmail || "N/A"}
                  disabled
                  className="bg-muted/70 border-gray-200/70 dark:border-gray-700/70"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input
                  value={isAdmin ? "Admin" : "User"}
                  disabled
                  className="bg-muted/70 border-gray-200/70 dark:border-gray-700/70"
                />
              </div>
            </div>
            <Separator />
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full sm:w-auto bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 hover:from-red-500 hover:to-rose-500 hover:text-white border-red-200 dark:border-red-800 transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/80 dark:from-gray-900 dark:to-gray-800/80 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-sky-500/5 to-cyan-500/5 pointer-events-none" />
          <CardHeader className="relative z-10 bg-gradient-to-r from-indigo-500/10 to-sky-500/10 border-b border-gray-200/60 dark:border-gray-700/60">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-50">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-md">
                {isDarkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </span>
              Appearance
            </CardTitle>
            <CardDescription className="text-gray-700 dark:text-gray-300">
              Customize the appearance of the application
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="dark-mode">Dark Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Toggle between light and dark theme
                </p>
              </div>
              <Switch
                id="dark-mode"
                checked={isDarkMode}
                onCheckedChange={handleThemeToggle}
                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-indigo-500 data-[state=checked]:to-sky-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Change Password Section */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/80 dark:from-gray-900 dark:to-gray-800/80 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />
          <CardHeader className="relative z-10 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-b border-gray-200/60 dark:border-gray-700/60">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-50">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-md">
                <Lock className="h-4 w-4" />
              </span>
              Change Password
            </CardTitle>
            <CardDescription className="text-gray-700 dark:text-gray-300">
              Update your account password
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 py-4">
            <Button
              onClick={() => setIsChangePasswordOpen(true)}
              variant="outline"
              className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 hover:from-violet-500 hover:to-purple-500 hover:text-white border-violet-200 dark:border-violet-800 transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
            >
              Change Password
            </Button>
          </CardContent>
        </Card>

        {/* Logo Upload Section - Admin Only */}
        {isAdmin && (
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/80 dark:from-gray-900 dark:to-gray-800/80 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-sky-500/5 to-blue-500/5 pointer-events-none" />
            <CardHeader className="relative z-10 bg-gradient-to-r from-cyan-500/10 to-sky-500/10 border-b border-gray-200/60 dark:border-gray-700/60">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-50">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-sky-500 text-white shadow-md">
                  <Image className="h-4 w-4" />
                </span>
                App Logo
              </CardTitle>
              <CardDescription className="text-gray-700 dark:text-gray-300">
                Upload a logo to display in the application header and sidebar
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 space-y-4 pt-6">
              {appLogo && (
                <div className="space-y-4">
                  <div className="p-4 border border-cyan-100/80 dark:border-cyan-800/50 rounded-xl bg-cyan-50/40 dark:bg-cyan-950/30">
                    <Label className="text-sm font-medium mb-3 block">Current Logo Preview</Label>
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 p-3 bg-background rounded border border-gray-200/70 dark:border-gray-700/70 shadow-sm">
                        <img
                          src={appLogo}
                          alt="App Logo Preview"
                          className="h-12 w-auto max-w-[200px] object-contain"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-2">
                          Logo will appear in the header and sidebar
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveLogo}
                          className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30 hover:from-red-500 hover:to-rose-500 hover:text-white border-red-200 dark:border-red-800 transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Remove Logo
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="logo-upload">
                  {appLogo ? "Replace Logo" : "Upload Logo"}
                </Label>
                <Input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="cursor-pointer bg-white/80 dark:bg-gray-900/80 border-gray-200/70 dark:border-gray-700/70"
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: PNG or SVG format, max 2MB. Logo will appear in header and sidebar.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Standardized Issue Details Management - Admin Only */}
        {isAdmin && (
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/80 dark:from-gray-900 dark:to-gray-800/80 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-rose-500/5 pointer-events-none" />
            <CardHeader className="relative z-10 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-gray-200/60 dark:border-gray-700/60">
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-50">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md">
                  <SettingsIcon className="h-4 w-4" />
                </span>
                Standardized Issue Details
              </CardTitle>
              <CardDescription className="text-gray-700 dark:text-gray-300">
                Manage the list of standardized issue details used in case creation
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 space-y-4 pt-6">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {standardizedIssueDetails.length} issue detail{standardizedIssueDetails.length !== 1 ? "s" : ""} configured
                </p>
                <Button
                  onClick={() => setIsIssueDetailsDialogOpen(true)}
                  size="sm"
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add New
                </Button>
              </div>
              {standardizedIssueDetails.length > 0 ? (
                <div className="border border-amber-100/80 dark:border-amber-800/60 rounded-xl overflow-hidden shadow-inner">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border-b border-gray-200/60 dark:border-gray-700/60">
                        <TableHead className="h-10 text-xs font-bold py-2 px-3 text-gray-800 dark:text-gray-100">
                          Issue Detail
                        </TableHead>
                        <TableHead className="h-10 text-xs font-bold py-2 px-3 text-right text-gray-800 dark:text-gray-100">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {standardizedIssueDetails.map((detail, index) => (
                        <TableRow
                          key={index}
                          className="hover:bg-gradient-to-r hover:from-amber-50/60 hover:to-orange-50/60 dark:hover:from-amber-950/30 dark:hover:to-orange-950/30 transition-all duration-200 border-b border-gray-100 dark:border-gray-800"
                          style={{ animationDelay: `${index * 40}ms` }}
                        >
                          <TableCell className="py-2 px-3 text-xs">
                            {editingIssueDetail === detail ? (
                              <Input
                                defaultValue={detail}
                                onBlur={(e) => {
                                  handleEditIssueDetail(detail, e.target.value);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleEditIssueDetail(detail, e.currentTarget.value);
                                  } else if (e.key === "Escape") {
                                    setEditingIssueDetail(null);
                                  }
                                }}
                                autoFocus
                                className="h-7 text-xs"
                              />
                            ) : (
                              <span>{detail}</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingIssueDetail(detail)}
                                className="h-7 px-2 text-amber-700 dark:text-amber-300 hover:bg-amber-100/70 dark:hover:bg-amber-900/40"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteIssueDetail(detail)}
                                className="h-7 px-2 text-destructive hover:text-destructive hover:bg-red-100/70 dark:hover:bg-red-900/40"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No issue details configured. Click &quot;Add New&quot; to add one.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Storage Management Section */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/80 dark:from-gray-900 dark:to-gray-800/80 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 pointer-events-none" />
          <CardHeader className="relative z-10 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-b border-gray-200/60 dark:border-gray-700/60">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-50">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white shadow-md">
                <Database className="h-4 w-4" />
              </span>
              Storage Management
            </CardTitle>
            <CardDescription className="text-gray-700 dark:text-gray-300">
              Monitor and manage browser storage usage
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 space-y-4 pt-6">
            <div className="space-y-3">
              {storageInfo.usingSupabase && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Cloud Storage Active: Large files (100MB+) are saved directly to Supabase. No local storage limits!
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {storageInfo.usingSupabase ? "Cloud Storage (Network)" : "Local Storage Used"}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                  {storageInfo.usingSupabase 
                    ? "Unlimited (Cloud)" 
                    : `${(storageInfo.used / 1024 / 1024).toFixed(2)} MB / ~500 MB`}
                </span>
              </div>
              {!storageInfo.usingSupabase && (
                <>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        storageInfo.percentage > 80
                          ? "bg-gradient-to-r from-red-500 to-rose-500"
                          : storageInfo.percentage > 60
                          ? "bg-gradient-to-r from-orange-500 to-amber-500"
                          : "bg-gradient-to-r from-blue-500 to-indigo-500"
                      }`}
                      style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{storageInfo.percentage.toFixed(1)}% used</span>
                    <span>{(storageInfo.available / 1024 / 1024).toFixed(2)} MB available</span>
                  </div>
                </>
              )}
              {storageInfo.usingSupabase && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    <strong>✓ All data is stored in cloud storage (Supabase).</strong> No local storage limits. Your data is synced across all devices.
                  </p>
                </div>
              )}
              {!storageInfo.usingSupabase && (
                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                  <AlertTriangle className="inline h-3 w-3 mr-1" />
                  Large files may fail. Configure Supabase for unlimited cloud storage.
                </p>
              )}
            </div>
            
            {storageInfo.percentage > 70 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Storage is getting full
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Clear old data to free up space. Your data is safely stored in cloud storage.
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                onClick={() => setIsClearStorageDialogOpen(true)}
                variant="outline"
                className="flex-1 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 hover:from-blue-500 hover:to-indigo-500 hover:text-white border-blue-200 dark:border-blue-800 transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
              >
                <Database className="mr-2 h-4 w-4" />
                Clear Old Data
              </Button>
              <Button
                onClick={updateStorageInfo}
                variant="outline"
                size="sm"
                className="bg-white/80 dark:bg-gray-900/80 border-gray-200 dark:border-gray-700"
              >
                Refresh
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Clearing old data will remove non-essential cached items. Your app data (cases, users, etc.) will not be affected.
            </p>
          </CardContent>
        </Card>

        {/* Master Delete Section */}
        {isAdmin && (
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-rose-50/80 dark:from-gray-900 dark:to-gray-900/80 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-rose-500/10 to-amber-500/10 pointer-events-none" />
            <CardHeader className="relative z-10 bg-gradient-to-r from-red-500/15 to-rose-500/15 border-b border-red-200/60 dark:border-red-800/60">
              <CardTitle className="flex items-center gap-2 text-destructive text-lg font-bold">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-500 text-white shadow-md">
                  <Trash2 className="h-4 w-4" />
                </span>
                Master Delete
              </CardTitle>
              <CardDescription className="text-destructive/80">
                Warning: This will permanently delete all data including cases, users, and imported data
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 py-4">
              <Button
                onClick={() => setIsDeleteDialogOpen(true)}
                variant="destructive"
                className="bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete All Data
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Change Password Dialog */}
        <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
              <DialogDescription>
                Enter your current password and choose a new one
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, currentPassword: e.target.value })
                  }
                  placeholder="Enter current password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, newPassword: e.target.value })
                  }
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                  }
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsChangePasswordOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleChangePassword}>Change Password</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Issue Detail Dialog */}
        <Dialog open={isIssueDetailsDialogOpen} onOpenChange={setIsIssueDetailsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Standardized Issue Detail</DialogTitle>
              <DialogDescription>
                Add a new issue detail option that will be available in case creation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newIssueDetail">Issue Detail</Label>
                <Input
                  id="newIssueDetail"
                  value={newIssueDetail}
                  onChange={(e) => setNewIssueDetail(e.target.value)}
                  placeholder="e.g., Battery Cannot Charge"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddIssueDetail();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsIssueDetailsDialogOpen(false);
                setNewIssueDetail("");
              }}>
                Cancel
              </Button>
              <Button onClick={handleAddIssueDetail}>
                Add
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Clear Storage Dialog */}
        <AlertDialog open={isClearStorageDialogOpen} onOpenChange={setIsClearStorageDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Old Storage Data</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  This will remove old cached data and non-essential items from your browser storage to free up space.
                </p>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Your app data (cases, users, spare parts, etc.) will NOT be deleted. Only old cache and temporary files will be removed.
                </p>
                <p className="text-xs text-muted-foreground">
                  If you're using Supabase, your data is safely stored in the cloud and will sync back automatically.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearOldStorage}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
              >
                Clear Old Data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Master Delete Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">
                Delete All Data
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  This action cannot be undone. This will permanently delete:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>All maintenance cases</li>
                  <li>All imported customer data</li>
                  <li>All spare parts inventory</li>
                  <li>All user accounts (except admin)</li>
                </ul>
                <div className="pt-4">
                  <Label htmlFor="deletePassword" className="text-foreground">
                    Enter Master Password to confirm:
                  </Label>
                  <Input
                    id="deletePassword"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Masterpassword"
                    className="mt-2"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletePassword("")}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleMasterDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete All Data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Settings;

