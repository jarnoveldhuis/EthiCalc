// src/store/transactionStore.ts

import { create } from "zustand";
import { Transaction, Charity, Citation } from "@/shared/types/transactions";
import { ImpactAnalysis } from "@/core/calculations/type";
import { calculationService } from "@/core/calculations/impactService";
import { User } from "firebase/auth";
import { auth, db } from "@/core/firebase/firebase";
import { Timestamp, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { config } from "@/config";
import {
  mapPlaidTransactions,
  mergeTransactions,
} from "@/core/plaid/transactionMapper";
import {
  getVendorAnalysis,
  saveVendorAnalysis,
  normalizeVendorName,
} from "@/features/vendors/vendorStorageService";
import { VendorAnalysis } from "@/shared/types/vendors";
import {
  VALUE_CATEGORIES,
  NEUTRAL_LEVEL,
  NEGATIVE_PRACTICE_MULTIPLIERS,
  TOTAL_VALUE_POINTS,
  MIN_LEVEL,
  normalizeCategoryName,
} from "@/config/valuesConfig";

// --- TYPES ---
export type AppStatus =
  | "idle"
  | "initializing"
  | "connecting_bank"
  | "fetching_plaid"
  | "analyzing"
  | "saving_batch"
  | "saving_cache"
  | "loading_latest"
  | "loading_settings"
  | "saving_settings"
  | "error";

interface BankConnectionStatus {
  isConnected: boolean;
  error: string | null;
}

export interface UserValueSettings {
  levels: { [categoryId: string]: number };
  order: string[];
  valuesHash?: string;
}

interface StoredTokenInfo {
  token: string;
  userId: string;
  timestamp: number;
}

interface ApiAnalysisResultItem {
  plaidTransactionId?: string;
  unethicalPractices?: string[];
  ethicalPractices?: string[];
  practiceWeights?: Record<string, number>;
  practiceDebts?: Record<string, number>;
  practiceSearchTerms?: Record<string, string>;
  practiceCategories?: Record<string, string>;
  charities?: Record<string, Charity>;
  information?: Record<string, string>;
  citations?: Record<string, Citation[]>;
  name?: string;
  societalDebt?: number;
}
interface ApiAnalysisResponse {
  transactions: ApiAnalysisResultItem[];
  error?: string;
}

export interface TransactionState {
  transactions: Transaction[];
  savedTransactions: Transaction[] | null;
  impactAnalysis: ImpactAnalysis | null;
  connectionStatus: BankConnectionStatus;
  appStatus: AppStatus;
  hasSavedData: boolean;
  userValueSettings: UserValueSettings;
  valuesCommittedUntil: Timestamp | null;
  updateCategoryOrder: (userId: string, newOrder: string[]) => Promise<void>;
  setTransactions: (transactions: Transaction[]) => void;
  connectBank: (publicToken: string, user: User | null) => Promise<void>;
  disconnectBank: () => void;
  fetchTransactions: (accessToken?: string) => Promise<void>;
  manuallyFetchTransactions: () => Promise<void>;
  analyzeAndCacheTransactions: (rawTransactions: Transaction[]) => Promise<void>;
  saveTransactionBatch: (transactionsToSave: Transaction[]) => Promise<void>;
  loadLatestTransactions: () => Promise<boolean>;
  resetState: () => void;
  initializeStore: (user: User | null) => Promise<void>;
  initializeUserValueSettings: (userId: string) => Promise<void>;
  updateUserValue: (userId: string, categoryId: string, newLevel: number) => Promise<void>;
  getUserValueMultiplier: (practiceCategoryName: string | undefined) => number;
  resetUserValuesToDefault: (userId: string) => Promise<void>;
  commitUserValues: (userId: string) => Promise<boolean>;
}

// --- Helper Functions ---

function createValuesHash(levels: Record<string, number>): string {
  return Object.keys(levels).sort().map((key) => `${key}:${levels[key]}`).join("_");
}

function getTransactionIdentifier(transaction: Transaction | ApiAnalysisResultItem): string | null {
    if (transaction.plaidTransactionId) return `plaid-${transaction.plaidTransactionId}`;
    if ('date' in transaction && 'amount' in transaction && transaction.date && transaction.name && typeof transaction.amount === "number") {
        return `${transaction.date}-${transaction.name.trim().toUpperCase()}-${transaction.amount.toFixed(2)}`;
    }
    return null;
}

function sanitizeDataForFirestore<T>(data: T): T | null {
  if (data === undefined) return null;
  if (data === null || typeof data !== "object") return data;
  if (data instanceof Timestamp) return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeDataForFirestore(item)).filter((item) => item !== undefined) as T;
  }
  const sanitizedObject: Record<string, unknown> = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = (data as Record<string, unknown>)[key];
      if (value !== undefined) {
        const sanitizedValue = sanitizeDataForFirestore(value);
        if (sanitizedValue !== undefined) {
          sanitizedObject[key] = sanitizedValue;
        }
      }
    }
  }
  return sanitizedObject as T;
}

