// Security utilities for password hashing and session management
import CryptoJS from 'crypto-js';

// Secret key for encryption (in production, this should be environment variable)
const ENCRYPTION_KEY = 'service-tracker-secret-key-2024';

/**
 * Hash a password using SHA-256
 * Note: For production, use bcrypt or Argon2, but for client-side only apps,
 * SHA-256 with salt is a reasonable compromise
 */
export function hashPassword(password: string, salt?: string): string {
  const saltToUse = salt || CryptoJS.lib.WordArray.random(128/8).toString();
  const hash = CryptoJS.SHA256(password + saltToUse).toString();
  return `${saltToUse}:${hash}`;
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  try {
    const [salt, storedHash] = hash.split(':');
    if (!salt || !storedHash) return false;
    const computedHash = CryptoJS.SHA256(password + salt).toString();
    return computedHash === storedHash;
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

/**
 * Encrypt sensitive data before storing in localStorage
 */
export function encryptData(data: string): string {
  try {
    return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error('Error encrypting data:', error);
    return data; // Fallback to plain text if encryption fails
  }
}

/**
 * Decrypt data from localStorage
 */
export function decryptData(encryptedData: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Error decrypting data:', error);
    return encryptedData; // Return as-is if decryption fails
  }
}

/**
 * Generate a session token
 */
export function generateSessionToken(): string {
  return CryptoJS.lib.WordArray.random(256/8).toString();
}

/**
 * Check if session is valid (not expired)
 */
export function isSessionValid(): boolean {
  const sessionExpiry = localStorage.getItem('sessionExpiry');
  if (!sessionExpiry) return false;
  
  const expiryTime = parseInt(sessionExpiry, 10);
  const now = Date.now();
  
  return now < expiryTime;
}

/**
 * Set session with expiration (default 24 hours)
 */
export function setSession(userRole: string, expiresInHours: number = 24): void {
  const expiryTime = Date.now() + (expiresInHours * 60 * 60 * 1000);
  localStorage.setItem('sessionExpiry', expiryTime.toString());
  localStorage.setItem('userRole', userRole);
}

/**
 * Clear session
 */
export function clearSession(): void {
  localStorage.removeItem('sessionExpiry');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userId');
  localStorage.removeItem('userPermission');
  localStorage.removeItem('userDistrict');
  localStorage.removeItem('isAuthenticated');
}

/**
 * Sanitize input to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
    .trim();
}

/**
 * Rate limiting for login attempts
 */
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export function checkLoginRateLimit(): { allowed: boolean; remainingTime?: number } {
  const attemptsKey = 'loginAttempts';
  const lockoutKey = 'loginLockout';
  
  // Check if account is locked out
  const lockoutUntil = localStorage.getItem(lockoutKey);
  if (lockoutUntil) {
    const lockoutTime = parseInt(lockoutUntil, 10);
    const now = Date.now();
    
    if (now < lockoutTime) {
      const remainingTime = Math.ceil((lockoutTime - now) / 1000 / 60); // minutes
      return { allowed: false, remainingTime };
    } else {
      // Lockout expired, clear it
      localStorage.removeItem(lockoutKey);
      localStorage.removeItem(attemptsKey);
    }
  }
  
  return { allowed: true };
}

export function recordLoginAttempt(success: boolean): void {
  const attemptsKey = 'loginAttempts';
  
  if (success) {
    // Reset on successful login
    localStorage.removeItem(attemptsKey);
    localStorage.removeItem('loginLockout');
    return;
  }
  
  // Increment failed attempts
  const attempts = parseInt(localStorage.getItem(attemptsKey) || '0', 10) + 1;
  localStorage.setItem(attemptsKey, attempts.toString());
  
  // Lock account if max attempts reached
  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    const lockoutUntil = Date.now() + LOCKOUT_DURATION;
    localStorage.setItem('loginLockout', lockoutUntil.toString());
  }
}

/**
 * Validate user is authenticated and has required permission
 */
export function requireAuth(requiredRole?: 'admin' | 'editor' | 'view'): boolean {
  // Check if session is valid
  if (!isSessionValid()) {
    clearSession();
    return false;
  }
  
  // Check if authenticated
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  if (!isAuthenticated) {
    return false;
  }
  
  // Check role if required
  if (requiredRole) {
    const userRole = localStorage.getItem('userRole');
    const userPermission = localStorage.getItem('userPermission');
    
    if (requiredRole === 'admin') {
      return userRole === 'admin' || userPermission === 'admin';
    }
    
    if (requiredRole === 'editor') {
      return userRole === 'admin' || userPermission === 'admin' || userPermission === 'editor';
    }
  }
  
  return true;
}

