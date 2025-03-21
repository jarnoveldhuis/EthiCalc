// src/features/analysis/preventAutoLoad.ts

/**
 * This utility prevents automatic loading of transactions
 * from Firebase after a user has disconnected their bank
 */

// Flag to indicate if transactions should be blocked from loading
const AUTO_LOAD_BLOCKER_KEY = 'block_transaction_auto_load';

/**
 * Prevent auto-loading of transactions on future page loads
 * @param duration Time in milliseconds to block auto-loading (default: 1 hour)
 */
export function blockTransactionAutoLoad(duration: number = 60 * 60 * 1000): void {
  // Calculate expiry time
  const expiry = Date.now() + duration;
  
  // Set the blocker with expiry timestamp
  localStorage.setItem(AUTO_LOAD_BLOCKER_KEY, expiry.toString());
  console.log(`Blocking transaction auto-load for ${duration/1000} seconds`);
  
  // Also set a session blocker to ensure it persists through the current session
  sessionStorage.setItem(AUTO_LOAD_BLOCKER_KEY, 'true');
}

/**
 * Check if auto-loading of transactions should be blocked
 * @returns True if auto-load should be blocked, false otherwise
 */
export function shouldBlockAutoLoad(): boolean {
  // First check session blocker (strongest)
  if (sessionStorage.getItem(AUTO_LOAD_BLOCKER_KEY) === 'true') {
    return true;
  }
  
  // Then check expiring blocker
  const expiryStr = localStorage.getItem(AUTO_LOAD_BLOCKER_KEY);
  if (expiryStr) {
    const expiry = parseInt(expiryStr, 10);
    
    // If the expiry is valid and hasn't passed yet
    if (!isNaN(expiry) && expiry > Date.now()) {
      return true;
    } else {
      // Clear expired blocker
      localStorage.removeItem(AUTO_LOAD_BLOCKER_KEY);
    }
  }
  
  return false;
}

/**
 * Remove the auto-load block
 */
export function removeAutoLoadBlock(): void {
  localStorage.removeItem(AUTO_LOAD_BLOCKER_KEY);
  sessionStorage.removeItem(AUTO_LOAD_BLOCKER_KEY);
  console.log('Removed transaction auto-load block');
}