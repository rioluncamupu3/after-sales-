import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, X, ChevronLeft, ChevronRight, Trash2, FileText, Shield, Calendar } from "lucide-react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { MaintenanceCase, RawData, MaintenanceStatus, District, SparePart } from "@/lib/data-models";
import { calculateWarrantyStatus, calculateWarrantyEndDate, getWarrantyDaysRemaining } from "@/lib/warranty-utils";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { differenceInCalendarDays, format } from "date-fns";

const MAINTENANCE_STATUSES: MaintenanceStatus[] = [
  "Received",
  "Pending",
  "Delivered",
];

const SLA_TARGET_DAYS = 14;

const Cases = () => {
  const [cases, setCases] = useState<MaintenanceCase[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<MaintenanceCase | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<MaintenanceCase | null>(null);
  const [searchAccountNumber, setSearchAccountNumber] = useState("");
  const [foundCustomer, setFoundCustomer] = useState<RawData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    accountNumber: "",
    angazaId: "",
    groupName: "",
    ownerName: "",
    dateReportedAtSource: new Date(),
    dateReceivedAtSC: new Date(),
    registrationDate: undefined as Date | undefined,
    productName: "",
    productType: "",
    productDescription: "",
    referenceNumber: "",
    issue: "",
    issueDetails: "",
    maintenanceStatus: "Received" as MaintenanceStatus,
    serviceCenter: "",
    pickedUpBy: "",
    pickupDate: undefined as Date | undefined,
    deliveryDate: undefined as Date | undefined,
    maintenanceActionTaken: "",
    selectedTechnicianId: "",
    selectedDistrict: "" as District | "",
    damagedComponentFee: "" as string | number,
    costPerProductRepaired: "" as string | number,
    customerAgreedToPay: false,
    sparePartsUsed: [] as Array<{ partId: string; partName: string; quantity: number }>,
  });
  const [selectedPartId, setSelectedPartId] = useState("");
  const [selectedPartQuantity, setSelectedPartQuantity] = useState(1);
  const [availableProducts, setAvailableProducts] = useState<RawData[]>([]);

  const userRole = localStorage.getItem("userRole");
  const userId = localStorage.getItem("userId");
  const userEmail = localStorage.getItem("userEmail");
  const userDistrict = localStorage.getItem("userDistrict") as District | null;
  const isAdmin = userRole === "admin";
  const [users, setUsers] = useState<any[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [standardizedIssueDetails, setStandardizedIssueDetails] = useState<string[]>([]);
  
  const loadSpareParts = async () => {
    const parts = (await getStorageItem<SparePart[]>(STORAGE_KEYS.SPARE_PARTS)) || [];
    setSpareParts(parts);
  };
  
  const loadUsers = async () => {
    const usersData = (await getStorageItem<any[]>(STORAGE_KEYS.USERS)) || [];
    setUsers(usersData);
  };

  const loadStandardizedIssueDetails = async () => {
    const details = (await getStorageItem<string[]>(STORAGE_KEYS.STANDARDIZED_ISSUE_DETAILS)) || [];
    // If no details exist, initialize with default list
    if (details.length === 0) {
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

  // Filter to get only technicians (users with both fullName and serviceCenter)
  const technicians = useMemo(() => {
    return users.filter((u) => {
      // Exclude admins
      if (u.permission === "admin") return false;
      // Only include technicians (have both fullName and serviceCenter)
      const hasFullName = !!(u as any).fullName;
      const hasServiceCenter = !!(u as any).serviceCenter;
      return hasFullName && hasServiceCenter;
    });
  }, [users]);

  const slaInfo = useMemo(() => {
    if (!formData.dateReceivedAtSC) {
      return {
        days: null as number | null,
        statusLabel: "Waiting for Date Received",
        helperText: "Select the date received to calculate the SLA window.",
        isWithinTarget: true,
      };
    }

    const comparisonDate = formData.deliveryDate || new Date();
    const rawDiff = differenceInCalendarDays(comparisonDate, formData.dateReceivedAtSC);
    const normalizedDiff = Math.max(0, rawDiff);
    const isWithinTarget = normalizedDiff <= SLA_TARGET_DAYS;

    const helperText = formData.deliveryDate
      ? `Calculated from ${format(formData.dateReceivedAtSC, "PP")} to ${format(
          formData.deliveryDate,
          "PP"
        )}`
      : `No delivery date yet. Tracking from ${format(
          formData.dateReceivedAtSC,
          "PP"
        )} to today (${format(new Date(), "PP")}).`;

    return {
      days: normalizedDiff,
      statusLabel: isWithinTarget ? `Within ${SLA_TARGET_DAYS}-Day SLA` : `Exceeded ${SLA_TARGET_DAYS}-Day SLA`,
      helperText,
      isWithinTarget,
    };
  }, [formData.dateReceivedAtSC, formData.deliveryDate]);
  
  useEffect(() => {
    loadCases();
    loadSpareParts();
    loadUsers();
    loadStandardizedIssueDetails();
  }, []);

  useEffect(() => {
    if (isDialogOpen) {
      loadSpareParts();
    }
  }, [isDialogOpen]);

  // Debug: Log formData changes to help troubleshoot
  useEffect(() => {
    if (foundCustomer) {
      console.log("Form data state:", {
        groupName: formData.groupName,
        ownerName: formData.ownerName,
        registrationDate: formData.registrationDate,
        accountNumber: formData.accountNumber,
        angazaId: formData.angazaId,
      });
    }
  }, [formData.groupName, formData.ownerName, formData.registrationDate, foundCustomer]);

  const loadCases = async () => {
    const casesData = (await getStorageItem<MaintenanceCase[]>(STORAGE_KEYS.CASES)) || [];
    // Filter by district if not admin
    if (!isAdmin && userDistrict) {
      setCases(casesData.filter(c => c.district === userDistrict));
    } else {
      setCases(casesData);
    }
  };

  const saveCases = async (updatedCases: MaintenanceCase[]) => {
    await setStorageItem(STORAGE_KEYS.CASES, updatedCases);
    setCases(updatedCases);
  };

  const handleSearchAccount = async () => {
    if (!searchAccountNumber.trim()) {
      toast.error("Please enter an account number");
      return;
    }

    const rawData = (await getStorageItem<RawData[]>(STORAGE_KEYS.RAW_DATA)) || [];
    
    if (rawData.length === 0) {
      toast.error("No customer data found. Please import data first from the Import Data page.");
      return;
    }

    // Try exact match first
    let customer = rawData.find(
      (r) => r.accountNumber.toLowerCase() === searchAccountNumber.toLowerCase().trim()
    );

    // If no exact match, try partial match
    if (!customer) {
      customer = rawData.find(
        (r) => r.accountNumber.toLowerCase().includes(searchAccountNumber.toLowerCase().trim())
      );
    }

    if (customer) {
      setFoundCustomer(customer);
      
      // Find all products from the same group (if groupName exists)
      if (customer.groupName) {
        const productsInGroup = rawData.filter(
          (r) => r.groupName === customer.groupName && r.accountNumber !== customer.accountNumber
        );
        setAvailableProducts(productsInGroup);
      } else {
        setAvailableProducts([]);
      }
      
      // Log the full customer object to see what we have
      console.log("Found customer from raw data:", customer);
      
      // Parse registration date - handle various date formats
      let parsedRegistrationDate: Date | undefined = undefined;
      if (customer.registrationDate) {
        try {
          const dateStr = String(customer.registrationDate).trim();
          if (dateStr) {
            // Try parsing the date string
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
              parsedRegistrationDate = parsed;
            } else {
              // Try parsing as Excel date number if it's a number
              const numDate = Number(dateStr);
              if (!isNaN(numDate) && numDate > 0 && numDate < 100000) {
                // Excel date serial number (days since 1900-01-01)
                const excelEpoch = new Date(1899, 11, 30); // Excel epoch
                parsedRegistrationDate = new Date(excelEpoch.getTime() + numDate * 24 * 60 * 60 * 1000);
              }
            }
          }
        } catch (e) {
          console.error("Error parsing registration date:", e, customer.registrationDate);
        }
      }
      
      // Calculate warranty status using utility function (2 years from registration date)
      let warrantyStatus: "Valid" | "Expired" = "Expired";
      if (customer.registrationDate) {
        warrantyStatus = calculateWarrantyStatus(customer.registrationDate);
      }
      
      // Extract values - handle all possible cases (undefined, null, empty string)
      const groupNameValue = (customer.groupName !== undefined && customer.groupName !== null) 
        ? String(customer.groupName).trim() 
        : "";
      const ownerNameValue = (customer.ownerName !== undefined && customer.ownerName !== null)
        ? String(customer.ownerName).trim()
        : "";
      const districtValue = (customer.district !== undefined && customer.district !== null)
        ? String(customer.district).trim()
        : "";
      
      console.log("Extracted values:", {
        groupName: groupNameValue,
        ownerName: ownerNameValue,
        district: districtValue,
        registrationDate: parsedRegistrationDate,
        warrantyStatus: warrantyStatus,
        customerDistrict: customer.district,
      });
      
      // Auto-fill form with ALL requested fields from raw data
      const updatedFormData = {
        accountNumber: customer.accountNumber || "",
        angazaId: customer.angazaId || "",
        groupName: groupNameValue,
        ownerName: ownerNameValue,
        productName: customer.productName || "",
        productType: customer.productType || "",
        productDescription: customer.productDescription || "",
        registrationDate: parsedRegistrationDate,
        selectedDistrict: districtValue || formData.selectedDistrict,
        // Keep other existing form fields
        dateReportedAtSource: formData.dateReportedAtSource,
        dateReceivedAtSC: formData.dateReceivedAtSC,
        referenceNumber: formData.referenceNumber,
        issue: formData.issue,
        issueDetails: formData.issueDetails,
        maintenanceStatus: formData.maintenanceStatus,
        serviceCenter: formData.serviceCenter,
        pickedUpBy: formData.pickedUpBy,
        pickupDate: formData.pickupDate,
        deliveryDate: formData.deliveryDate,
        maintenanceActionTaken: formData.maintenanceActionTaken,
        selectedTechnicianId: formData.selectedTechnicianId,
        damagedComponentFee: formData.damagedComponentFee,
        costPerProductRepaired: formData.costPerProductRepaired,
        customerAgreedToPay: formData.customerAgreedToPay,
        sparePartsUsed: formData.sparePartsUsed,
      };
      
      setFormData(updatedFormData);
      
      console.log("Form data after update:", updatedFormData);
      
      // Show a detailed success message
      const missingFields = [];
      if (!groupNameValue) missingFields.push("Group Name");
      if (!ownerNameValue) missingFields.push("Owner Name");
      if (!parsedRegistrationDate) missingFields.push("Registration Date");
      
      let successMessage = `Customer found! All fields auto-filled. Warranty: ${warrantyStatus === "Valid" ? "Yes" : "No"}`;
      if (districtValue) {
        successMessage += `. District: ${districtValue}`;
      } else {
        missingFields.push("District");
      }
      
      if (missingFields.length > 0) {
        toast.warning(`Customer found, but some fields are missing from raw data: ${missingFields.join(", ")}. Please check your imported data.`);
      } else {
        toast.success(successMessage);
      }
    } else {
      toast.error(`Account number "${searchAccountNumber}" not found. Please check the account number or import data first.`);
      setFoundCustomer(null);
    }
  };

  const handleOpenDialog = (caseItem?: MaintenanceCase) => {
    console.log("handleOpenDialog called", { caseItem, isDialogOpen });
    try {
      if (caseItem) {
        setEditingCase(caseItem);
        setFormData({
          accountNumber: caseItem.accountNumber,
          angazaId: caseItem.angazaId || "",
          groupName: (caseItem as any).groupName || "",
          ownerName: (caseItem as any).ownerName || "",
          dateReportedAtSource: new Date(caseItem.dateReportedAtSource),
          dateReceivedAtSC: new Date(caseItem.dateReceivedAtSC),
          registrationDate: caseItem.registrationDate ? new Date(caseItem.registrationDate) : undefined,
          productName: caseItem.productName,
          productType: caseItem.productType,
          productDescription: caseItem.productDescription,
          referenceNumber: caseItem.referenceNumber,
          issue: caseItem.issue,
          issueDetails: caseItem.issueDetails,
          maintenanceStatus: caseItem.maintenanceStatus,
          serviceCenter: caseItem.serviceCenter,
          pickedUpBy: caseItem.pickedUpBy || "",
          pickupDate: caseItem.pickupDate ? new Date(caseItem.pickupDate) : undefined,
          deliveryDate: caseItem.deliveryDate ? new Date(caseItem.deliveryDate) : undefined,
          maintenanceActionTaken: caseItem.maintenanceActionTaken || "",
          selectedTechnicianId: caseItem.technicianId || "",
          selectedDistrict: caseItem.district || ("" as District | ""),
          damagedComponentFee: caseItem.damagedComponentFee || "",
          costPerProductRepaired: caseItem.costPerProductRepaired || "",
          customerAgreedToPay: caseItem.customerAgreedToPay || false,
          sparePartsUsed: caseItem.sparePartsUsed || [],
        });
      } else {
        setEditingCase(null);
        // Pre-select current technician for non-admin users (only if they are a technician)
        const currentTechnician = technicians.find((t) => t.id === userId) || technicians.find((t) => t.username === userEmail);
        setFormData({
          accountNumber: "",
          angazaId: "",
          groupName: "",
          ownerName: "",
          dateReportedAtSource: new Date(),
          dateReceivedAtSC: new Date(),
          registrationDate: undefined,
          productName: "",
          productType: "",
          productDescription: "",
          referenceNumber: "",
          issue: "",
          issueDetails: "",
          maintenanceStatus: "Received",
          serviceCenter: "",
          pickedUpBy: "",
          pickupDate: undefined,
          deliveryDate: undefined,
          maintenanceActionTaken: "",
          selectedTechnicianId: !isAdmin && currentTechnician ? currentTechnician.id : "",
          selectedDistrict: "" as District | "",
          damagedComponentFee: "",
          costPerProductRepaired: "",
          customerAgreedToPay: false,
          sparePartsUsed: [],
        });
        setFoundCustomer(null);
        setSearchAccountNumber("");
        setAvailableProducts([]);
      }
      console.log("Setting isDialogOpen to true");
      setIsDialogOpen(true);
      console.log("Dialog state should be open now");
    } catch (error) {
      console.error("Error opening dialog:", error);
      toast.error("Error opening dialog. Please try again.");
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCase(null);
    setFoundCustomer(null);
    setSearchAccountNumber("");
    setAvailableProducts([]);
  };

  const handleDeleteClick = (caseItem: MaintenanceCase) => {
    setCaseToDelete(caseItem);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!caseToDelete) return;

    try {
      // Get all cases from storage
      const allCases = (await getStorageItem<MaintenanceCase[]>(STORAGE_KEYS.CASES)) || [];
      
      // If case has spare parts used, restore them to inventory
      if (caseToDelete.sparePartsUsed && caseToDelete.sparePartsUsed.length > 0) {
        const currentParts = (await getStorageItem<SparePart[]>(STORAGE_KEYS.SPARE_PARTS)) || [];
        const updatedParts = currentParts.map((part) => {
          const usedPart = caseToDelete.sparePartsUsed.find((up) => up.partId === part.id);
          if (usedPart && usedPart.quantity > 0) {
            // Restore the stock
            return {
              ...part,
              remainingStock: part.remainingStock + usedPart.quantity,
              updatedAt: new Date().toISOString(),
            };
          }
          return part;
        });
        await setStorageItem(STORAGE_KEYS.SPARE_PARTS, updatedParts);
        // Reload spare parts to update state
        await loadSpareParts();
      }

      // Remove the case
      const updatedCases = allCases.filter((c) => c.id !== caseToDelete.id);
      await saveCases(updatedCases);
      
      toast.success("Case deleted successfully");
      setIsDeleteDialogOpen(false);
      setCaseToDelete(null);
      loadCases();
    } catch (error) {
      console.error("Error deleting case:", error);
      toast.error("Failed to delete case. Please try again.");
    }
  };

  const getWarrantyStatus = (): "Valid" | "Expired" => {
    if (!formData.registrationDate) return "Expired";
    return calculateWarrantyStatus(formData.registrationDate.toISOString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.accountNumber || !formData.productName || !formData.referenceNumber) {
      toast.error("Please fill in all required fields");
      return;
    }

    const warrantyStatus = getWarrantyStatus();
    const slaDaysValue = slaInfo.days !== null ? slaInfo.days : undefined;
    const slaStatusValue = slaInfo.days !== null ? slaInfo.statusLabel : undefined;
    const endDate = formData.registrationDate
      ? calculateWarrantyEndDate(formData.registrationDate.toISOString())
      : undefined;

    // Get technician info (only from technicians, not regular users)
    let technicianName: string;
    let technicianId: string;
    // District comes from customer data (formData.selectedDistrict), not from technician
    const district: District = formData.selectedDistrict || "";

    if (formData.selectedTechnicianId) {
      // Technician was selected (by admin or by technician themselves)
      const selectedTech = technicians.find((t) => t.id === formData.selectedTechnicianId);
      technicianName = (selectedTech as any)?.fullName || selectedTech?.username || "Unknown";
      technicianId = formData.selectedTechnicianId;
    } else {
      // Use current user as fallback (only if they are a technician)
      const currentTechnician = technicians.find((t) => t.id === userId) || technicians.find((t) => t.username === userEmail);
      technicianName = (currentTechnician as any)?.fullName || currentTechnician?.username || userEmail || "Unknown";
      technicianId = currentTechnician?.id || userId || "";
    }

    if (editingCase) {
      // Calculate stock difference for updates
      const oldSpareParts = editingCase.sparePartsUsed || [];
      const newSpareParts = formData.sparePartsUsed || [];
      
      // Update existing case
      const updatedCases = cases.map((c) =>
        c.id === editingCase.id
          ? {
              ...c,
              ...formData,
              registrationDate: formData.registrationDate?.toISOString() || "",
              endDate,
              warrantyStatus,
              dateReportedAtSource: formData.dateReportedAtSource.toISOString(),
              dateReceivedAtSC: formData.dateReceivedAtSC.toISOString(),
              pickupDate: formData.pickupDate?.toISOString(),
              deliveryDate: formData.deliveryDate?.toISOString(),
              slaDays: slaDaysValue,
              slaStatus: slaStatusValue,
              slaTargetDays: slaDaysValue !== undefined ? SLA_TARGET_DAYS : c.slaTargetDays,
              district,
              technicianId,
              technicianName,
              damagedComponentFee: formData.damagedComponentFee ? Number(formData.damagedComponentFee) : undefined,
              costPerProductRepaired: formData.costPerProductRepaired ? Number(formData.costPerProductRepaired) : undefined,
              customerAgreedToPay: formData.customerAgreedToPay,
              sparePartsUsed: formData.sparePartsUsed || [],
              updatedAt: new Date().toISOString(),
            }
          : c
      );
      await saveCases(updatedCases);
      
      // Adjust stock based on changes
      // First, restore old stock, then deduct new stock
      const updatedParts = spareParts.map((part) => {
        const oldUsed = oldSpareParts.find((up) => up.partId === part.id)?.quantity || 0;
        const newUsed = newSpareParts.find((up) => up.partId === part.id)?.quantity || 0;
        const difference = newUsed - oldUsed;
        
        if (difference !== 0) {
          // Restore old stock first, then deduct new
          const restoredStock = part.remainingStock + oldUsed;
          const newRemaining = Math.max(0, restoredStock - newUsed);
          return {
            ...part,
            remainingStock: newRemaining,
            updatedAt: new Date().toISOString(),
          };
        }
        return part;
      });
      
      // Only update if there were changes
      if (JSON.stringify(oldSpareParts) !== JSON.stringify(newSpareParts)) {
        await setStorageItem(STORAGE_KEYS.SPARE_PARTS, updatedParts);
        toast.success("Case updated successfully. Stock adjusted.");
      } else {
        toast.success("Case updated successfully");
      }
    } else {
      // Create new case
      const newCase: MaintenanceCase = {
        id: Date.now().toString(),
        accountNumber: formData.accountNumber,
        angazaId: formData.angazaId || undefined,
        dateReportedAtSource: formData.dateReportedAtSource.toISOString(),
        dateReceivedAtSC: formData.dateReceivedAtSC.toISOString(),
        registrationDate: formData.registrationDate?.toISOString() || "",
        endDate,
        productName: formData.productName,
        productType: formData.productType,
        productDescription: formData.productDescription,
        referenceNumber: formData.referenceNumber,
        issue: formData.issue,
        issueDetails: formData.issueDetails,
        maintenanceStatus: formData.maintenanceStatus,
        warrantyStatus,
        technicianId,
        technicianName,
        district,
        serviceCenter: formData.serviceCenter,
        pickedUpBy: formData.pickedUpBy || undefined,
        pickupDate: formData.pickupDate?.toISOString(),
        deliveryDate: formData.deliveryDate?.toISOString(),
        maintenanceActionTaken: formData.maintenanceActionTaken || undefined,
        slaDays: slaDaysValue,
        slaStatus: slaStatusValue,
        slaTargetDays: slaDaysValue !== undefined ? SLA_TARGET_DAYS : undefined,
        damagedComponentFee: formData.damagedComponentFee ? Number(formData.damagedComponentFee) : undefined,
        costPerProductRepaired: formData.costPerProductRepaired ? Number(formData.costPerProductRepaired) : undefined,
        customerAgreedToPay: formData.customerAgreedToPay,
        sparePartsUsed: formData.sparePartsUsed || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userEmail || "",
      };

      const allCases = (await getStorageItem<MaintenanceCase[]>(STORAGE_KEYS.CASES)) || [];
      await saveCases([...allCases, newCase]);
      
      // Deduct spare parts from stock when used
      if (formData.sparePartsUsed && formData.sparePartsUsed.length > 0) {
        const updatedParts = spareParts.map((part) => {
          const usedPart = formData.sparePartsUsed.find((up) => up.partId === part.id);
          if (usedPart && usedPart.quantity > 0) {
            const newRemaining = Math.max(0, part.remainingStock - usedPart.quantity);
            return {
              ...part,
              remainingStock: newRemaining,
              updatedAt: new Date().toISOString(),
            };
          }
          return part;
        });
        await setStorageItem(STORAGE_KEYS.SPARE_PARTS, updatedParts);
        toast.success(`Case created successfully. ${formData.sparePartsUsed.length} spare part(s) deducted from stock.`);
      } else {
        toast.success("Case created successfully");
      }
    }

    handleCloseDialog();
    loadCases();
  };

  const handleAddSparePart = () => {
    if (!selectedPartId) {
      toast.error("Please select a spare part");
      return;
    }
    
    if (!selectedPartQuantity || selectedPartQuantity <= 0) {
      toast.error("Please enter a valid quantity (greater than 0)");
      return;
    }

    const selectedPart = spareParts.find((p) => p.id === selectedPartId);
    if (!selectedPart) {
      toast.error("Part not found. Please refresh and try again.");
      return;
    }

    // Check if part already added in form
    const sparePartsUsed = formData.sparePartsUsed || [];
    const existingIndex = sparePartsUsed.findIndex((up) => up.partId === selectedPartId);
    const alreadyUsedInForm = existingIndex >= 0 ? sparePartsUsed[existingIndex].quantity : 0;
    
    // Calculate available stock (considering what's already in the form)
    // If editing, we need to account for what was already used in the original case
    let availableStock = selectedPart.remainingStock;
    if (editingCase) {
      const originalUsed = editingCase.sparePartsUsed?.find((up) => up.partId === selectedPartId)?.quantity || 0;
      // Add back the original used quantity since we're editing
      availableStock = selectedPart.remainingStock + originalUsed - alreadyUsedInForm;
    } else {
      availableStock = selectedPart.remainingStock - alreadyUsedInForm;
    }

    // Check available stock
    if (availableStock < selectedPartQuantity) {
      toast.error(`Insufficient stock. Only ${availableStock} ${selectedPart.unit} available.`);
      return;
    }

    if (existingIndex >= 0) {
      // Update quantity
      const updated = [...sparePartsUsed];
      updated[existingIndex].quantity += selectedPartQuantity;
      setFormData({ ...formData, sparePartsUsed: updated });
      toast.success(`Added ${selectedPartQuantity} more ${selectedPart.unit}. Total: ${updated[existingIndex].quantity} ${selectedPart.unit}`);
    } else {
      // Add new part
      setFormData({
        ...formData,
        sparePartsUsed: [
          ...sparePartsUsed,
          {
            partId: selectedPartId,
            partName: selectedPart.name,
            quantity: selectedPartQuantity,
          },
        ],
      });
      toast.success(`${selectedPartQuantity} ${selectedPart.unit} of ${selectedPart.name} added`);
    }

    setSelectedPartId("");
    setSelectedPartQuantity(1);
  };

  const handleRemoveSparePart = (partId: string) => {
    setFormData({
      ...formData,
      sparePartsUsed: formData.sparePartsUsed.filter((up) => up.partId !== partId),
    });
    toast.success("Spare part removed");
  };

  const getStatusBadgeVariant = (status: MaintenanceStatus) => {
    if (status === "Delivered") return "default";
    if (status === "Pending") return "secondary";
    return "outline"; // Received
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

  // Filter and paginate cases
  const filteredAndPaginatedCases = useMemo(() => {
    let filtered = cases;

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.accountNumber.toLowerCase().includes(searchLower) ||
          c.referenceNumber.toLowerCase().includes(searchLower) ||
          c.productName.toLowerCase().includes(searchLower) ||
          c.technicianName.toLowerCase().includes(searchLower)
      );
    }

    // Sort by date (newest first)
    filtered = [...filtered].sort((a, b) => {
      const dateA = new Date(a.dateReceivedAtSC).getTime();
      const dateB = new Date(b.dateReceivedAtSC).getTime();
      return dateB - dateA;
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
    };
  }, [cases, searchTerm, currentPage, itemsPerPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-gradient-to-r from-white/80 to-white/40 dark:from-gray-900/80 dark:to-gray-800/40 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50">
          <div>
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
              Maintenance Cases
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1 text-lg">
              Create and manage warranty maintenance cases 📋
            </p>
          </div>
          <Button 
            onClick={() => {
              console.log("New Case button clicked");
              toast.info("Opening case creation dialog...");
              handleOpenDialog();
            }}
            type="button"
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Case
          </Button>
        </div>

        <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5" />
          <CardHeader className="relative z-10 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Cases
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300 mt-1">
                  {isAdmin ? "All maintenance cases" : "Your maintenance cases"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search cases..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200/50 dark:border-gray-700/50 focus:border-emerald-500 dark:focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10 pt-6">
            {cases.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 mb-4">
                  <FileText className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-lg font-medium mb-2">
                  No cases found
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {!isAdmin && "Click 'New Case' to create one."}
                </p>
              </div>
            ) : filteredAndPaginatedCases.paginated.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 mb-4">
                  <Search className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-gray-600 dark:text-gray-300 text-lg font-medium mb-2">
                  No cases match your search criteria
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 font-medium bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-2 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50">
                  Showing {filteredAndPaginatedCases.startIndex} to {filteredAndPaginatedCases.endIndex} of {filteredAndPaginatedCases.total} cases
                </div>
                <div className="border border-gray-200/50 dark:border-gray-700/50 rounded-xl overflow-auto max-h-[70vh] shadow-inner">
                  <Table>
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border-b border-gray-200/50 dark:border-gray-700/50">
                        <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Ref #</TableHead>
                        <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Account #</TableHead>
                        <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Product</TableHead>
                        <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Status</TableHead>
                        <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Warranty</TableHead>
                        <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Technician</TableHead>
                        <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">District</TableHead>
                        <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">Date Received</TableHead>
                        <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">SLA Days</TableHead>
                        <TableHead className="h-10 text-xs font-bold py-3 px-4 text-gray-700 dark:text-gray-200">SLA Calc</TableHead>
                        {isAdmin && <TableHead className="h-10 text-xs font-bold py-3 px-4 text-right text-gray-700 dark:text-gray-200">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndPaginatedCases.paginated.map((caseItem, index) => {
                        const caseSla = getCaseSlaInfo(caseItem);
                        return (
                          <TableRow 
                            key={caseItem.id} 
                            className="hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-teal-50/50 dark:hover:from-emerald-900/10 dark:hover:to-teal-900/10 transition-all duration-200 border-b border-gray-100 dark:border-gray-800"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <TableCell className="py-3 px-4 text-xs font-semibold text-gray-800 dark:text-gray-200">{caseItem.referenceNumber}</TableCell>
                            <TableCell className="py-3 px-4 text-xs text-gray-600 dark:text-gray-400">{caseItem.accountNumber}</TableCell>
                            <TableCell className="py-3 px-4 text-xs font-medium text-gray-700 dark:text-gray-300">{caseItem.productName}</TableCell>
                            <TableCell className="py-3 px-4">
                              <Badge variant={getStatusBadgeVariant(caseItem.maintenanceStatus)} className="text-xs py-1 px-3 shadow-sm">
                                {caseItem.maintenanceStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3 px-4">
                              <Badge
                                className={`text-xs py-1 px-3 shadow-sm ${
                                  caseItem.warrantyStatus === "Valid" 
                                    ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white" 
                                    : "bg-gradient-to-r from-red-500 to-rose-500 text-white"
                                }`}
                              >
                                {caseItem.warrantyStatus === "Valid" ? "Yes" : "No"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3 px-4 text-xs text-gray-600 dark:text-gray-400">{caseItem.technicianName || "-"}</TableCell>
                            <TableCell className="py-3 px-4 text-xs text-gray-600 dark:text-gray-400">{caseItem.district || "-"}</TableCell>
                            <TableCell className="py-3 px-4 text-xs text-gray-600 dark:text-gray-400">
                              {new Date(caseItem.dateReceivedAtSC).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="py-3 px-4 text-xs">
                              {caseSla.days !== null ? (
                                <span className={`font-bold ${caseSla.isWithinTarget ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
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
                            {isAdmin && (
                              <TableCell className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenDialog(caseItem)}
                                    className="h-8 text-xs px-3 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-500 hover:to-cyan-500 hover:text-white border-blue-200 dark:border-blue-800 transition-all duration-200 hover:scale-105 shadow-sm hover:shadow-md"
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteClick(caseItem)}
                                    className="h-8 text-xs px-3 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg"
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {/* Pagination Controls */}
                {filteredAndPaginatedCases.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 p-4 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-xl border border-emerald-200/50 dark:border-emerald-800/50">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Page {currentPage} of {filteredAndPaginatedCases.totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-9 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-gradient-to-r hover:from-emerald-500 hover:to-teal-500 hover:text-white hover:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
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
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md"
                                  : "bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-gradient-to-r hover:from-emerald-500 hover:to-teal-500 hover:text-white hover:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
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
                        className="h-9 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-gradient-to-r hover:from-emerald-500 hover:to-teal-500 hover:text-white hover:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
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

        {/* Create/Edit Case Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          console.log("Dialog onOpenChange called", open);
          setIsDialogOpen(open);
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCase ? "Edit Maintenance Case" : "Create New Maintenance Case"}
              </DialogTitle>
              <DialogDescription>
                {editingCase
                  ? "Update case information and status."
                  : "Search for customer by account number to auto-fill information."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                {/* Account Search */}
                {!editingCase && (
                  <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
                    <Label>Search Customer by Account Number</Label>
                    <div className="flex gap-2">
                      <Input
                        value={searchAccountNumber}
                        onChange={(e) => setSearchAccountNumber(e.target.value)}
                        placeholder="Enter account number to auto-fill customer data"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSearchAccount();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={handleSearchAccount}
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                      >
                        <Search className="mr-2 h-4 w-4" />
                        Search
                      </Button>
                    </div>
                    {foundCustomer && (
                      <div className="mt-2 space-y-3">
                        <div className="p-3 bg-green-50 dark:bg-green-950 rounded text-sm space-y-2">
                          <div className="font-medium text-base">✓ Customer Found - All Information Auto-filled</div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="font-medium">Account Number:</span> {foundCustomer.accountNumber}
                            </div>
                            <div>
                              <span className="font-medium">Angaza ID:</span> {foundCustomer.angazaId || "N/A"}
                            </div>
                            <div>
                              <span className="font-medium">Group Name:</span> {foundCustomer.groupName || "N/A"}
                            </div>
                            <div>
                              <span className="font-medium">Owner Name:</span> {foundCustomer.ownerName || "N/A"}
                            </div>
                            <div>
                              <span className="font-medium">Product:</span> {foundCustomer.productName}
                            </div>
                            {foundCustomer.registrationDate && (
                              <>
                                <div>
                                  <span className="font-medium">Registration Date (UTC):</span> {new Date(foundCustomer.registrationDate).toISOString().split('T')[0]}
                                </div>
                                <div>
                                  <span className="font-medium">Warranty Status:</span>{" "}
                                  <span className={calculateWarrantyStatus(foundCustomer.registrationDate) === "Valid" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                                    {calculateWarrantyStatus(foundCustomer.registrationDate) === "Valid" ? "Yes" : "No"}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        
                      </div>
                    )}
                  </div>
                )}

                {/* Compact Table Layout for Case Details */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableHead className="w-1/3 bg-muted/50">Account Number *</TableHead>
                        <TableCell>
                          <Input
                            id="accountNumber"
                            value={formData.accountNumber}
                            onChange={(e) =>
                              setFormData({ ...formData, accountNumber: e.target.value })
                            }
                            required
                            className="h-8"
                          />
                        </TableCell>
                        <TableHead className="w-1/3 bg-muted/50">Angaza ID</TableHead>
                        <TableCell>
                          <Input
                            id="angazaId"
                            value={formData.angazaId}
                            onChange={(e) =>
                              setFormData({ ...formData, angazaId: e.target.value })
                            }
                            className="h-8"
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableHead className="bg-muted/50">Group Name</TableHead>
                        <TableCell>
                          <Input
                            id="groupName"
                            value={formData.groupName}
                            onChange={(e) =>
                              setFormData({ ...formData, groupName: e.target.value })
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableHead className="bg-muted/50">Owner Name</TableHead>
                        <TableCell>
                          <Input
                            id="ownerName"
                            value={formData.ownerName}
                            onChange={(e) =>
                              setFormData({ ...formData, ownerName: e.target.value })
                            }
                            className="h-8"
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableHead className="bg-muted/50">Date Reported at Source *</TableHead>
                        <TableCell>
                          <DatePicker
                            date={formData.dateReportedAtSource}
                            onSelect={(date) =>
                              setFormData({ ...formData, dateReportedAtSource: date || new Date() })
                            }
                          />
                        </TableCell>
                        <TableHead className="bg-muted/50">Date Received @ SC *</TableHead>
                        <TableCell>
                          <div className="space-y-1">
                            <DatePicker
                              date={formData.dateReceivedAtSC}
                              onSelect={(date) =>
                                setFormData({ ...formData, dateReceivedAtSC: date || new Date() })
                              }
                            />
                            {formData.dateReceivedAtSC && (
                              <div className="text-xs text-muted-foreground">
                                Days with us:{" "}
                                <span className="font-semibold">
                                  {Math.max(0, differenceInCalendarDays(new Date(), formData.dateReceivedAtSC))}
                                </span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableHead className="bg-muted/50">Reference Number *</TableHead>
                        <TableCell colSpan={3}>
                          <Input
                            id="referenceNumber"
                            value={formData.referenceNumber}
                            onChange={(e) =>
                              setFormData({ ...formData, referenceNumber: e.target.value })
                            }
                            required
                            className="h-8"
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableHead className="bg-muted/50">Registration Date</TableHead>
                        <TableCell>
                          <DatePicker
                            date={formData.registrationDate}
                            onSelect={(date) =>
                              setFormData({ ...formData, registrationDate: date })
                            }
                          />
                        </TableCell>
                        <TableHead className="bg-muted/50">Warranty Status</TableHead>
                        <TableCell>
                          <Input
                            value={
                              formData.registrationDate
                                ? (getWarrantyStatus() === "Valid" ? "Yes" : "No")
                                : "No"
                            }
                            disabled
                            className="bg-muted font-semibold h-8 text-xs"
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableHead className="bg-muted/50">Product Name *</TableHead>
                        <TableCell colSpan={3}>
                          <Input
                            id="productName"
                            value={formData.productName}
                            onChange={(e) =>
                              setFormData({ ...formData, productName: e.target.value })
                            }
                            required
                            className="h-8"
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableHead className="bg-muted/50">Customer Location</TableHead>
                        <TableCell colSpan={3}>
                          <Textarea
                            id="productDescription"
                            value={formData.productDescription}
                            onChange={(e) =>
                              setFormData({ ...formData, productDescription: e.target.value })
                            }
                            placeholder="Enter customer location"
                            rows={2}
                            className="resize-none"
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableHead className="bg-muted/50">Issue Details Standardized</TableHead>
                        <TableCell colSpan={3}>
                          <Select
                            value={formData.issueDetails}
                            onValueChange={(value) =>
                              setFormData({ ...formData, issueDetails: value })
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select issue details" />
                            </SelectTrigger>
                            <SelectContent>
                              {standardizedIssueDetails.length > 0 ? (
                                standardizedIssueDetails.map((issue) => (
                                  <SelectItem key={issue} value={issue}>
                                    {issue}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>
                                  No issue details available. Admin can add them in Settings.
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableHead className="bg-muted/50">Maintenance Status</TableHead>
                        <TableCell>
                          <Select
                            value={formData.maintenanceStatus}
                            onValueChange={(value: MaintenanceStatus) =>
                              setFormData({ ...formData, maintenanceStatus: value })
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MAINTENANCE_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableHead className="bg-muted/50">Service Center</TableHead>
                        <TableCell>
                          <Input
                            id="serviceCenter"
                            value={formData.serviceCenter}
                            onChange={(e) =>
                              setFormData({ ...formData, serviceCenter: e.target.value })
                            }
                            className="h-8"
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableHead className="bg-muted/50">District (Auto-filled from Customer)</TableHead>
                        <TableCell colSpan={3}>
                          <Input
                            id="selectedDistrict"
                            value={formData.selectedDistrict}
                            onChange={(e) =>
                              setFormData({ ...formData, selectedDistrict: e.target.value as District })
                            }
                            className="h-8"
                            placeholder="District will be auto-filled when customer is searched"
                          />
                        </TableCell>
                      </TableRow>
                      {!editingCase && (
                        <TableRow>
                          <TableHead className="bg-muted/50">
                            {isAdmin ? "Assign Technician" : "Select Technician"}
                          </TableHead>
                          <TableCell colSpan={3}>
                            <Select
                              value={
                                formData.selectedTechnicianId ||
                                (isAdmin
                                  ? "none"
                                  : (
                                      technicians.find((t) => t.id === userId)?.id ||
                                      technicians.find((t) => t.username === userEmail)?.id ||
                                      ""
                                    ))
                              }
                              onValueChange={(value) => {
                                const selectedTechId = value === "none" ? "" : value;
                                const selectedTech = technicians.find((t) => t.id === selectedTechId);
                                setFormData((prev) => ({
                                  ...prev,
                                  selectedTechnicianId: selectedTechId,
                                  serviceCenter:
                                    selectedTech?.serviceCenter?.trim() !== ""
                                      ? selectedTech.serviceCenter
                                      : prev.serviceCenter,
                                }));
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select technician" />
                              </SelectTrigger>
                              <SelectContent>
                                {isAdmin && <SelectItem value="none">No Assignment</SelectItem>}
                                {technicians.length === 0 ? (
                                  <SelectItem value="no-technicians" disabled>
                                    No technicians available. Please add technicians first.
                                  </SelectItem>
                                ) : (
                                  (isAdmin
                                    ? technicians
                                    : technicians.filter((t) => t.id === userId || t.username === userEmail)
                                  ).map((technician) => {
                                    const name = (technician as any).fullName || technician.username;
                                    const serviceCenter = (technician as any).serviceCenter || "";
                                    return (
                                      <SelectItem key={technician.id} value={technician.id}>
                                        {name}{serviceCenter ? ` - ${serviceCenter}` : ""}{technician.district ? ` (${technician.district})` : ""}
                                      </SelectItem>
                                    );
                                  })
                                )}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow>
                        <TableHead className="bg-muted/50">Picked Up By</TableHead>
                        <TableCell>
                          <Input
                            id="pickedUpBy"
                            value={formData.pickedUpBy}
                            onChange={(e) =>
                              setFormData({ ...formData, pickedUpBy: e.target.value })
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableHead className="bg-muted/50">Pickup Date</TableHead>
                        <TableCell>
                          <DatePicker
                            date={formData.pickupDate}
                            onSelect={(date) =>
                              setFormData({ ...formData, pickupDate: date })
                            }
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableHead className="bg-muted/50">Delivery Date</TableHead>
                        <TableCell colSpan={3}>
                          <DatePicker
                            date={formData.deliveryDate}
                            onSelect={(date) =>
                              setFormData({ ...formData, deliveryDate: date })
                            }
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableHead className="bg-muted/50">SLA Days (Target: {SLA_TARGET_DAYS})</TableHead>
                        <TableCell>
                          <Input
                            value={slaInfo.days !== null ? String(slaInfo.days) : ""}
                            readOnly
                            disabled
                            className={`h-8 font-semibold ${
                              slaInfo.days !== null
                                ? slaInfo.isWithinTarget
                                  ? "text-green-600"
                                  : "text-red-600"
                                : ""
                            }`}
                            placeholder="--"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Automatically calculated from the day we received the product. It must be within 14 days.
                          </p>
                        </TableCell>
                        <TableHead className="bg-muted/50">SLA Calc</TableHead>
                        <TableCell>
                          <Input
                            value={formData.dateReceivedAtSC ? slaInfo.statusLabel : "Waiting for Date Received"}
                            readOnly
                            disabled
                            className={`h-8 font-semibold ${
                              formData.dateReceivedAtSC
                                ? slaInfo.isWithinTarget
                                  ? "text-green-600"
                                  : "text-red-600"
                                : ""
                            }`}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {formData.dateReceivedAtSC
                              ? `${slaInfo.helperText}. Target is ${SLA_TARGET_DAYS} days from receipt.`
                              : "Select the received date to start the SLA timer (14 days)."}
                          </p>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableHead className="bg-muted/50">Maintenance Action Taken</TableHead>
                        <TableCell colSpan={3}>
                          <Textarea
                            id="maintenanceActionTaken"
                            value={formData.maintenanceActionTaken}
                            onChange={(e) =>
                              setFormData({ ...formData, maintenanceActionTaken: e.target.value })
                            }
                            rows={2}
                            className="resize-none"
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableHead className="bg-muted/50">Damaged Component Fee?</TableHead>
                        <TableCell>
                          <Input
                            id="damagedComponentFee"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.damagedComponentFee}
                            onChange={(e) =>
                              setFormData({ ...formData, damagedComponentFee: e.target.value ? Number(e.target.value) : "" })
                            }
                            className="h-8"
                            placeholder="0.00"
                          />
                        </TableCell>
                        <TableHead className="bg-muted/50">Cost per Product Repaired</TableHead>
                        <TableCell>
                          <Input
                            id="costPerProductRepaired"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.costPerProductRepaired}
                            onChange={(e) =>
                              setFormData({ ...formData, costPerProductRepaired: e.target.value ? Number(e.target.value) : "" })
                            }
                            className="h-8"
                            placeholder="0.00"
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableHead className="bg-muted/50">Has customer agreed to pay?</TableHead>
                        <TableCell colSpan={3}>
                          <Select
                            value={formData.customerAgreedToPay ? "yes" : "no"}
                            onValueChange={(value) =>
                              setFormData({ ...formData, customerAgreedToPay: value === "yes" })
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no">No</SelectItem>
                              <SelectItem value="yes">Yes</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableHead className="bg-muted/50" colSpan={4}>
                          Spare Parts Used
                        </TableHead>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={4} className="p-4">
                          <div className="space-y-4">
                            {/* Add Spare Part */}
                            <div className="grid grid-cols-3 gap-2">
                              <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select spare part" />
                                </SelectTrigger>
                                <SelectContent>
                                  {spareParts.length === 0 ? (
                                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                      No spare parts available. Add parts in Spare Parts page first.
                                    </div>
                                  ) : (
                                    spareParts.map((part) => {
                                      // Calculate available stock considering form and editing
                                      let availableStock = part.remainingStock;
                                      if (editingCase) {
                                        const originalUsed = editingCase.sparePartsUsed?.find((up) => up.partId === part.id)?.quantity || 0;
                                        const alreadyInForm = (formData.sparePartsUsed || []).find((up) => up.partId === part.id)?.quantity || 0;
                                        availableStock = part.remainingStock + originalUsed - alreadyInForm;
                                      } else {
                                        const alreadyInForm = (formData.sparePartsUsed || []).find((up) => up.partId === part.id)?.quantity || 0;
                                        availableStock = part.remainingStock - alreadyInForm;
                                      }
                                      
                                      return (
                                        <SelectItem key={part.id} value={part.id} disabled={availableStock <= 0}>
                                          {part.name} ({availableStock > 0 ? `${availableStock} ${part.unit} available` : 'Out of stock'})
                                        </SelectItem>
                                      );
                                    })
                                  )}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                min="1"
                                value={selectedPartQuantity}
                                onChange={(e) => setSelectedPartQuantity(parseInt(e.target.value) || 1)}
                                placeholder="Quantity"
                                className="h-8"
                              />
                              <Button
                                type="button"
                                onClick={handleAddSparePart}
                                className="h-8 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                                disabled={!selectedPartId}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Part
                              </Button>
                            </div>
                            
                            {/* List of Used Parts */}
                            {(formData.sparePartsUsed || []).length > 0 && (
                              <div className="border rounded-lg">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/30">
                                      <TableHead className="h-8 text-xs py-1 px-2">Part Name</TableHead>
                                      <TableHead className="h-8 text-xs py-1 px-2">Quantity</TableHead>
                                      <TableHead className="h-8 text-xs py-1 px-2 text-right">Action</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {(formData.sparePartsUsed || []).map((usedPart) => {
                                      const part = spareParts.find((p) => p.id === usedPart.partId);
                                      return (
                                        <TableRow key={usedPart.partId} className="hover:bg-muted/20">
                                          <TableCell className="py-1 px-2 text-xs">
                                            {usedPart.partName}
                                          </TableCell>
                                          <TableCell className="py-1 px-2 text-xs">
                                            {usedPart.quantity} {part?.unit || ""}
                                          </TableCell>
                                          <TableCell className="py-1 px-2 text-right">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleRemoveSparePart(usedPart.partId)}
                                              className="h-6 w-6 p-0"
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                            {(formData.sparePartsUsed || []).length === 0 && (
                              <div className="text-center py-4">
                                <p className="text-xs text-muted-foreground">
                                  No spare parts added yet.
                                </p>
                                {spareParts.length === 0 && (
                                  <p className="text-xs text-destructive mt-1">
                                    No spare parts available in inventory. Please add spare parts first.
                                  </p>
                                )}
                                {spareParts.length > 0 && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Select a part and quantity above to add.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  className="hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                >
                  {editingCase ? "Update Case" : "Create Case"}
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
                This action cannot be undone. This will permanently delete the maintenance case
                {caseToDelete && (
                  <>
                    {" "}for reference number <strong>{caseToDelete.referenceNumber}</strong> (Account: {caseToDelete.accountNumber}).
                  </>
                )}
                {caseToDelete?.sparePartsUsed && caseToDelete.sparePartsUsed.length > 0 && (
                  <span className="block mt-2 text-amber-600 dark:text-amber-400">
                    Note: Any spare parts used in this case will be restored to inventory.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCaseToDelete(null)}>Cancel</AlertDialogCancel>
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

export default Cases;
