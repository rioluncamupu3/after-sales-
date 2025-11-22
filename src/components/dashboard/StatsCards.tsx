import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, CheckCircle, Clock, AlertTriangle, Calendar, Shield } from "lucide-react";
import { MaintenanceCase, SparePart } from "@/lib/data-models";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

interface StatsCardsProps {
  userRole: string;
  startDate?: Date;
  endDate?: Date;
  district?: string;
  status?: string;
}

const StatsCards = ({ userRole, startDate, endDate, district, status }: StatsCardsProps) => {
  const [cases, setCases] = useState<MaintenanceCase[]>([]);
  const [parts, setParts] = useState<SparePart[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const casesData = (await getStorageItem<MaintenanceCase[]>(STORAGE_KEYS.CASES)) || [];
      const partsData = (await getStorageItem<SparePart[]>(STORAGE_KEYS.SPARE_PARTS)) || [];
      setCases(casesData);
      setParts(partsData);
    };
    loadData();
  }, []);
  
  const userDistrict = localStorage.getItem("userDistrict");
  const isAdmin = userRole === "admin";
  
  // Filter cases by district if not admin, and apply additional filters
  const filteredCases = useMemo(() => {
    let filtered = cases;
    
    // Filter by user district if not admin
    if (!isAdmin && userDistrict) {
      filtered = filtered.filter(c => c.district === userDistrict);
    }
    
    // Filter by selected district
    if (district) {
      filtered = filtered.filter(c => c.district === district);
    }
    
    // Filter by status
    if (status) {
      filtered = filtered.filter(c => c.maintenanceStatus === status);
    }
    
    // Filter by date range
    if (startDate || endDate) {
      filtered = filtered.filter(c => {
        const caseDate = new Date(c.createdAt);
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
  }, [cases, isAdmin, userDistrict, district, status, startDate, endDate]);

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  // Calculate metrics
  const totalCasesYTD = useMemo(() => {
    return filteredCases.filter(
      (c) => new Date(c.createdAt).getFullYear() === currentYear
    ).length;
  }, [filteredCases, currentYear]);

  const totalCasesMTD = useMemo(() => {
    return filteredCases.filter((c) => {
      const date = new Date(c.createdAt);
      return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
    }).length;
  }, [filteredCases, currentYear, currentMonth]);

  const deliveredCases = useMemo(() => {
    return filteredCases.filter((c) => c.maintenanceStatus === "Delivered");
  }, [filteredCases]);

  const deliveredYTD = useMemo(() => {
    return deliveredCases.filter(
      (c) => new Date(c.deliveryDate || c.updatedAt).getFullYear() === currentYear
    ).length;
  }, [deliveredCases, currentYear]);

  const deliveredMTD = useMemo(() => {
    return deliveredCases.filter((c) => {
      const date = new Date(c.deliveryDate || c.updatedAt);
      return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
    }).length;
  }, [deliveredCases, currentYear, currentMonth]);

  const pendingCases = useMemo(() => {
    return filteredCases.filter(
      (c) => c.maintenanceStatus !== "Delivered"
    ).length;
  }, [filteredCases]);

  const warrantyValid = useMemo(() => {
    return filteredCases.filter((c) => c.warrantyStatus === "Valid").length;
  }, [filteredCases]);

  const warrantyExpired = useMemo(() => {
    return filteredCases.filter((c) => c.warrantyStatus === "Expired").length;
  }, [filteredCases]);

  const sparePartsRemaining = useMemo(() => {
    return parts.reduce((sum, p) => sum + p.remainingStock, 0);
  }, [parts]);

  // Calculate spare parts used by technicians
  const sparePartsUsedByTechnician = useMemo(() => {
    const techUsage = new Map<string, { name: string; totalUsed: number; partsCount: number }>();
    
    filteredCases.forEach((caseItem) => {
      if (caseItem.sparePartsUsed && caseItem.sparePartsUsed.length > 0) {
        const techId = caseItem.technicianId;
        const techName = caseItem.technicianName;
        
        if (!techUsage.has(techId)) {
          techUsage.set(techId, { name: techName, totalUsed: 0, partsCount: 0 });
        }
        
        const tech = techUsage.get(techId)!;
        caseItem.sparePartsUsed.forEach((usedPart) => {
          tech.totalUsed += usedPart.quantity;
          tech.partsCount += 1;
        });
      }
    });
    
    return Array.from(techUsage.values()).sort((a, b) => b.totalUsed - a.totalUsed);
  }, [filteredCases]);

  const totalSparePartsUsed = useMemo(() => {
    return filteredCases.reduce((sum, c) => {
      if (c.sparePartsUsed) {
        return sum + c.sparePartsUsed.reduce((partSum, part) => partSum + part.quantity, 0);
      }
      return sum;
    }, 0);
  }, [filteredCases]);

  const stats = [
    {
      title: "Total Cases (YTD)",
      value: totalCasesYTD.toString(),
      icon: Calendar,
      gradient: "from-blue-500 to-cyan-500",
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Total Cases (MTD)",
      value: totalCasesMTD.toString(),
      icon: Calendar,
      gradient: "from-indigo-500 to-purple-500",
      iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
      iconColor: "text-indigo-600 dark:text-indigo-400",
    },
    {
      title: "Delivered (YTD)",
      value: deliveredYTD.toString(),
      icon: CheckCircle,
      gradient: "from-green-500 to-emerald-500",
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      title: "Delivered (MTD)",
      value: deliveredMTD.toString(),
      icon: CheckCircle,
      gradient: "from-teal-500 to-cyan-500",
      iconBg: "bg-teal-100 dark:bg-teal-900/30",
      iconColor: "text-teal-600 dark:text-teal-400",
    },
    {
      title: "Pending Cases",
      value: pendingCases.toString(),
      icon: Clock,
      gradient: "from-amber-500 to-orange-500",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Warranty Valid",
      value: warrantyValid.toString(),
      icon: Shield,
      gradient: "from-emerald-500 to-green-500",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      title: "Warranty Expired",
      value: warrantyExpired.toString(),
      icon: AlertTriangle,
      gradient: "from-red-500 to-rose-500",
      iconBg: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-600 dark:text-red-400",
    },
    {
      title: "Spare Parts Remaining",
      value: sparePartsRemaining.toString(),
      icon: Package,
      gradient: "from-violet-500 to-purple-500",
      iconBg: "bg-violet-100 dark:bg-violet-900/30",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
    {
      title: "Spare Parts Used",
      value: totalSparePartsUsed.toString(),
      icon: Package,
      gradient: "from-pink-500 to-rose-500",
      iconBg: "bg-pink-100 dark:bg-pink-900/30",
      iconColor: "text-pink-600 dark:text-pink-400",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card 
          key={stat.title}
          className="group relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {stat.title}
            </CardTitle>
            <div className={`${stat.iconBg} p-2 rounded-lg group-hover:scale-110 transition-transform duration-300`}>
              <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className={`text-3xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
              {stat.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default StatsCards;
