import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Clock, AlertCircle, Calendar, TrendingUp, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MaintenanceCase, MaintenanceStatus, District, User } from "@/lib/data-models";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { differenceInCalendarDays } from "date-fns";

const PENDING_STATUSES: MaintenanceStatus[] = [
  "Received",
  "Pending",
];

const SLA_TARGET_DAYS = 14;

const Pending = () => {
  const [cases, setCases] = useState<MaintenanceCase[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDistrict, setFilterDistrict] = useState<string>("all");
  const [filterTechnician, setFilterTechnician] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  const userRole = localStorage.getItem("userRole");
  const userDistrict = localStorage.getItem("userDistrict") as District | null;
  const isAdmin = userRole === "admin";

  useEffect(() => {
    loadCases();
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const usersData = (await getStorageItem<User[]>(STORAGE_KEYS.USERS)) || [];
    setUsers(usersData);
  };

  const loadCases = async () => {
    const allCases = (await getStorageItem<MaintenanceCase[]>(STORAGE_KEYS.CASES)) || [];
    // Filter pending cases
    const pendingCases = allCases.filter((c) =>
      PENDING_STATUSES.includes(c.maintenanceStatus)
    );
    
    // Filter by district if not admin
    if (!isAdmin && userDistrict) {
      setCases(pendingCases.filter((c) => c.district === userDistrict));
    } else {
      setCases(pendingCases);
    }
  };

  const getDaysPending = (caseItem: MaintenanceCase): number => {
    const receivedDate = new Date(caseItem.dateReceivedAtSC);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - receivedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getCaseSlaInfo = (caseItem: MaintenanceCase) => {
    if (!caseItem.dateReceivedAtSC) {
      return {
        days: null as number | null,
        statusLabel: "Waiting for Date Received",
        isWithinTarget: true,
        target: caseItem.slaTargetDays ?? SLA_TARGET_DAYS,
      };
    }

    const receivedDate = new Date(caseItem.dateReceivedAtSC);
    const comparisonDate = caseItem.deliveryDate ? new Date(caseItem.deliveryDate) : new Date();
    const rawDiff = differenceInCalendarDays(comparisonDate, receivedDate);
    const diff = Math.max(0, rawDiff);
    const target = caseItem.slaTargetDays ?? SLA_TARGET_DAYS;
    const isWithinTarget = diff <= target;

    return {
      days: diff,
      statusLabel: isWithinTarget ? `Within ${target} Days` : `Exceeded ${target} Days`,
      isWithinTarget,
      target,
    };
  };

  const getStatusCategory = (status: MaintenanceStatus): string => {
    if (status === "Waiting for Parts") return "Waiting for Parts";
    if (status === "Under Review") return "Under Review";
    if (status === "Ready for Delivery") return "Waiting for Customer";
    if (["Picked Up", "Repairing"].includes(status)) return "Waiting for Technician";
    return "Other";
  };

  const filteredAndPaginatedCases = useMemo(() => {
    let filtered = cases.filter((caseItem) => {
      // Status filter
      if (filterStatus !== "all" && caseItem.maintenanceStatus !== filterStatus) {
        return false;
      }

      // District filter
      if (filterDistrict !== "all" && caseItem.district !== filterDistrict) {
        return false;
      }

      // Technician filter
      if (filterTechnician !== "all" && caseItem.technicianId !== filterTechnician) {
        return false;
      }

      // Search filter
      if (
        searchTerm &&
        !caseItem.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !caseItem.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !caseItem.productName.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      return true;
    });

    // Sort by date (oldest first for pending cases)
    filtered = [...filtered].sort((a, b) => {
      const dateA = new Date(a.dateReceivedAtSC).getTime();
      const dateB = new Date(b.dateReceivedAtSC).getTime();
      return dateA - dateB;
    });

    // Calculate pagination
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filtered.slice(startIndex, endIndex);

    return {
      paginated,
      total: filtered.length,
      totalPages,
      startIndex: startIndex + 1,
      endIndex: Math.min(endIndex, filtered.length),
      allFiltered: filtered, // Keep all filtered for status categories
    };
  }, [cases, filterStatus, filterDistrict, filterTechnician, searchTerm, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterDistrict, filterTechnician, searchTerm]);

  const technicians = useMemo(() => {
    const techSet = new Set(cases.map((c) => c.technicianId).filter(id => id && id.trim() !== ""));
    return Array.from(techSet).map((id) => {
      const caseItem = cases.find((c) => c.technicianId === id);
      return {
        id,
        name: caseItem?.technicianName || "Unknown",
      };
    });
  }, [cases]);

  // Get districts from cases (districts come from customer data, not from technicians)
  const districts = Array.from(
    new Set(
      cases
        .map((c) => c.district)
        .filter((district): district is string => !!district && district.trim() !== "")
    )
  ).sort();

  const totalPending = filteredAndPaginatedCases.total;
  const pendingYTD = filteredAndPaginatedCases.allFiltered.filter(
    (c) => new Date(c.dateReceivedAtSC).getFullYear() === new Date().getFullYear()
  ).length;
  const pendingMTD = filteredAndPaginatedCases.allFiltered.filter(
    (c) =>
      new Date(c.dateReceivedAtSC).getMonth() === new Date().getMonth() &&
      new Date(c.dateReceivedAtSC).getFullYear() === new Date().getFullYear()
  ).length;

  const avgDaysPending = filteredAndPaginatedCases.allFiltered.length > 0
    ? Math.round(
        filteredAndPaginatedCases.allFiltered.reduce((sum, c) => sum + getDaysPending(c), 0) /
          filteredAndPaginatedCases.allFiltered.length
      )
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-gradient-to-r from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-800/40 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 bg-clip-text text-transparent">
              Pending Cases
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1 text-lg">
              Track all pending maintenance cases and their status ⏳
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-500 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Total Pending
              </CardTitle>
              <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                {totalPending}
              </div>
            </CardContent>
          </Card>
          
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-500 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Pending YTD
              </CardTitle>
              <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                {pendingYTD}
              </div>
            </CardContent>
          </Card>
          
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-rose-500 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Pending MTD
              </CardTitle>
              <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-red-500 to-rose-500 bg-clip-text text-transparent">
                {pendingMTD}
              </div>
            </CardContent>
          </Card>
          
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-amber-500 opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Avg Days Pending
              </CardTitle>
              <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-lg group-hover:scale-110 transition-transform duration-300">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-yellow-500 to-amber-500 bg-clip-text text-transparent">
                {avgDaysPending}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-red-500/5" />
          <CardHeader className="relative z-10 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-200 font-medium">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by account, reference, or product..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-700/50 focus:border-amber-500 dark:focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {PENDING_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isAdmin && (
                <>
                  <div className="space-y-2">
                    <Label>District</Label>
                    <Select value={filterDistrict} onValueChange={setFilterDistrict}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Districts" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Districts</SelectItem>
                        {districts.filter(d => d && d.trim() !== "").map((district) => (
                          <SelectItem key={district} value={district}>
                            {district}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Technician</Label>
                    <Select value={filterTechnician} onValueChange={setFilterTechnician}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Technicians" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Technicians</SelectItem>
                        {technicians.filter(tech => tech.id && tech.id.trim() !== "").map((tech) => (
                          <SelectItem key={tech.id} value={tech.id}>
                            {tech.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Cases Table */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-red-500/5" />
          <CardHeader className="relative z-10 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              Pending Cases
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300">
              {filteredAndPaginatedCases.total} case(s) found
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 pt-6">
            {filteredAndPaginatedCases.total === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 mb-4">
                  <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-lg font-medium">
                  No pending cases found
                </p>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  All cases have been completed!
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 font-medium bg-amber-50/50 dark:bg-amber-950/20 px-4 py-2 rounded-lg border border-amber-200/50 dark:border-amber-800/50">
                  Showing {filteredAndPaginatedCases.startIndex} to {filteredAndPaginatedCases.endIndex} of {filteredAndPaginatedCases.total} cases
                </div>
                <div className="border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-hidden shadow-inner">
                  <div className="max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 z-10">
                        <TableRow className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
                          <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Ref #</TableHead>
                          <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Account #</TableHead>
                          <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Product</TableHead>
                          <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Status</TableHead>
                          <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Category</TableHead>
                          <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Technician</TableHead>
                          {isAdmin && <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">District</TableHead>}
                          <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Days Pending</TableHead>
                          <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Date Received</TableHead>
                          <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">SLA Days</TableHead>
                          <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">SLA Calc</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndPaginatedCases.paginated.map((caseItem, index) => {
                          const caseSla = getCaseSlaInfo(caseItem);
                          const daysPending = getDaysPending(caseItem);
                          return (
                            <TableRow 
                              key={caseItem.id} 
                              className="hover:bg-gradient-to-r hover:from-amber-50/50 hover:to-orange-50/50 dark:hover:from-amber-900/10 dark:hover:to-orange-900/10 transition-all duration-200 border-b border-gray-100 dark:border-gray-800"
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              <TableCell className="py-3 px-4 text-xs font-semibold text-gray-800 dark:text-gray-200">
                                {caseItem.referenceNumber}
                              </TableCell>
                              <TableCell className="py-3 px-4 text-xs text-gray-600 dark:text-gray-400">{caseItem.accountNumber}</TableCell>
                              <TableCell className="py-3 px-4 text-xs font-medium text-gray-700 dark:text-gray-300">{caseItem.productName}</TableCell>
                              <TableCell className="py-3 px-4">
                                <Badge variant="outline" className="text-xs py-1 px-3 shadow-sm border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
                                  {caseItem.maintenanceStatus}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3 px-4">
                                <Badge variant="secondary" className="text-xs py-1 px-3 shadow-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                                  {getStatusCategory(caseItem.maintenanceStatus)}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3 px-4 text-xs text-gray-600 dark:text-gray-400">{caseItem.technicianName || "-"}</TableCell>
                              {isAdmin && <TableCell className="py-3 px-4 text-xs text-gray-600 dark:text-gray-400">{caseItem.district || "-"}</TableCell>}
                              <TableCell className="py-3 px-4">
                                <Badge
                                  className={`text-xs py-1 px-3 shadow-md ${
                                    daysPending > 30
                                      ? "bg-gradient-to-r from-red-500 to-rose-500 text-white"
                                      : daysPending > 14
                                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
                                      : "bg-gradient-to-r from-yellow-500 to-amber-500 text-white"
                                  }`}
                                >
                                  {daysPending} days
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3 px-4 text-xs text-gray-600 dark:text-gray-400">
                                {new Date(caseItem.dateReceivedAtSC).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="py-3 px-4 text-xs">
                                {caseSla.days !== null ? (
                                  <span
                                    className={`font-bold ${
                                      caseSla.isWithinTarget
                                        ? "text-green-600 dark:text-green-400"
                                        : "text-red-600 dark:text-red-400"
                                    }`}
                                  >
                                    {caseSla.days}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell className="py-3 px-4 text-xs">
                                {caseSla.days !== null ? (
                                  <Badge
                                    className={`text-xs py-1 px-2 shadow-sm ${
                                      caseSla.isWithinTarget
                                        ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                                        : "bg-gradient-to-r from-red-500 to-rose-500 text-white"
                                    }`}
                                  >
                                    {caseSla.statusLabel}
                                  </Badge>
                                ) : (
                                  <span className="text-gray-500 dark:text-gray-400 text-xs">{caseSla.statusLabel}</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                {/* Pagination Controls */}
                {filteredAndPaginatedCases.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 p-4 bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-xl border border-amber-200/50 dark:border-amber-800/50">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Page {currentPage} of {filteredAndPaginatedCases.totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-9 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-gradient-to-r hover:from-amber-500 hover:to-orange-500 hover:text-white hover:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, filteredAndPaginatedCases.totalPages) }, (_, i) => {
                          let pageNum;
                          if (filteredAndPaginatedCases.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= filteredAndPaginatedCases.totalPages - 2) {
                            pageNum = filteredAndPaginatedCases.totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className={`h-9 w-9 p-0 ${
                                currentPage === pageNum
                                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md"
                                  : "bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-gradient-to-r hover:from-amber-500 hover:to-orange-500 hover:text-white hover:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
                              }`}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.min(filteredAndPaginatedCases.totalPages, prev + 1))}
                        disabled={currentPage === filteredAndPaginatedCases.totalPages}
                        className="h-9 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-gradient-to-r hover:from-amber-500 hover:to-orange-500 hover:text-white hover:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Pending;
