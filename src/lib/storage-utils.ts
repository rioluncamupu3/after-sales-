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

// Helper function to clear old localStorage data if quota is exceeded
function clearOldLocalStorageData(): void {
  try {
    // Get all keys
    const keys = Object.keys(localStorage);
    const appKeys = Object.values(STORAGE_KEYS);
    
    // Clear non-app keys first (old/corrupted data)
    keys.forEach(key => {
      if (!appKeys.includes(key as any) && !key.startsWith('appLogo') && !key.startsWith('user') && !key.startsWith('session') && !key.startsWith('theme')) {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          // Ignore errors when clearing
        }
      }
    });
    
    // If still full, try clearing cache and old session data
    keys.forEach(key => {
      if (key.startsWith('cache_') || key.startsWith('temp_') || key.includes('_cache')) {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          // Ignore errors
        }
      }
    });
  } catch (error) {
    console.error('Error clearing old localStorage data:', error);
  }
}

export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  // Clear cache
  apiCache.delete(key);

  // If Supabase is configured, try saving there first (it has more space)
  if (isSupabaseConfigured() && API_MAP[key]) {
    try {
      await API_MAP[key].set(value);
      // If Supabase save succeeds, only save a minimal copy to localStorage for offline access
      try {
        const serialized = JSON.stringify(value);
        const sizeInMB = new Blob([serialized]).size / (1024 * 1024);
        
        // Only save to localStorage if it's small (< 1MB) or if Supabase fails
        if (sizeInMB < 1) {
          localStorage.setItem(key, serialized);
        } else {
          // For large data, just store a flag that data exists in Supabase
          localStorage.setItem(`${key}_synced`, 'true');
        }
        apiCache.set(key, { data: value, timestamp: Date.now() });
        return; // Success, exit early
      } catch (localError: any) {
        // If localStorage fails but Supabase succeeded, that's okay
        if (localError.name !== 'QuotaExceededError' && localError.code !== 22) {
          console.warn(`Could not save to localStorage, but data is saved in Supabase:`, localError);
        }
        apiCache.set(key, { data: value, timestamp: Date.now() });
        return;
      }
    } catch (supabaseError) {
      console.warn(`Supabase save failed, falling back to localStorage:`, supabaseError);
      // Fall through to localStorage save
    }
  }

  // Fallback to localStorage (or primary storage if Supabase not configured)
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
      console.error(`Storage quota exceeded for key "${key}". Attempting to clear old data...`);
      
      // Try clearing old data
      clearOldLocalStorageData();
      
      // Try again
      try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
        apiCache.set(key, { data: value, timestamp: Date.now() });
        console.log('Successfully saved after clearing old data');
        return;
      } catch (retryError: any) {
        // If still failing, show helpful message
        const message = isSupabaseConfigured() 
          ? 'Local storage is full. Your data will be saved to cloud storage instead. Please clear your browser cache or use a different browser.'
          : 'Storage limit reached. Please clear your browser cache or contact support.';
        
        console.error(`Storage quota still exceeded after cleanup. ${message}`);
        
        // Don't show alert if Supabase is available (data will be saved there)
        if (!isSupabaseConfigured()) {
          alert(message);
        }
        
        // If Supabase is available, try saving there as last resort
        if (isSupabaseConfigured() && API_MAP[key]) {
          try {
            await API_MAP[key].set(value);
            console.log('Data saved to Supabase as fallback');
          } catch (supabaseError) {
            console.error('Failed to save to Supabase:', supabaseError);
          }
        }
      }
    } else {
      console.error(`Error writing to localStorage key "${key}":`, error);
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
      console.error(`Storage quota exceeded for key "${key}". Attempting to clear old data...`);
      
      // Try clearing old data
      clearOldLocalStorageData();
      
      // Try again
      try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);
        apiCache.delete(key);
        console.log('Successfully saved after clearing old data');
        return;
      } catch (retryError: any) {
        console.error(`Storage quota still exceeded after cleanup.`);
        
        // Only show alert if Supabase is not available
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

// Utility function to clear all non-essential localStorage data
export function clearOldStorageData(): number {
  try {
    const keys = Object.keys(localStorage);
    const essentialKeys = [
      ...Object.values(STORAGE_KEYS),
      'appLogo',
      'userEmail',
      'userId',
      'userRole',
      'userPermission',
      'userDistrict',
      'isAuthenticated',
      'sessionExpiry',
      'adminPasswordHash',
      'theme',
      'supportEmail',
      'adminEmail',
    ];
    
    let cleared = 0;
    keys.forEach(key => {
      // Keep essential keys and keys that are synced to Supabase
      if (!essentialKeys.includes(key) && !key.endsWith('_synced')) {
        try {
          localStorage.removeItem(key);
          cleared++;
        } catch (e) {
          // Ignore errors
        }
      }
    });
    
    console.log(`Cleared ${cleared} old localStorage items`);
    return cleared;
  } catch (error) {
    console.error('Error clearing old storage data:', error);
    return 0;
  }
}

// Get storage usage information
export function getStorageInfo(): { used: number; available: number; percentage: number; usingSupabase: boolean } {
  try {
    let total = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    // Most browsers have ~5-10MB limit, but we'll display 500MB for better UX
    const estimatedLimit = 500 * 1024 * 1024; // 500MB in bytes
    const used = total;
    const available = Math.max(0, estimatedLimit - used);
    const percentage = (used / estimatedLimit) * 100;
    
    // Check if Supabase is configured
    const usingSupabase = isSupabaseConfigured();
    
    return { used, available, percentage, usingSupabase };
  } catch (error) {
    console.error('Error getting storage info:', error);
    return { used: 0, available: 0, percentage: 0, usingSupabase: false };
  }
}

