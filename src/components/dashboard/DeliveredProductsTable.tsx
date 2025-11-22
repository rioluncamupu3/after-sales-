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
import { differenceInCalendarDays } from "date-fns";

interface DeliveredProductsTableProps {
  startDate?: Date;
  endDate?: Date;
  district?: string;
}

const SLA_TARGET_DAYS = 14;

const DeliveredProductsTable = ({ startDate, endDate, district }: DeliveredProductsTableProps) => {
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
  
  const deliveredProducts = useMemo(() => {
    let cases = allCases.filter(
      (c) => c.maintenanceStatus === "Delivered"
    );
    
    // Filter by district if not admin
    if (!isAdmin && userDistrict) {
      cases = cases.filter(c => c.district === userDistrict);
    }
    
    // Filter by selected district
    if (district) {
      cases = cases.filter(c => c.district === district);
    }
    
    // Filter by date range
    if (startDate || endDate) {
      cases = cases.filter(c => {
        const deliveryDate = new Date(c.deliveryDate || c.updatedAt);
        if (startDate && deliveryDate < startDate) return false;
        if (endDate) {
          const endDateWithTime = new Date(endDate);
          endDateWithTime.setHours(23, 59, 59, 999);
          if (deliveryDate > endDateWithTime) return false;
        }
        return true;
      });
    }
    
    // Sort by delivery date (most recent first)
    return cases
      .sort((a, b) => {
        const dateA = new Date(a.deliveryDate || a.updatedAt).getTime();
        const dateB = new Date(b.deliveryDate || b.updatedAt).getTime();
        return dateB - dateA;
      })
      .slice(0, 50); // Show latest 50
  }, [allCases, isAdmin, userDistrict, district, startDate, endDate]);

  const getCaseSlaInfo = (caseItem: MaintenanceCase) => {
    if (!caseItem.dateReceivedAtSC) {
      return {
        days: null as number | null,
        statusLabel: "Waiting for Date Received",
        isWithinTarget: true,
        target: caseItem.slaTargetDays ?? SLA_TARGET_DAYS,
      };
    }

    // Prefer persisted SLA if available
    if (typeof caseItem.slaDays === "number" && caseItem.slaStatus) {
      const target = caseItem.slaTargetDays ?? SLA_TARGET_DAYS;
      const isWithinTarget = caseItem.slaDays <= target;
      return {
        days: caseItem.slaDays,
        statusLabel: String(caseItem.slaStatus),
        isWithinTarget,
        target,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivered Products</CardTitle>
      </CardHeader>
      <CardContent>
        {deliveredProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No delivered products found
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="bg-muted/50">
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Account Number</TableHead>
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Product</TableHead>
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Technician</TableHead>
                    {isAdmin && <TableHead className="h-9 text-xs font-semibold py-2 px-3">District</TableHead>}
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Delivery Date</TableHead>
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Issue Fixed</TableHead>
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Warranty</TableHead>
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">SLA Days</TableHead>
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">SLA Calc</TableHead>
                    <TableHead className="h-9 text-xs font-semibold py-2 px-3">Spare Parts Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveredProducts.map((product) => {
                    const caseSla = getCaseSlaInfo(product);
                    return (
                      <TableRow key={product.id} className="hover:bg-muted/30">
                        <TableCell className="py-2 px-3 text-xs font-medium">
                          {product.accountNumber}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-xs">{product.productName}</TableCell>
                        <TableCell className="py-2 px-3 text-xs">{product.technicianName}</TableCell>
                        {isAdmin && <TableCell className="py-2 px-3 text-xs">{product.district}</TableCell>}
                        <TableCell className="py-2 px-3 text-xs">
                          {product.deliveryDate
                            ? new Date(product.deliveryDate).toLocaleDateString()
                            : new Date(product.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-xs">{product.issue}</TableCell>
                        <TableCell className="py-2 px-3 text-xs">
                          <Badge
                            variant={
                              product.warrantyStatus === "Valid" ? "default" : "destructive"
                            }
                            className="text-xs py-0.5 px-2"
                          >
                            {product.warrantyStatus === "Valid" ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-xs">
                          {caseSla.days !== null ? (
                            <span
                              className={
                                caseSla.isWithinTarget
                                  ? "text-green-600 font-semibold"
                                  : "text-red-600 font-semibold"
                              }
                            >
                              {caseSla.days}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-xs">
                          {caseSla.days !== null ? (
                            <span
                              className={
                                caseSla.isWithinTarget
                                  ? "text-green-600 font-semibold"
                                  : "text-red-600 font-semibold"
                              }
                            >
                              {caseSla.statusLabel}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              {caseSla.statusLabel}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-xs">
                          {product.sparePartsUsed && product.sparePartsUsed.length > 0
                            ? product.sparePartsUsed
                                .map((p) => `${p.partName} (${p.quantity})`)
                                .join(", ")
                            : "None"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DeliveredProductsTable;
