// Data Models for After-Sales Tracking System

export type UserRole = "admin" | "user";
export type UserPermission = "admin" | "view" | "editor";
export type District = string;
export type WarrantyStatus = "Valid" | "Expired";
export type MaintenanceStatus = 
  | "Received"
  | "Pending"
  | "Delivered";

export interface User {
  id: string;
  username: string;
  password: string;
  permission: UserPermission;
  district?: District;
  createdAt: string;
}

export interface RawData {
  id: string;
  accountNumber: string;
  angazaId?: string;
  groupName?: string;
  ownerName?: string;
  productName: string;
  productType: string;
  productDescription: string;
  registrationDate: string;
  district?: District;
  importedAt: string;
}

export interface SparePart {
  id: string;
  name: string;
  description?: string;
  totalStock: number;
  remainingStock: number;
  unit: string;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface SparePartAssignment {
  id: string;
  partId: string;
  technicianId: string;
  quantity: number;
  assignedAt: string;
  usedQuantity?: number;
}

export interface SparePartUsage {
  id: string;
  caseId: string;
  partId: string;
  quantity: number;
  usedAt: string;
}

export type SlaStatus = "Within SLA" | "Exceeded SLA";

export interface MaintenanceCase {
  id: string;
  // Account Information
  accountNumber: string;
  angazaId?: string;
  
  // Dates
  dateReportedAtSource: string;
  dateReceivedAtSC: string;
  registrationDate: string;
  endDate?: string;
  pickupDate?: string;
  deliveryDate?: string;
  
  // Product Information
  productName: string;
  productType: string;
  productDescription: string;
  
  // Case Details
  referenceNumber: string;
  issue: string;
  issueDetails: string;
  maintenanceActionTaken?: string;
  slaDays?: number;
  slaStatus?: SlaStatus | string;
  slaTargetDays?: number;
  
  // Status
  maintenanceStatus: MaintenanceStatus;
  warrantyStatus: WarrantyStatus;
  
  // Assignment
  technicianId: string;
  technicianName: string;
  district: District;
  serviceCenter: string;
  pickedUpBy?: string;
  
  // Financial Information
  damagedComponentFee?: number;
  costPerProductRepaired?: number;
  customerAgreedToPay?: boolean;
  
  // Spare Parts
  sparePartsUsed: Array<{
    partId: string;
    partName: string;
    quantity: number;
  }>;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

