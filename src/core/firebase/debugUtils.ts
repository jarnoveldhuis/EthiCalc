// src/shared/utils/firebase-debug.ts

interface LogDetails {
    [key: string]: unknown;
  }
  
  /**
   * Enhanced logging utility for Firebase operations
   * This can be enabled/disabled via localStorage for debugging
   */
  export const firebaseDebug = {
    /**
     * Log detailed information about Firebase operations
     */
    log: (operation: string, details: LogDetails): void => {
      // Check if debug is enabled in localStorage
      const debugEnabled = typeof window !== 'undefined' && 
        window.localStorage.getItem('firebase-debug') === 'true';
      
      if (debugEnabled || process.env.NODE_ENV === 'development') {
        console.group(`🔥 Firebase ${operation}`);
        console.log('Details:', details);
        console.log('Timestamp:', new Date().toISOString());
        console.groupEnd();
      }
    },
  
    /**
     * Log Firebase read operations
     */
    logRead: (collection: string, query: LogDetails, result: LogDetails): void => {
      firebaseDebug.log('READ', {
        collection,
        query,
        resultCount: Array.isArray(result) ? result.length : (result ? 1 : 0),
        resultPreview: Array.isArray(result) ? result.slice(0, 2) : result
      });
    },
  
    /**
     * Log Firebase write operations
     */
    logWrite: (collection: string, data: LogDetails, result: LogDetails): void => {
      firebaseDebug.log('WRITE', {
        collection,
        dataSize: JSON.stringify(data).length,
        dataPreview: {
          ...data,
          transactions: data.transactions ? 
            `[${(data.transactions as unknown[]).length} transactions]` : undefined
        },
        result
      });
    },
  
    /**
     * Enable Firebase debugging in browser
     */
    enable: (): void => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('firebase-debug', 'true');
        console.log('🔥 Firebase debugging enabled');
      }
    },
  
    /**
     * Disable Firebase debugging
     */
    disable: (): void => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('firebase-debug');
        console.log('🔥 Firebase debugging disabled');
      }
    }
  };