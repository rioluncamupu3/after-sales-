// API service layer that uses Supabase when available, falls back to localStorage
import { supabase, isSupabaseConfigured } from './supabase-client';

// Helper function to read from localStorage (to avoid circular dependency)
function getLocalStorageItem<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error);
    return null;
  }
}

// Helper function to write to localStorage (to avoid circular dependency)
function setLocalStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error: any) {
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.error(`Storage quota exceeded for key "${key}". Data size may be too large.`);
    } else {
      console.error(`Error writing to localStorage key "${key}":`, error);
    }
  }
}

// Map storage keys (camelCase) to Supabase table names (snake_case)
function getSupabaseTableName(storageKey: string): string {
  const tableMap: Record<string, string> = {
    'users': 'users',
    'rawData': 'raw_data',
    'maintenanceCases': 'maintenance_cases',
    'spareParts': 'spare_parts',
    'sparePartAssignments': 'spare_part_assignments',
    'sparePartUsage': 'spare_part_usage',
  };
  return tableMap[storageKey] || storageKey;
}

// Convert camelCase object keys to snake_case for Supabase
function toSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (typeof obj !== 'object') return obj;
  
  const snakeObj: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    snakeObj[snakeKey] = toSnakeCase(value);
  }
  return snakeObj;
}

// Convert snake_case object keys to camelCase from Supabase
function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (typeof obj !== 'object') return obj;
  
  const camelObj: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    camelObj[camelKey] = toCamelCase(value);
  }
  return camelObj;
}

// Generic API functions that work with both Supabase and localStorage
export async function apiGet<T>(tableName: string): Promise<T | null> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const supabaseTableName = getSupabaseTableName(tableName);
      
      // Determine the order column based on table name
      // raw_data uses imported_at, others use created_at
      const orderColumn = supabaseTableName === 'raw_data' ? 'imported_at' : 'created_at';
      
      const { data, error } = await supabase
        .from(supabaseTableName)
        .select('*')
        .order(orderColumn, { ascending: false });
      
      if (error) {
        console.error(`Error fetching ${tableName} from Supabase:`, error);
        // If it's an auth error, log it clearly
        if (error.message?.includes('JWT') || error.message?.includes('authentication')) {
          console.error('Supabase authentication error. Please check your VITE_SUPABASE_ANON_KEY in environment variables.');
          console.error('Expected Supabase URL format: https://xxxxx.supabase.co');
        }
        // Fallback to localStorage
        return getLocalStorageItem<T>(tableName);
      }
      
      // Convert snake_case to camelCase
      const camelData = toCamelCase(data);
      return camelData as T;
    } catch (error: any) {
      console.error(`Error fetching ${tableName}:`, error);
      // Log the actual error details
      if (error?.message) {
        console.error('Error details:', error.message);
      }
      return getLocalStorageItem<T>(tableName);
    }
  }
  
  // Fallback to localStorage
  return getLocalStorageItem<T>(tableName);
}

export async function apiSet<T>(tableName: string, data: T): Promise<void> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const supabaseTableName = getSupabaseTableName(tableName);
      // For arrays, we need to handle them differently
      if (Array.isArray(data)) {
        if (data.length > 0) {
          // Convert camelCase to snake_case before upserting
          const snakeData = toSnakeCase(data);
          
          // Use upsert instead of delete + insert to prevent data loss
          // This will update existing records (by id) and insert new ones
          // Much safer: if upsert fails, existing data remains intact
          const { error: upsertError } = await supabase
            .from(supabaseTableName)
            .upsert(snakeData, { 
              onConflict: 'id', // Use id as the conflict resolution key
              ignoreDuplicates: false // Update existing records instead of ignoring
            });
          
          if (upsertError) {
            console.error(`Error upserting ${tableName}:`, upsertError);
            // Fallback to localStorage - but don't delete existing Supabase data
            setLocalStorageItem(tableName, data);
            throw upsertError; // Re-throw to let caller know it failed
          } else {
            console.log(`Successfully upserted ${data.length} records to ${supabaseTableName}`);
          }
        }
      } else {
        // For single objects, upsert
        const snakeData = toSnakeCase(data);
        const { error } = await supabase
          .from(supabaseTableName)
          .upsert(snakeData as any, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          });
        
        if (error) {
          console.error(`Error upserting ${tableName}:`, error);
          setLocalStorageItem(tableName, data);
          throw error;
        }
      }
    } catch (error) {
      console.error(`Error setting ${tableName}:`, error);
      // Always save to localStorage as backup, even if Supabase fails
      setLocalStorageItem(tableName, data);
      throw error; // Re-throw so caller knows it failed
    }
  } else {
    // Fallback to localStorage
    setLocalStorageItem(tableName, data);
  }
}

