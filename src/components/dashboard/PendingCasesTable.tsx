import { useMemo, useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MaintenanceCase } from "@/lib/data-models";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

interface PendingCasesTableProps {
  startDate?: Date;
  endDate?: Date;
  district?: string;
  status?: string;
}

const PendingCasesTable = ({ startDate, endDate, district, status }: PendingCasesTableProps) => {
  const [allCases, setAllCases] = useState<MaintenanceCase[]>([]);

  useEffect(() => {
    const loadCases = async () => {
      const casesData = (await getStorageItem<MaintenanceCase[]>(STORAGE_KEYS.CASES)) || [];
      setAllCases(casesData);
    };
    loadCases();
  }, []);
  
  const userDistrict = localStorage.getItem("userDistrict");
  const userRole = localStorage.getItem("userRole");
  const isAdmin = userRole === "admin";
  
  const pendingCases = useMemo(() => {
    let cases = allCases.filter(
      (c) => c.maintenanceStatus !== "Delivered"
    );
    
    // Filter by district if not admin
    if (!isAdmin && userDistrict) {
      cases = cases.filter(c => c.district === userDistrict);
    }
    
    // Filter by selected district
    if (district) {
      cases = cases.filter(c => c.district === district);
    }
    
    // Filter by status
    if (status) {
      cases = cases.filter(c => c.maintenanceStatus === status);
    }
    
    // Filter by date range
    if (startDate || endDate) {
      cases = cases.filter(c => {
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
    
    // Sort by date received (oldest first)
    return cases
      .sort((a, b) => {
        const dateA = new Date(a.dateReceivedAtSC).getTime();
        const dateB = new Date(b.dateReceivedAtSC).getTime();
        return dateA - dateB;
      })
      .slice(0, 50); // Show latest 50
  }, [allCases, isAdmin, userDistrict, district, status, startDate, endDate]);

  const getDaysPending = (caseItem: MaintenanceCase): number => {
    const receivedDate = new Date(caseItem.dateReceivedAtSC);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - receivedDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Received":
        return "bg-gradient-to-r from-yellow-500 to-amber-500 text-white";
      case "Pending":
        return "bg-gradient-to-r from-red-500 to-rose-500 text-white";
      case "Delivered":
        return "bg-gradient-to-r from-green-500 to-emerald-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Cases</CardTitle>
      </CardHeader>
      <CardContent>
        {pendingCases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No pending cases found
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted/50">
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Account Number</TableHead>
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Product</TableHead>
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Status</TableHead>
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Technician</TableHead>
                    {isAdmin && <TableHead className="h-9 text-xs font-semibold py-2 px-3">District</TableHead>}
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Days Pending</TableHead>
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Issue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCases.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell className="py-2 px-3 text-xs font-medium">
                        {item.accountNumber}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-xs">{item.productName}</TableCell>
                      <TableCell className="py-2 px-3 text-xs">
                        <Badge className={getStatusColor(item.maintenanceStatus)}>
                          {item.maintenanceStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 px-3 text-xs">{item.technicianName}</TableCell>
                      {isAdmin && (
                        <TableCell className="py-2 px-3 text-xs">{item.district}</TableCell>
                      )}
                      <TableCell className="py-2 px-3 text-xs">
                        <Badge
                          variant={
                            getDaysPending(item) > 30
                              ? "destructive"
                              : getDaysPending(item) > 14
                              ? "default"
                              : "secondary"
                          }
                          className="text-xs py-0.5 px-2"
                        >
                          {getDaysPending(item)} days
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 px-3 text-xs">{item.issue}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PendingCasesTable;
