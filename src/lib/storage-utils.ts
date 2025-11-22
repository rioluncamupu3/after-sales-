// Utility functions for data management
// Uses Supabase API when available, falls back to localStorage

import { api } from './api-service';
import { isSupabaseConfigured } from './supabase-client';

export const STORAGE_KEYS = {
  USERS: "users",
  RAW_DATA: "rawData",
  CASES: "maintenanceCases",
  SPARE_PARTS: "spareParts",
  SPARE_PART_ASSIGNMENTS: "sparePartAssignments",
  SPARE_PART_USAGE: "sparePartUsage",
  STANDARDIZED_ISSUE_DETAILS: "standardizedIssueDetails",
} as const;

// Map storage keys to API functions
const API_MAP: Record<string, { get: () => Promise<any>, set: (value: any) => Promise<void> }> = {
  [STORAGE_KEYS.USERS]: {
    get: () => api.getUsers(),
    set: (value) => api.setUsers(value),
  },
  [STORAGE_KEYS.RAW_DATA]: {
    get: () => api.getRawData(),
    set: (value) => api.setRawData(value),
  },
  [STORAGE_KEYS.CASES]: {
    get: () => api.getCases(),
    set: (value) => api.setCases(value),
  },
  [STORAGE_KEYS.SPARE_PARTS]: {
    get: () => api.getSpareParts(),
    set: (value) => api.setSpareParts(value),
  },
};

// Cache for API responses to avoid repeated calls
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 1000; // 1 second cache

export async function getStorageItem<T>(key: string): Promise<T | null> {
  // Check cache first
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }

  // Try API first if configured
  if (isSupabaseConfigured() && API_MAP[key]) {
    try {
      const data = await API_MAP[key].get();
      apiCache.set(key, { data, timestamp: Date.now() });
      return data as T;
    } catch (error) {
      console.error(`Error fetching ${key} from API:`, error);
      // Fall through to localStorage
    }
  }

  // Fallback to localStorage
  try {
    const item = localStorage.getItem(key);
    const parsed = item ? JSON.parse(item) : null;
    apiCache.set(key, { data: parsed, timestamp: Date.now() });
    return parsed as T;
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error);
    return null;
  }
}

// Synchronous version for backward compatibility (uses localStorage only)
export function getStorageItemSync<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error);
    return null;
  }
}

export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  // Clear cache
  apiCache.delete(key);

  // Always save to localStorage first for immediate UI update
  try {
    const serialized = JSON.stringify(value);
    const sizeInMB = new Blob([serialized]).size / (1024 * 1024);
    
    if (sizeInMB > 4.5) {
      console.warn(`Warning: Data for "${key}" is ${sizeInMB.toFixed(2)}MB. Consider archiving old data.`);
    }
    
    localStorage.setItem(key, serialized);
    apiCache.set(key, { data: value, timestamp: Date.now() });
  } catch (error: any) {
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.error(`Storage quota exceeded for key "${key}". Data size may be too large.`);
      alert('Storage limit reached. Please archive or delete old data to continue.');
    } else {
      console.error(`Error writing to localStorage key "${key}":`, error);
    }
  }

  // Then sync to Supabase in the background (non-blocking)
  if (isSupabaseConfigured() && API_MAP[key]) {
    try {
      await API_MAP[key].set(value);
    } catch (error) {
      console.error(`Error syncing ${key} to Supabase:`, error);
      // Continue anyway - data is saved locally
    }
  }
}

// Synchronous version for backward compatibility
export function setStorageItemSync<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    const sizeInMB = new Blob([serialized]).size / (1024 * 1024);
    
    if (sizeInMB > 4.5) {
      console.warn(`Warning: Data for "${key}" is ${sizeInMB.toFixed(2)}MB. Consider archiving old data.`);
    }
    
    localStorage.setItem(key, serialized);
    apiCache.delete(key);
  } catch (error: any) {
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.error(`Storage quota exceeded for key "${key}". Data size may be too large.`);
      alert('Storage limit reached. Please archive or delete old data to continue.');
    } else {
      console.error(`Error writing to localStorage key "${key}":`, error);
    }
  }
}

export async function removeStorageItem(key: string): Promise<void> {
  apiCache.delete(key);
  
  // Try API if configured
  if (isSupabaseConfigured() && API_MAP[key]) {
    // For now, just clear localStorage
    // You can add API delete logic here if needed
  }
  
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing localStorage key "${key}":`, error);
  }
}