export async function apiAdd<T>(tableName: string, item: T): Promise<T> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const supabaseTableName = getSupabaseTableName(tableName);
      const snakeItem = toSnakeCase(item);
      const { data: insertedData, error } = await supabase
        .from(supabaseTableName)
        .insert(snakeItem as any)
        .select()
        .single();
      
      if (error) {
        console.error(`Error adding to ${tableName}:`, error);
        // Fallback: get existing, add item, save
        const existing = getLocalStorageItem<T[]>(tableName) || [];
        const updated = [...existing, item];
        setLocalStorageItem(tableName, updated);
        return item;
      }
      
      // Convert back to camelCase
      return toCamelCase(insertedData) as T;
    } catch (error) {
      console.error(`Error adding to ${tableName}:`, error);
      const existing = getLocalStorageItem<T[]>(tableName) || [];
      const updated = [...existing, item];
      setLocalStorageItem(tableName, updated);
      return item;
    }
  }
  
  // Fallback to localStorage
  const existing = getLocalStorageItem<T[]>(tableName) || [];
  const updated = [...existing, item];
  setLocalStorageItem(tableName, updated);
  return item;
}

// Safe replace function: upserts new data first, then optionally deletes records not in new dataset
// This ensures data is never lost - new data is saved before any deletion
export async function apiReplace<T>(tableName: string, data: T): Promise<void> {
  if (isSupabaseConfigured() && supabase && Array.isArray(data)) {
    try {
      const supabaseTableName = getSupabaseTableName(tableName);
      
      if (data.length > 0) {
        // Step 1: Upsert all new data first (CRITICAL: ensures new data is saved before any deletion)
        const snakeData = toSnakeCase(data);
        const { error: upsertError } = await supabase
          .from(supabaseTableName)
          .upsert(snakeData, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          });
        
        if (upsertError) {
          console.error(`Error upserting ${tableName} during replace:`, upsertError);
          setLocalStorageItem(tableName, data);
          throw upsertError;
        }
        
        console.log(`Successfully upserted ${data.length} records to ${supabaseTableName} (replace mode)`);
        
        // Step 2: Get IDs from new data
        const newDataIds = new Set(data.map((item: any) => item.id).filter((id: any) => id));
        
        // Step 3: Get all existing IDs and delete those not in new dataset
        // This is done safely: new data is already saved, so if deletion fails, data is still there
        const { data: allExisting, error: fetchError } = await supabase
          .from(supabaseTableName)
          .select('id');
        
        if (!fetchError && allExisting) {
          const idsToDelete = allExisting
            .map((row: any) => row.id)
            .filter((id: string) => !newDataIds.has(id));
          
          if (idsToDelete.length > 0) {
            // Delete in batches to avoid query size limits
            const BATCH_SIZE = 1000;
            for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
              const batch = idsToDelete.slice(i, i + BATCH_SIZE);
              const { error: deleteError } = await supabase
                .from(supabaseTableName)
                .delete()
                .in('id', batch);
              
              if (deleteError) {
                console.warn(`Error deleting ${batch.length} old records (non-critical, new data is saved):`, deleteError);
              } else {
                console.log(`Deleted ${batch.length} old records from ${supabaseTableName}`);
              }
            }
          }
        }
      } else {
        // If new data is empty, clear all (user explicitly wants empty dataset)
        const { error: deleteError } = await supabase
          .from(supabaseTableName)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        
        if (deleteError) {
          console.error(`Error clearing ${tableName}:`, deleteError);
          throw deleteError;
        }
      }
      
      // Always save to localStorage as backup
      setLocalStorageItem(tableName, data);
    } catch (error) {
      console.error(`Error replacing ${tableName}:`, error);
      setLocalStorageItem(tableName, data);
      throw error;
    }
  } else {
    // Fallback to localStorage
    setLocalStorageItem(tableName, data);
  }
}

