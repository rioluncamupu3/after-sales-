import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Package, AlertTriangle, TrendingUp, Box } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { SparePart } from "@/lib/data-models";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

const SpareParts = () => {
  const [parts, setParts] = useState<SparePart[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddStockDialogOpen, setIsAddStockDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const [deletePartId, setDeletePartId] = useState<string | null>(null);
  const [addStockPartId, setAddStockPartId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    totalStock: 0,
    remainingStock: 0,
    unit: "pcs",
    lowStockThreshold: 10,
  });
  const [addStockQuantity, setAddStockQuantity] = useState(0);

  const userRole = localStorage.getItem("userRole");
  const isAdmin = userRole === "admin";

  useEffect(() => {
    loadParts();
  }, []);

  const loadParts = async () => {
    const partsData = (await getStorageItem<SparePart[]>(STORAGE_KEYS.SPARE_PARTS)) || [];
    setParts(partsData);
  };

  const saveParts = async (updatedParts: SparePart[]) => {
    await setStorageItem(STORAGE_KEYS.SPARE_PARTS, updatedParts);
    setParts(updatedParts);
  };

  const handleOpenDialog = (part?: SparePart) => {
    if (part) {
      setEditingPart(part);
      setFormData({
        name: part.name,
        description: part.description || "",
        totalStock: part.totalStock,
        remainingStock: part.remainingStock,
        unit: part.unit,
        lowStockThreshold: part.lowStockThreshold,
      });
    } else {
      setEditingPart(null);
      setFormData({
        name: "",
        description: "",
        totalStock: 0,
        remainingStock: 0,
        unit: "pcs",
        lowStockThreshold: 10,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPart(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error("Please enter part name");
      return;
    }

    if (editingPart) {
      // Update existing part
      const updatedParts = parts.map((p) =>
        p.id === editingPart.id
          ? {
              ...p,
              ...formData,
              updatedAt: new Date().toISOString(),
            }
          : p
      );
      await saveParts(updatedParts);
      toast.success("Spare part updated successfully");
    } else {
      // Create new part
      const newPart: SparePart = {
        id: Date.now().toString(),
        name: formData.name,
        description: formData.description || undefined,
        totalStock: formData.totalStock,
        remainingStock: formData.remainingStock || formData.totalStock,
        unit: formData.unit,
        lowStockThreshold: formData.lowStockThreshold,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveParts([...parts, newPart]);
      toast.success("Spare part created successfully");
    }

    handleCloseDialog();
  };

  const handleAddStock = async (partId: string) => {
    setAddStockPartId(partId);
    setAddStockQuantity(0);
    setIsAddStockDialogOpen(true);
  };

  const handleAddStockSubmit = async () => {
    if (!addStockPartId || addStockQuantity <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    const updatedParts = parts.map((p) => {
      if (p.id === addStockPartId) {
        const newTotal = p.totalStock + addStockQuantity;
        const newRemaining = p.remainingStock + addStockQuantity;
        return {
          ...p,
          totalStock: newTotal,
          remainingStock: newRemaining,
          updatedAt: new Date().toISOString(),
        };
      }
      return p;
    });

    await saveParts(updatedParts);
    toast.success(`Added ${addStockQuantity} ${parts.find(p => p.id === addStockPartId)?.unit} to stock`);
    setIsAddStockDialogOpen(false);
    setAddStockPartId(null);
  };

  const handleDeleteClick = (partId: string) => {
    setDeletePartId(partId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deletePartId) {
      const updatedParts = parts.filter((p) => p.id !== deletePartId);
      await saveParts(updatedParts);
      toast.success("Spare part deleted successfully");
      setIsDeleteDialogOpen(false);
      setDeletePartId(null);
    }
  };

  const lowStockParts = parts.filter((p) => p.remainingStock <= p.lowStockThreshold);
  const totalParts = parts.length;
  const totalStock = parts.reduce((sum, p) => sum + p.remainingStock, 0);

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-gradient-to-r from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-800/40 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50">
            <div>
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Spare Parts Inventory
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1 text-lg">
                View available spare parts 📦
              </p>
            </div>
          </div>
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-pink-500/5" />
            <CardHeader className="relative z-10 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                Available Parts
              </CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 pt-6">
              {parts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 mb-4">
                    <Package className="h-8 w-8 text-violet-600 dark:text-violet-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-lg font-medium">
                    No spare parts available
                  </p>
                </div>
              ) : (
                <div className="border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-hidden shadow-inner">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-pink-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
                        <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Part Name</TableHead>
                        <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Description</TableHead>
                        <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Remaining Stock</TableHead>
                        <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Unit</TableHead>
                        <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parts.map((part, index) => (
                        <TableRow 
                          key={part.id} 
                          className="hover:bg-gradient-to-r hover:from-violet-50/50 hover:to-purple-50/50 dark:hover:from-violet-900/10 dark:hover:to-purple-900/10 transition-all duration-200 border-b border-gray-100 dark:border-gray-800"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <TableCell className="py-3 px-4 text-xs font-semibold text-gray-800 dark:text-gray-200">{part.name}</TableCell>
                          <TableCell className="py-3 px-4 text-xs text-gray-600 dark:text-gray-400">{part.description || "-"}</TableCell>
                          <TableCell className="py-3 px-4 text-xs font-semibold text-violet-600 dark:text-violet-400">{part.remainingStock}</TableCell>
                          <TableCell className="py-3 px-4 text-xs text-gray-600 dark:text-gray-400">{part.unit}</TableCell>
                          <TableCell className="py-3 px-4 text-xs">
                            {part.remainingStock <= part.lowStockThreshold ? (
                              <Badge variant="destructive" className="text-xs py-1 px-3 shadow-md bg-gradient-to-r from-red-500 to-rose-500">
                                Low Stock
                              </Badge>
                            ) : (
                              <Badge variant="default" className="text-xs py-1 px-3 shadow-md bg-gradient-to-r from-green-500 to-emerald-500">
                                In Stock
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const partsUsed = parts.reduce((sum, p) => sum + (p.totalStock - p.remainingStock), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-gradient-to-r from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-800/40 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Spare Parts Inventory
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1 text-lg">
              Manage and track spare parts stock 📦
            </p>
          </div>
          <Button 
            onClick={() => handleOpenDialog()}
            className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Part
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Total Parts
              </CardTitle>
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
                {totalParts}
              </div>
            </CardContent>
          </Card>
          
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-500 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Total Stock
              </CardTitle>
              <div className="bg-violet-100 dark:bg-violet-900/30 p-2 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Box className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-violet-500 to-purple-500 bg-clip-text text-transparent">
                {totalStock}
              </div>
            </CardContent>
          </Card>
          
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-rose-500 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Low Stock Items
              </CardTitle>
              <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">
                {lowStockParts.length}
              </div>
            </CardContent>
          </Card>
          
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-rose-500 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Parts Used
              </CardTitle>
              <div className="bg-pink-100 dark:bg-pink-900/30 p-2 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">
                {partsUsed}
              </div>
            </CardContent>
          </Card>
        </div>

        {lowStockParts.length > 0 && (
          <Card className="border-0 shadow-xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 backdrop-blur-sm overflow-hidden border-l-4 border-red-500 animate-pulse">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-orange-500/10 to-amber-500/10" />
            <CardHeader className="relative z-10 bg-gradient-to-r from-red-500/20 to-orange-500/20 border-b border-red-200/50 dark:border-red-800/50">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                    Low Stock Alert
                  </CardTitle>
                  <CardDescription className="text-red-700 dark:text-red-300 mt-1">
                    {lowStockParts.length} part(s) are running low on stock
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pt-6">
              <div className="space-y-3">
                {lowStockParts.map((part) => (
                  <div 
                    key={part.id} 
                    className="flex justify-between items-center p-4 border border-red-200 dark:border-red-800 rounded-xl bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm hover:bg-white/80 dark:hover:bg-gray-900/80 transition-all duration-200 hover:shadow-md hover:scale-[1.02]"
                  >
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{part.name}</span>
                    <Badge variant="destructive" className="text-sm py-1.5 px-3 shadow-md">
                      {part.remainingStock} {part.unit} remaining
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-pink-500/5" />
          <CardHeader className="relative z-10 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
              Inventory
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300">
              Manage spare parts inventory
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 pt-6">
            {parts.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 mb-4">
                  <Package className="h-8 w-8 text-violet-600 dark:text-violet-400" />
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-lg font-medium">
                  No spare parts added yet
                </p>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Click "Add Part" to create one
                </p>
              </div>
            ) : (
              <div className="border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-hidden shadow-inner">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-pink-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
                      <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Part Name</TableHead>
                      <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Description</TableHead>
                      <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Total Stock</TableHead>
                      <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Remaining</TableHead>
                      <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Used</TableHead>
                      <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Unit</TableHead>
                      <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Status</TableHead>
                      <TableHead className="h-10 text-xs font-bold py-3 px-4 text-right text-gray-700 dark:text-gray-200">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parts.map((part, index) => (
                      <TableRow 
                        key={part.id} 
                        className="hover:bg-gradient-to-r hover:from-violet-50/50 hover:to-purple-50/50 dark:hover:from-violet-900/10 dark:hover:to-purple-900/10 transition-all duration-200 border-b border-gray-100 dark:border-gray-800"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <TableCell className="py-3 px-4 text-xs font-semibold text-gray-800 dark:text-gray-200">{part.name}</TableCell>
                        <TableCell className="py-3 px-4 text-xs text-gray-600 dark:text-gray-400">{part.description || "-"}</TableCell>
                        <TableCell className="py-3 px-4 text-xs font-medium text-gray-700 dark:text-gray-300">{part.totalStock}</TableCell>
                        <TableCell className="py-3 px-4 text-xs font-semibold text-violet-600 dark:text-violet-400">{part.remainingStock}</TableCell>
                        <TableCell className="py-3 px-4 text-xs font-medium text-pink-600 dark:text-pink-400">
                          {part.totalStock - part.remainingStock}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-xs text-gray-600 dark:text-gray-400">{part.unit}</TableCell>
                        <TableCell className="py-3 px-4 text-xs">
                          {part.remainingStock <= part.lowStockThreshold ? (
                            <Badge variant="destructive" className="text-xs py-1 px-3 shadow-md bg-gradient-to-r from-red-500 to-rose-500">
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="default" className="text-xs py-1 px-3 shadow-md bg-gradient-to-r from-green-500 to-emerald-500">
                              In Stock
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-xs text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-xs bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-500 hover:to-emerald-500 hover:text-white border-green-200 dark:border-green-800 transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
                              onClick={() => handleAddStock(part.id)}
                            >
                              Add Stock
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-500 hover:to-cyan-500 hover:text-white border-blue-200 dark:border-blue-800 transition-all duration-200 hover:scale-110 shadow-sm hover:shadow-md"
                              onClick={() => handleOpenDialog(part)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 transition-all duration-200 hover:scale-110 shadow-md hover:shadow-lg"
                              onClick={() => handleDeleteClick(part.id)}
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

        {/* Create/Edit Part Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingPart ? "Edit Spare Part" : "Add New Spare Part"}
              </DialogTitle>
              <DialogDescription>
                {editingPart
                  ? "Update spare part information."
                  : "Add a new spare part to the inventory."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Part Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="totalStock">Total Stock *</Label>
                    <Input
                      id="totalStock"
                      type="number"
                      min="0"
                      value={formData.totalStock}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          totalStock: parseInt(e.target.value) || 0,
                          remainingStock: editingPart
                            ? formData.remainingStock
                            : parseInt(e.target.value) || 0,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e) =>
                        setFormData({ ...formData, unit: e.target.value })
                      }
                      placeholder="pcs, kg, etc."
                    />
                  </div>
                </div>
                {editingPart && (
                  <div className="space-y-2">
                    <Label htmlFor="remainingStock">Remaining Stock</Label>
                    <Input
                      id="remainingStock"
                      type="number"
                      min="0"
                      value={formData.remainingStock}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          remainingStock: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                  <Input
                    id="lowStockThreshold"
                    type="number"
                    min="0"
                    value={formData.lowStockThreshold}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        lowStockThreshold: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingPart ? "Update Part" : "Create Part"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Stock Dialog */}
        <Dialog open={isAddStockDialogOpen} onOpenChange={setIsAddStockDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Stock</DialogTitle>
              <DialogDescription>
                Add quantity to {parts.find((p) => p.id === addStockPartId)?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="addStockQuantity">Quantity *</Label>
                <Input
                  id="addStockQuantity"
                  type="number"
                  min="1"
                  value={addStockQuantity}
                  onChange={(e) =>
                    setAddStockQuantity(parseInt(e.target.value) || 0)
                  }
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Unit: {parts.find((p) => p.id === addStockPartId)?.unit}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddStockDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleAddStockSubmit}>
                Add Stock
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the spare part.
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

export default SpareParts;
