import { WarrantyStatus } from "./data-models";

/**
 * Calculate warranty status based on registration date
 * Warranty is valid for 2 years (24 months) from registration date
 */
export function calculateWarrantyStatus(registrationDate: string): WarrantyStatus {
  const regDate = new Date(registrationDate);
  const today = new Date();
  
  // Calculate difference in months
  const monthsDiff = (today.getFullYear() - regDate.getFullYear()) * 12 + 
                     (today.getMonth() - regDate.getMonth());
  
  // Also consider days for more accurate calculation
  const daysDiff = Math.floor((today.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24));
  const monthsDiffExact = daysDiff / 30.44; // Average days per month
  
  if (monthsDiffExact <= 24) {
    return "Valid";
  }
  
  return "Expired";
}

/**
 * Calculate warranty end date (2 years from registration)
 */
export function calculateWarrantyEndDate(registrationDate: string): string {
  const regDate = new Date(registrationDate);
  const endDate = new Date(regDate);
  endDate.setFullYear(endDate.getFullYear() + 2);
  return endDate.toISOString().split('T')[0];
}

/**
 * Get days remaining in warranty (if valid)
 */
export function getWarrantyDaysRemaining(registrationDate: string): number | null {
  const status = calculateWarrantyStatus(registrationDate);
  if (status === "Expired") {
    return null;
  }
  
  const regDate = new Date(registrationDate);
  const endDate = new Date(regDate);
  endDate.setFullYear(endDate.getFullYear() + 2);
  
  const today = new Date();
  const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysRemaining > 0 ? daysRemaining : 0;
}