const getAuthHeader = async (): Promise<HeadersInit | null> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    console.warn("getAuthHeader: No current user found.");
    return null;
  }
  try {
    const token = await currentUser.getIdToken(true);
    if (!token) {
      console.warn("getAuthHeader: Failed to get ID token.");
      return null;
    }
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  } catch (error) {
    console.error("getAuthHeader: Error getting ID token:", error);
    return null;
  }
};

// --- Store Implementation ---

const analysisLock = { current: false };

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  savedTransactions: null,
  impactAnalysis: null,
  connectionStatus: { isConnected: false, error: null },
  appStatus: "idle",
  hasSavedData: false,
  userValueSettings: {
    levels: VALUE_CATEGORIES.reduce((acc, category) => ({ ...acc, [category.id]: category.defaultLevel }), {} as Record<string, number>),
    order: VALUE_CATEGORIES.map((cat) => cat.id),
    valuesHash: "",
  },
  valuesCommittedUntil: null,

  setTransactions: (transactions) => {
    const currentUserValueSettings = get().userValueSettings;
    const analysis = calculationService.calculateImpactAnalysis(transactions, currentUserValueSettings);
    set({ transactions: transactions, impactAnalysis: analysis });
  },

  resetState: () => {
    const defaultLevels = VALUE_CATEGORIES.reduce((acc, cat) => ({...acc, [cat.id]: cat.defaultLevel}), {} as Record<string, number>);
    const defaultSettings: UserValueSettings = {
        levels: defaultLevels,
        order: VALUE_CATEGORIES.map(cat => cat.id),
        valuesHash: createValuesHash(defaultLevels)
    };
    sessionStorage.setItem("wasManuallyDisconnected", "true");
    localStorage.removeItem("plaid_access_token_info");
    set({
      transactions: [], savedTransactions: null, impactAnalysis: null,
      connectionStatus: { isConnected: false, error: null },
      appStatus: "idle", hasSavedData: false,
      userValueSettings: defaultSettings, valuesCommittedUntil: null,
    });
  },

  disconnectBank: () => get().resetState(),

  analyzeAndCacheTransactions: async (incomingTransactions) => {
    if (analysisLock.current) {
      console.log("analyzeAndCacheTransactions: Skipping, analysis already in progress.");
      return;
    }
  
    try {
      analysisLock.current = true;
      set({ appStatus: "analyzing", connectionStatus: { ...get().connectionStatus, error: null } });
  
      if (!incomingTransactions || incomingTransactions.length === 0) {
        get().setTransactions([]);
        // No need to return here, finally block will set to idle
      } else {
        const { savedTransactions: currentSavedTx, userValueSettings } = get();
        const baseTransactions = currentSavedTx || [];
        const mergedInitialTransactions = mergeTransactions(baseTransactions, incomingTransactions);
  
        const transactionsToProcess = mergedInitialTransactions.map(tx => ({ ...tx, analyzed: tx.analyzed ?? false }));
        const processedTxMap = new Map<string, Transaction>();
        transactionsToProcess.forEach(tx => {
            const id = getTransactionIdentifier(tx);
            if(id) processedTxMap.set(id, tx)
        });
        
        const transactionsForApi: Transaction[] = [];
  
        const cacheLookupPromises = transactionsToProcess.filter(tx => !tx.analyzed).map(async (tx) => {
          const normalizedName = normalizeVendorName(tx.name);
          try {
            if (normalizedName !== "unknown_vendor") {
              const cachedData = await getVendorAnalysis(normalizedName);
              if (cachedData) {
                const txId = getTransactionIdentifier(tx);
                if(txId) {
                    const updatedTx: Transaction = { ...tx, analyzed: true, ...cachedData };
                    processedTxMap.set(txId, updatedTx);
                    return;
                }
              }
            }
          } catch (e) { console.error(`Cache lookup error for ${tx.name}:`, e); }
          transactionsForApi.push(tx);
        });
        await Promise.all(cacheLookupPromises);
  
        if (transactionsForApi.length > 0) {
          const authHeaders = await getAuthHeader();
          if (!authHeaders) throw new Error("User not authenticated for analysis.");
          
          const response = await fetch("/api/analysis", {
            method: "POST", headers: authHeaders, body: JSON.stringify({ transactions: transactionsForApi }),
          });
          if (!response.ok) throw new Error(`Analysis API Error: ${response.status}`);
          
          const analysisResponse = await response.json() as ApiAnalysisResponse;
          if (!analysisResponse.transactions) throw new Error("Invalid API response format");
  
          const apiResultsMap = new Map<string, ApiAnalysisResultItem>();
          analysisResponse.transactions.forEach(aTx => {
            if (aTx.plaidTransactionId) apiResultsMap.set(`plaid-${aTx.plaidTransactionId}`, aTx);
          });
          
          set({ appStatus: "saving_cache" });
          
          transactionsForApi.forEach(originalTx => {
            const txId = getTransactionIdentifier(originalTx);
            const apiResult = txId ? apiResultsMap.get(txId) : null;
            if (apiResult && txId) {
              const finalTx: Transaction = { ...originalTx, analyzed: true, ...apiResult };
              processedTxMap.set(txId, finalTx);
              const normName = normalizeVendorName(finalTx.name);
              if (normName !== "unknown_vendor") {
                // ** THE FIX IS HERE **
                // Explicitly construct the object for the vendor cache.
                const vendorData: Omit<VendorAnalysis, 'analyzedAt'> = {
                    originalName: finalTx.name,
                    analysisSource: config.analysisProvider as 'gemini' | 'openai',
                    unethicalPractices: finalTx.unethicalPractices ?? [],
                    ethicalPractices: finalTx.ethicalPractices ?? [],
                    practiceWeights: finalTx.practiceWeights ?? {},
                    practiceSearchTerms: finalTx.practiceSearchTerms ?? {},
                    practiceCategories: finalTx.practiceCategories ?? {},
                    information: finalTx.information ?? {},
                    citations: finalTx.citations ?? {},
                };
                saveVendorAnalysis(normName, vendorData).catch(err => console.error("Failed to save vendor cache:", err));
              }
            }
          });
        }
        
        const finalTransactions = Array.from(processedTxMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        set({
          transactions: finalTransactions,
          savedTransactions: finalTransactions,
          impactAnalysis: calculationService.calculateImpactAnalysis(finalTransactions, userValueSettings),
          hasSavedData: true,
        });
  
        if (finalTransactions.length > 0) {
          set({ appStatus: "saving_batch" });
          try {
            await get().saveTransactionBatch(finalTransactions);
            console.log(`analyzeAndCacheTransactions: Successfully saved batch of ${finalTransactions.length} transactions`);
          } catch (saveError) {
            // Log the error but don't fail the entire analysis
            console.error("analyzeAndCacheTransactions: Failed to save batch to Firestore:", saveError);
            // Still update savedTransactions locally even if Firestore save fails
            // This allows the UI to work, but the data won't persist across sessions
            set({ hasSavedData: false });
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Analysis failed";
      set({ appStatus: "error", connectionStatus: { ...get().connectionStatus, error: errorMessage } });
    } finally {
      analysisLock.current = false;
      if (get().appStatus !== 'error') {
        set({ appStatus: "idle" });
      }
    }
  },

  saveTransactionBatch: async (transactionsToSave) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error("saveTransactionBatch: User not logged in");
      throw new Error("User not logged in for save.");
    }
    
    const { userValueSettings } = get();
    
    try {
        console.log(`saveTransactionBatch: Starting save for ${transactionsToSave.length} transactions`);
        
        const authHeaders = await getAuthHeader();
        if (!authHeaders) {
          console.error("saveTransactionBatch: Failed to get auth headers");
          throw new Error("User not authenticated for saving batch.");
        }
        
        const analysisForSave = calculationService.calculateImpactAnalysis(transactionsToSave, userValueSettings);
        const batchPayload = {
            analyzedData: {
                transactions: transactionsToSave,
                totalSocietalDebt: analysisForSave.negativeImpact,
                debtPercentage: analysisForSave.debtPercentage,
                totalPositiveImpact: analysisForSave.positiveImpact,
                totalNegativeImpact: analysisForSave.negativeImpact,
            },
        };

        const sanitizedPayload = sanitizeDataForFirestore(batchPayload);
        if (!sanitizedPayload) {
          console.error("saveTransactionBatch: Failed to sanitize payload");
          throw new Error("Failed to sanitize payload.");
        }

        console.log(`saveTransactionBatch: Sending request to /api/transactions/save with ${sanitizedPayload.analyzedData.transactions.length} transactions`);
        
        const response = await fetch("/api/transactions/save", {
            method: "POST", headers: authHeaders, body: JSON.stringify(sanitizedPayload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error || `Save Batch API Error: ${response.status}`;
            console.error(`saveTransactionBatch: API error (${response.status}):`, errorMessage, errorData);
            throw new Error(errorMessage);
        }
        
        const responseData = await response.json().catch(() => ({}));
        if (!responseData.success || !responseData.batchId) {
          console.error(`saveTransactionBatch: API returned success but missing batchId:`, responseData);
          throw new Error("Save batch API returned invalid response format");
        }
        console.log(`saveTransactionBatch: Successfully saved batch with ID: ${responseData.batchId}`);
        set({ hasSavedData: true });
    } catch (error) {
        console.error("saveTransactionBatch: Error saving batch via API:", error);
        if (error instanceof Error) {
          console.error("saveTransactionBatch: Error details:", {
            message: error.message,
            stack: error.stack
          });
        }
        throw error;
    }
  },

  // Other functions (connectBank, fetchTransactions, etc.) remain unchanged...
  connectBank: async (publicToken, user) => {
    if (!user || (get().appStatus !== "idle" && get().appStatus !== "error")) return;
    set({ appStatus: "connecting_bank", connectionStatus: { isConnected: false, error: null } });
    try {
      const authHeaders = await getAuthHeader();
      if (!authHeaders) throw new Error("User not authenticated for token exchange.");
      const response = await fetch("/api/banking/exchange_token", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ public_token: publicToken }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Token exchange failed (${response.status})`);
      }
      const data = await response.json();
      const tokenInfo: StoredTokenInfo = { token: data.access_token, userId: user.uid, timestamp: Date.now() };
      localStorage.setItem("plaid_access_token_info", JSON.stringify(tokenInfo));
      sessionStorage.removeItem("wasManuallyDisconnected");
      set({ connectionStatus: { isConnected: true, error: null } });
      // Don't set appStatus to 'idle' here - let fetchTransactions manage the status
      // It will set it to 'fetching_plaid', then 'analyzing', etc.
      await get().fetchTransactions(data.access_token);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to connect bank";
      set({ appStatus: "error", connectionStatus: { isConnected: false, error: errorMessage } });
    }
  },

  fetchTransactions: async (accessToken) => {
    // Allow fetching when status is 'idle', 'error', or 'connecting_bank' (when called from connectBank)
    const currentStatus = get().appStatus;
    if (
      currentStatus !== "idle" &&
      currentStatus !== "error" &&
      currentStatus !== "connecting_bank" &&
      currentStatus !== "initializing" &&
      currentStatus !== "loading_latest"
    ) {
      return;
    }
    set({ appStatus: "fetching_plaid" });
    let tokenToUse = accessToken;
    try {
      if (!tokenToUse) {
          const storedData = localStorage.getItem("plaid_access_token_info");
          if (!storedData) throw new Error("No access token available");
          const tokenInfo = JSON.parse(storedData);
          if (tokenInfo.userId !== auth.currentUser?.uid) throw new Error("Invalid access token.");
          tokenToUse = tokenInfo.token;
      }
      const authHeaders = await getAuthHeader();
      if (!authHeaders) throw new Error("User not authenticated.");
      const response = await fetch("/api/banking/transactions", {
        method: "POST", headers: authHeaders, body: JSON.stringify({ access_token: tokenToUse })
      });
      if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Plaid fetch failed: ${response.status}`);
      }
      const rawPlaidTransactions = await response.json();
      const mappedTransactions = mapPlaidTransactions(rawPlaidTransactions);
      set({ connectionStatus: { isConnected: true, error: null } });
      await get().analyzeAndCacheTransactions(mappedTransactions);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load transactions";
        console.error("fetchTransactions error:", errorMessage);
        // Only disconnect if it's a token/auth issue
        if (errorMessage.includes("No access token") || 
            errorMessage.includes("Invalid access token") ||
            errorMessage.includes("not authenticated")) {
          set({ appStatus: "error", connectionStatus: { isConnected: false, error: errorMessage } });
        } else {
          // For other errors (network, Plaid API issues), keep connection status but show error
          set({ 
            appStatus: "error", 
            connectionStatus: { ...get().connectionStatus, error: errorMessage } 
          });
        }
    }
  },
  
  manuallyFetchTransactions: async () => {
    // Check if we have an access token before attempting to fetch
    const storedData = localStorage.getItem("plaid_access_token_info");
    if (!storedData) {
      const errorMsg = "No access token available. Please reconnect your bank account.";
      console.error("manuallyFetchTransactions:", errorMsg);
      set({ 
        appStatus: "error", 
        connectionStatus: { isConnected: false, error: errorMsg } 
      });
      return;
    }
    
    try {
      const tokenInfo = JSON.parse(storedData);
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error("User not logged in");
      }
      
      if (tokenInfo.userId !== currentUser.uid) {
        throw new Error("Access token does not match current user");
      }
      
      // Call fetchTransactions with the token
      await get().fetchTransactions(tokenInfo.token);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch transactions";
      console.error("manuallyFetchTransactions error:", errorMessage);
      // Only disconnect if it's a token/auth issue, not a network issue
      if (errorMessage.includes("token") || errorMessage.includes("auth") || errorMessage.includes("No access token")) {
        set({ 
          appStatus: "error", 
          connectionStatus: { isConnected: false, error: errorMessage } 
        });
      } else {
        // For other errors (network, etc.), keep connection but show error
        set({ 
          appStatus: "error", 
          connectionStatus: { ...get().connectionStatus, error: errorMessage } 
        });
      }
    }
  },

  loadLatestTransactions: async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    if (sessionStorage.getItem("wasManuallyDisconnected") === "true") return false;
    
    set({ appStatus: "loading_latest" });
    try {
        const authHeaders = await getAuthHeader();
        if (!authHeaders) throw new Error("User not authenticated.");
        const response = await fetch("/api/transactions/latest", { headers: authHeaders });
        
        if (response.status === 404) {
            set({ hasSavedData: false, transactions: [], impactAnalysis: null, appStatus: 'idle' });
            return false;
        }
        if (!response.ok) throw new Error(`Load Latest API Error: ${response.status}`);
        
        const data = await response.json();
        const batch = data.batch;

        if (batch?.transactions) {
            const loadedTransactions = (batch.transactions as Transaction[]).map(tx => ({ ...tx, analyzed: tx.analyzed ?? true }));
            const analysis = calculationService.calculateImpactAnalysis(loadedTransactions, get().userValueSettings);
            set({
                transactions: loadedTransactions, savedTransactions: loadedTransactions,
                impactAnalysis: analysis, hasSavedData: true,
                connectionStatus: { isConnected: true, error: null },
            });
            return true;
        }
        set({ appStatus: "idle", hasSavedData: false });
        return false;
    } catch (error) {
        set({ appStatus: "error", connectionStatus: { isConnected: false, error: error instanceof Error ? error.message : "Failed to load" } });
        return false;
    } finally {
        if (get().appStatus === "loading_latest") set({ appStatus: "idle" });
    }
  },

 // src/store/transactionStore.ts

