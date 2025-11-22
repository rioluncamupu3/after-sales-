import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StatsCards from "@/components/dashboard/StatsCards";
import DeliveredProductsTable from "@/components/dashboard/DeliveredProductsTable";
import PendingCasesTable from "@/components/dashboard/PendingCasesTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Filter, Package } from "lucide-react";
import { District, MaintenanceStatus, User, MaintenanceCase } from "@/lib/data-models";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const role = localStorage.getItem("userRole");
    const name = localStorage.getItem("userEmail");
    if (!role) {
      navigate("/login");
    } else {
      setUserRole(role);
      if (name) {
        setUserName(name);
      }
    }
  }, [navigate]);

  useEffect(() => {
    const loadUsers = async () => {
      const usersData = (await getStorageItem<User[]>(STORAGE_KEYS.USERS)) || [];
      setUsers(usersData);
    };
    loadUsers();
  }, []);

  const handleClearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSelectedDistrict("all");
    setSelectedStatus("all");
  };

  const hasActiveFilters = startDate || endDate || selectedDistrict !== "all" || selectedStatus !== "all";

  if (!userRole) return null;

  const isAdmin = userRole === "admin";
  
  // Get districts from technicians/users
  const technicians = users.filter((u) => u.permission !== "admin");
  const districts = Array.from(
    new Set(
      technicians
        .map((tech) => tech.district)
        .filter((district): district is string => !!district)
    )
  ).sort();
  const statuses: MaintenanceStatus[] = [
    "Reported",
    "Received",
    "Picked Up",
    "Repairing",
    "Waiting for Parts",
    "Under Review",
    "Ready for Delivery",
    "Delivered",
    "Closed",
  ];

  // Spare Parts Usage by Technician Component
  const SparePartsUsageTable = ({ startDate, endDate, district }: { startDate?: Date; endDate?: Date; district?: string }) => {
    const [cases, setCases] = useState<MaintenanceCase[]>([]);
    const userDistrict = localStorage.getItem("userDistrict");
    
    useEffect(() => {
      const loadCases = async () => {
        const casesData = (await getStorageItem<MaintenanceCase[]>(STORAGE_KEYS.CASES)) || [];
        setCases(casesData);
      };
      loadCases();
    }, []);
    
    const filteredCases = useMemo(() => {
      let filtered = cases || [];
      
      if (!isAdmin && userDistrict) {
        filtered = filtered.filter(c => c.district === userDistrict);
      }
      
      if (district) {
        filtered = filtered.filter(c => c.district === district);
      }
      
      if (startDate || endDate) {
        filtered = filtered.filter(c => {
          const caseDate = new Date(c.dateReceivedAtSC);
          if (startDate && caseDate < startDate) return false;
          if (endDate) {
            const endDateWithTime = new Date(endDate);
            endDateWithTime.setHours(23, 59, 59, 999);
            if (caseDate > endDateWithTime) return false;
          }
          return true;
        });
      }
      
      return filtered;
    }, [cases, isAdmin, userDistrict, district, startDate, endDate]);

    const technicianUsage = useMemo(() => {
      const techMap = new Map<string, { 
        name: string; 
        district?: string;
        totalUsed: number; 
        partsCount: number;
        parts: Array<{ partName: string; quantity: number }>;
      }>();
      
      filteredCases.forEach((caseItem) => {
        if (caseItem.sparePartsUsed && caseItem.sparePartsUsed.length > 0) {
          const techId = caseItem.technicianId;
          const techName = caseItem.technicianName;
          
          if (!techMap.has(techId)) {
            techMap.set(techId, { 
              name: techName, 
              district: caseItem.district,
              totalUsed: 0, 
              partsCount: 0,
              parts: []
            });
          }
          
          const tech = techMap.get(techId)!;
          caseItem.sparePartsUsed.forEach((usedPart) => {
            tech.totalUsed += usedPart.quantity;
            tech.partsCount += 1;
            const existingPart = tech.parts.find(p => p.partName === usedPart.partName);
            if (existingPart) {
              existingPart.quantity += usedPart.quantity;
            } else {
              tech.parts.push({ partName: usedPart.partName, quantity: usedPart.quantity });
            }
          });
        }
      });
      
      return Array.from(techMap.values()).sort((a, b) => b.totalUsed - a.totalUsed);
    }, [filteredCases]);

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Spare Parts Usage by Technician
          </CardTitle>
          <CardDescription>
            Track spare parts consumption by each technician
          </CardDescription>
        </CardHeader>
        <CardContent>
          {technicianUsage.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No spare parts usage recorded
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Technician</TableHead>
                    {isAdmin && <TableHead className="h-9 text-xs font-semibold py-2 px-3">District</TableHead>}
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Total Used</TableHead>
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Parts Count</TableHead>
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Parts Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {technicianUsage.map((tech, index) => (
                    <TableRow key={index} className="hover:bg-muted/30">
                      <TableCell className="py-2 px-3 text-xs font-medium">{tech.name}</TableCell>
                      {isAdmin && <TableCell className="py-2 px-3 text-xs">{tech.district || "-"}</TableCell>}
                      <TableCell className="py-2 px-3 text-xs font-semibold">{tech.totalUsed}</TableCell>
                      <TableCell className="py-2 px-3 text-xs">{tech.partsCount}</TableCell>
                      <TableCell className="py-2 px-3 text-xs">
                        <div className="flex flex-wrap gap-1">
                          {tech.parts.map((part, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs py-0.5 px-1.5">
                              {part.partName}: {part.quantity}
                            </Badge>
                          ))}
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
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-gradient-to-r from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-800/40 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1 text-lg">
              {`Welcome back${userName ? `, ${userName.split("@")[0]}` : ""}! 👋`}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-gradient-to-r hover:from-blue-500 hover:to-purple-500 hover:text-white hover:border-transparent transition-all duration-300 shadow-md hover:shadow-lg"
          >
            <Filter className="h-4 w-4" />
            {showFilters ? "Hide Filters" : "Show Filters"}
            {hasActiveFilters && (
              <span className="ml-1 h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse"></span>
            )}
          </Button>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5" />
            <CardHeader className="relative z-10 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Filters
                </CardTitle>
                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClearFilters}
                    className="hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="relative z-10 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <DatePicker
                    date={startDate}
                    onSelect={setStartDate}
                    placeholder="Select start date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <DatePicker
                    date={endDate}
                    onSelect={setEndDate}
                    placeholder="Select end date"
                  />
                </div>
                {isAdmin && (
                  <div className="space-y-2">
                    <Label>District</Label>
                    <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Districts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Districts</SelectItem>
                        {districts.map((district) => (
                          <SelectItem key={district} value={district}>
                            {district}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {statuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <StatsCards
          userRole={userRole}
          startDate={startDate}
          endDate={endDate}
          district={selectedDistrict !== "all" ? selectedDistrict : undefined}
          status={selectedStatus !== "all" ? selectedStatus : undefined}
        />

        <Tabs defaultValue="delivered" className="space-y-4">
          <TabsList className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-lg p-1 rounded-xl">
            <TabsTrigger 
              value="delivered"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white rounded-lg transition-all duration-200"
            >
              Delivered Products
            </TabsTrigger>
            <TabsTrigger 
              value="pending"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white rounded-lg transition-all duration-200"
            >
              Pending Cases
            </TabsTrigger>
            <TabsTrigger 
              value="spare-parts"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white rounded-lg transition-all duration-200"
            >
              Spare Parts Usage
            </TabsTrigger>
          </TabsList>
          <TabsContent value="delivered" className="space-y-4">
            <DeliveredProductsTable
              startDate={startDate}
              endDate={endDate}
              district={selectedDistrict !== "all" ? selectedDistrict : undefined}
            />
          </TabsContent>
          <TabsContent value="pending" className="space-y-4">
            <PendingCasesTable
              startDate={startDate}
              endDate={endDate}
              district={selectedDistrict !== "all" ? selectedDistrict : undefined}
              status={selectedStatus !== "all" ? selectedStatus : undefined}
            />
          </TabsContent>
          <TabsContent value="spare-parts" className="space-y-4">
            <SparePartsUsageTable
              startDate={startDate}
              endDate={endDate}
              district={selectedDistrict !== "all" ? selectedDistrict : undefined}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
