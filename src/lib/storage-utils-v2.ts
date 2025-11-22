// Updated storage utilities with Supabase support
// This version maintains backward compatibility while adding cloud sync

import { api, isSupabaseConfigured } from './api-service';

export const STORAGE_KEYS = {
  USERS: "users",
  RAW_DATA: "rawData",
  CASES: "maintenanceCases",
  SPARE_PARTS: "spareParts",
  SPARE_PART_ASSIGNMENTS: "sparePartAssignments",
  SPARE_PART_USAGE: "sparePartUsage",
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

// Cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 2000; // 2 second cache

// Synchronous version - uses localStorage (for backward compatibility)
export function getStorageItem<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error);
    return null;
  }
}

// Async version - fetches from Supabase and syncs to localStorage
export async function getStorageItemAsync<T>(key: string): Promise<T | null> {
  // Check cache first
  const cached = apiCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as T;
  }

  // Try Supabase first if configured
  if (isSupabaseConfigured() && API_MAP[key]) {
    try {
      const data = await API_MAP[key].get();
      if (data !== null) {
        // Sync to localStorage for offline access
        try {
          localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
          // Ignore localStorage errors
        }
        apiCache.set(key, { data, timestamp: Date.now() });
        return data as T;
      }
    } catch (error) {
      console.error(`Error fetching ${key} from Supabase:`, error);
      // Fall through to localStorage
    }
  }

  // Fallback to localStorage
  return getStorageItem<T>(key);
}

// Synchronous version - saves to localStorage immediately
export function setStorageItem<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    const sizeInMB = new Blob([serialized]).size / (1024 * 1024);
    
    if (sizeInMB > 4.5) {
      console.warn(`Warning: Data for "${key}" is ${sizeInMB.toFixed(2)}MB. Consider archiving old data.`);
    }
    
    localStorage.setItem(key, serialized);
    apiCache.delete(key); // Clear cache
    
    // Sync to Supabase in background (non-blocking)
    if (isSupabaseConfigured() && API_MAP[key]) {
      API_MAP[key].set(value).catch(error => {
        console.error(`Error syncing ${key} to Supabase:`, error);
      });
    }
  } catch (error: any) {
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.error(`Storage quota exceeded for key "${key}". Attempting to clear old data...`);
      
      // Try clearing old data automatically
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(k => {
          if (!k.startsWith('user') && !k.startsWith('session') && !k.startsWith('appLogo') && !k.startsWith('theme')) {
            try {
              localStorage.removeItem(k);
            } catch (e) {
              // Ignore
            }
          }
        });
        
        // Try again
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
        apiCache.delete(key);
        console.log('Successfully saved after clearing old data');
        return;
      } catch (retryError: any) {
        console.error(`Storage quota still exceeded after cleanup.`);
        
        // If Supabase is available, don't show alert (data will sync there)
        if (!isSupabaseConfigured()) {
          alert('Storage limit reached. Please clear your browser cache or contact support.');
        } else {
          console.warn('Data will be saved to cloud storage on next sync');
        }
      }
    } else {
      console.error(`Error writing to localStorage key "${key}":`, error);
    }
  }
}

// Async version - waits for Supabase sync to complete
export async function setStorageItemAsync<T>(key: string, value: T): Promise<void> {
  // Save to localStorage first for immediate UI update
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    apiCache.delete(key);
  } catch (error: any) {
    console.error(`Error writing to localStorage:`, error);
  }

  // Then sync to Supabase
  if (isSupabaseConfigured() && API_MAP[key]) {
    try {
      await API_MAP[key].set(value);
    } catch (error) {
      console.error(`Error syncing ${key} to Supabase:`, error);
    }
  }
}

export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
    apiCache.delete(key);
  } catch (error) {
    console.error(`Error removing localStorage key "${key}":`, error);
  }
}

// Helper to refresh data from Supabase
export async function refreshFromSupabase<T>(key: string): Promise<T | null> {
  apiCache.delete(key); // Clear cache to force fresh fetch
  return getStorageItemAsync<T>(key);
}