export async function apiUpdate<T>(tableName: string, id: string, updates: Partial<T>): Promise<void> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const supabaseTableName = getSupabaseTableName(tableName);
      const snakeUpdates = toSnakeCase(updates);
      const { error } = await supabase
        .from(supabaseTableName)
        .update(snakeUpdates as any)
        .eq('id', id);
      
      if (error) {
        console.error(`Error updating ${tableName}:`, error);
        // Fallback to localStorage
        const existing = getLocalStorageItem<T[]>(tableName) || [];
        const updated = existing.map((item: any) => 
          item.id === id ? { ...item, ...updates } : item
        );
        setLocalStorageItem(tableName, updated);
      }
    } catch (error) {
      console.error(`Error updating ${tableName}:`, error);
      const existing = getLocalStorageItem<T[]>(tableName) || [];
      const updated = existing.map((item: any) => 
        item.id === id ? { ...item, ...updates } : item
      );
      setLocalStorageItem(tableName, updated);
    }
  } else {
    // Fallback to localStorage
    const existing = getLocalStorageItem<T[]>(tableName) || [];
    const updated = existing.map((item: any) => 
      item.id === id ? { ...item, ...updates } : item
    );
    setLocalStorageItem(tableName, updated);
  }
}

export async function apiDelete(tableName: string, id: string): Promise<void> {
  if (isSupabaseConfigured() && supabase) {
    try {
      const supabaseTableName = getSupabaseTableName(tableName);
      const { error } = await supabase
        .from(supabaseTableName)
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error(`Error deleting from ${tableName}:`, error);
        // Fallback to localStorage
        const existing = getLocalStorageItem<any[]>(tableName) || [];
        const updated = existing.filter((item: any) => item.id !== id);
        setLocalStorageItem(tableName, updated);
      }
    } catch (error) {
      console.error(`Error deleting from ${tableName}:`, error);
      const existing = getLocalStorageItem<any[]>(tableName) || [];
      const updated = existing.filter((item: any) => item.id !== id);
      setLocalStorageItem(tableName, updated);
    }
  } else {
    // Fallback to localStorage
    const existing = getLocalStorageItem<any[]>(tableName) || [];
    const updated = existing.filter((item: any) => item.id !== id);
    setLocalStorageItem(tableName, updated);
  }
}

// Storage keys (moved here to avoid circular dependency)
const STORAGE_KEYS = {
  USERS: "users",
  RAW_DATA: "rawData",
  CASES: "maintenanceCases",
  SPARE_PARTS: "spareParts",
  SPARE_PART_ASSIGNMENTS: "sparePartAssignments",
  SPARE_PART_USAGE: "sparePartUsage",
} as const;

// Specific API functions for each data type
export const api = {
  // Users
  getUsers: () => apiGet<any[]>(STORAGE_KEYS.USERS),
  setUsers: (users: any[]) => apiSet(STORAGE_KEYS.USERS, users),
  addUser: (user: any) => apiAdd(STORAGE_KEYS.USERS, user),
  updateUser: (id: string, updates: any) => apiUpdate(STORAGE_KEYS.USERS, id, updates),
  deleteUser: (id: string) => apiDelete(STORAGE_KEYS.USERS, id),
  
  // Raw Data
  getRawData: () => apiGet<any[]>(STORAGE_KEYS.RAW_DATA),
  setRawData: (data: any[]) => apiSet(STORAGE_KEYS.RAW_DATA, data),
  replaceRawData: (data: any[]) => apiReplace(STORAGE_KEYS.RAW_DATA, data), // Safe replace for replace mode
  addRawData: (item: any) => apiAdd(STORAGE_KEYS.RAW_DATA, item),
  
  // Cases
  getCases: () => apiGet<any[]>(STORAGE_KEYS.CASES),
  setCases: (cases: any[]) => apiSet(STORAGE_KEYS.CASES, cases),
  addCase: (caseItem: any) => apiAdd(STORAGE_KEYS.CASES, caseItem),
  updateCase: (id: string, updates: any) => apiUpdate(STORAGE_KEYS.CASES, id, updates),
  deleteCase: (id: string) => apiDelete(STORAGE_KEYS.CASES, id),
  
  // Spare Parts
  getSpareParts: () => apiGet<any[]>(STORAGE_KEYS.SPARE_PARTS),
  setSpareParts: (parts: any[]) => apiSet(STORAGE_KEYS.SPARE_PARTS, parts),
  addSparePart: (part: any) => apiAdd(STORAGE_KEYS.SPARE_PARTS, part),
  updateSparePart: (id: string, updates: any) => apiUpdate(STORAGE_KEYS.SPARE_PARTS, id, updates),
  deleteSparePart: (id: string) => apiDelete(STORAGE_KEYS.SPARE_PARTS, id),
};