initializeStore: async (user: User | null) => {
  if (!user) {
    get().resetState();
    return;
  }
  
  if (sessionStorage.getItem("wasManuallyDisconnected") === "true") {
    set({ connectionStatus: { isConnected: false, error: null } });
    return;
  }

  set({ appStatus: "initializing" });
  
  try {
    await get().initializeUserValueSettings(user.uid);
    
    // 1. Load saved data (don't care if it returns true/false, we just want to show what we have)
    await get().loadLatestTransactions();

    // 2. ALWAYS try to fetch fresh data if we have a token
    const storedData = localStorage.getItem("plaid_access_token_info");
    if (storedData) {
      const tokenInfo = JSON.parse(storedData);
      if (tokenInfo.userId === user.uid) {
        // This will now work because we updated the guard clause in fetchTransactions
        await get().fetchTransactions(tokenInfo.token); 
      }
    }
  } catch (error) {
    set({
      appStatus: "error",
      connectionStatus: {
        isConnected: false,
        error: error instanceof Error ? error.message : "Initialization failed",
      },
    });
  } finally {
    // Only reset to idle if we are still in the initializing phase
    if (get().appStatus === "initializing") {
        set({ appStatus: "idle" });
    }
  }
},

  initializeUserValueSettings: async (userId: string) => {
    if (get().appStatus === 'loading_settings') return;
    set({ appStatus: "loading_settings" });
    try {
      const userSettingsRef = doc(db, "userValueSettings", userId);
      const docSnap = await getDoc(userSettingsRef);
      const settingsToSet: UserValueSettings = {
        levels: VALUE_CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.id]: cat.defaultLevel }), {} as Record<string, number>),
        order: VALUE_CATEGORIES.map(cat => cat.id),
      };
      if (docSnap.exists()) {
        const data = docSnap.data();
        Object.assign(settingsToSet.levels, data.levels);
        settingsToSet.order = data.order && data.order.length === VALUE_CATEGORIES.length ? data.order : settingsToSet.order;
        settingsToSet.valuesHash = data.valuesHash || createValuesHash(settingsToSet.levels);
        set({ valuesCommittedUntil: data.valuesCommittedUntil || null });
      } else {
        settingsToSet.valuesHash = createValuesHash(settingsToSet.levels);
        await setDoc(userSettingsRef, settingsToSet, { merge: true });
      }
      set({ userValueSettings: settingsToSet });
    } catch (error) {
      console.error("Error initializing user values:", error);
    } finally {
        if(get().appStatus === 'loading_settings') set({ appStatus: "idle" });
    }
  },
  
  updateUserValue: async (userId, categoryId, newLevel) => {
      const { userValueSettings, transactions } = get();
      if (newLevel === userValueSettings.levels[categoryId]) return;

      const newLevels = { ...userValueSettings.levels };
      newLevels[categoryId] = newLevel;
      const currentTotal = Object.values(newLevels).reduce((sum, level) => sum + level, 0);

      if (currentTotal > TOTAL_VALUE_POINTS) {
          let pointsToReclaim = currentTotal - TOTAL_VALUE_POINTS;
          const candidates = userValueSettings.order.filter(id => id !== categoryId && newLevels[id] > MIN_LEVEL);
          for (const candId of candidates.reverse()) {
              if (pointsToReclaim <= 0) break;
              const take = Math.min(pointsToReclaim, newLevels[candId] - MIN_LEVEL);
              newLevels[candId] -= take;
              pointsToReclaim -= take;
          }
      }

      const newHash = createValuesHash(newLevels);
      const finalSettings = { ...userValueSettings, levels: newLevels, valuesHash: newHash };
      
      set({ userValueSettings: finalSettings });
      get().setTransactions(transactions);

      try {
        await setDoc(doc(db, "userValueSettings", userId), finalSettings, { merge: true });
      } catch (error) { console.error("Error saving user values:", error); }
  },
  
  updateCategoryOrder: async (userId, newOrder) => {
    const newSettings = { ...get().userValueSettings, order: newOrder };
    set({ userValueSettings: newSettings });
    try {
      await setDoc(doc(db, "userValueSettings", userId), { order: newOrder }, { merge: true });
    } catch (error) { console.error("Error saving category order:", error); }
  },

  getUserValueMultiplier: (practiceCategoryName) => {
    if (!practiceCategoryName) return 1.0;
    const { userValueSettings } = get();
    // Normalize the category name to handle migrations from old names to new names
    const normalizedCategoryName = normalizeCategoryName(practiceCategoryName);
    const categoryDefinition = VALUE_CATEGORIES.find(cat => cat.name === normalizedCategoryName);
    if (!categoryDefinition) return 1.0;
    const userLevel = userValueSettings.levels[categoryDefinition.id] || NEUTRAL_LEVEL;
    return NEGATIVE_PRACTICE_MULTIPLIERS[userLevel] ?? 1.0;
  },

  resetUserValuesToDefault: async (userId: string) => {
      const defaultLevels = VALUE_CATEGORIES.reduce((acc, cat) => ({...acc, [cat.id]: cat.defaultLevel}), {} as Record<string, number>);
      const defaultSettings = {
          levels: defaultLevels,
          order: VALUE_CATEGORIES.map(cat => cat.id),
          valuesHash: createValuesHash(defaultLevels)
      };
      set({ userValueSettings: defaultSettings, valuesCommittedUntil: null });
      get().setTransactions(get().transactions);
      try {
        await setDoc(doc(db, "userValueSettings", userId), { ...defaultSettings, valuesCommittedUntil: null }, { merge: true });
      } catch (error) { console.error("Error resetting values:", error); }
  },

  commitUserValues: async (userId: string) => {
    try {
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);
      const endOfMonthTimestamp = Timestamp.fromDate(endOfMonth);
      await updateDoc(doc(db, "userValueSettings", userId), { valuesCommittedUntil: endOfMonthTimestamp });
      set({ valuesCommittedUntil: endOfMonthTimestamp });
      return true;
    } catch (error) {
      console.error("Error committing values:", error);
      return false;
    }
  },

}));