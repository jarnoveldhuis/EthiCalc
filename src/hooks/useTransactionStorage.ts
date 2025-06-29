// src/store/transactionStore.ts

// --- Base Imports ---
import { create } from "zustand";
import { Transaction, Charity, Citation } from "@/shared/types/transactions";
import { ImpactAnalysis } from "@/core/calculations/type";
import { calculationService } from "@/core/calculations/impactService";
import { User } from "firebase/auth";
import { auth, db } from "@/core/firebase/firebase";
import { Timestamp, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import {
  mapPlaidTransactions,
  mergeTransactions,
} from "@/core/plaid/transactionMapper";
import {
  getVendorAnalysis,
  saveVendorAnalysis,
  normalizeVendorName,
} from "@/features/vendors/vendorStorageService";

import {
  VALUE_CATEGORIES,
  NEUTRAL_LEVEL,
  NEGATIVE_PRACTICE_MULTIPLIERS,
  TOTAL_VALUE_POINTS,
  MIN_LEVEL,
} from "@/config/valuesConfig";

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
  order: string[]; // Array of categoryId's in user-defined order
  valuesHash?: string; // A denormalized hash for easy querying
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

  // Actions
  updateCategoryOrder: (userId: string, newOrder: string[]) => Promise<void>;
  setTransactions: (transactions: Transaction[]) => void;
  connectBank: (publicToken: string, user: User | null) => Promise<void>;
  disconnectBank: () => void;
  fetchTransactions: (accessToken?: string) => Promise<void>;
  manuallyFetchTransactions: () => Promise<void>;
  analyzeAndCacheTransactions: (
    rawTransactions: Transaction[]
  ) => Promise<void>;
  saveTransactionBatch: (transactionsToSave: Transaction[]) => Promise<void>;
  loadLatestTransactions: () => Promise<boolean>;
  resetState: () => void;
  initializeStore: (user: User | null) => Promise<void>;
  initializeUserValueSettings: (userId: string) => Promise<void>;
  updateUserValue: (
    userId: string,
    categoryId: string,
    newLevel: number
  ) => Promise<void>;
  getUserValueMultiplier: (practiceCategoryName: string | undefined) => number;
  resetUserValuesToDefault: (userId: string) => Promise<void>;
  commitUserValues: (userId: string) => Promise<boolean>;
}

// --- Helper Functions ---

function createValuesHash(levels: Record<string, number>): string {
  return Object.keys(levels)
    .sort()
    .map((key) => `${key}:${levels[key]}`)
    .join("_");
}

function getTransactionIdentifier(transaction: Transaction): string | null {
  const plaidId = transaction.plaidTransactionId;
  if (plaidId) return `plaid-${plaidId}`;
  if (
    transaction.date &&
    transaction.name &&
    typeof transaction.amount === "number"
  )
    return `${transaction.date}-${transaction.name
      .trim()
      .toUpperCase()}-${transaction.amount.toFixed(2)}`;
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
    levels: VALUE_CATEGORIES.reduce((acc, category) => {
      acc[category.id] = category.defaultLevel;
      return acc;
    }, {} as { [key: string]: number }),
    order: VALUE_CATEGORIES.map((cat) => cat.id),
    valuesHash: "",
  },
  valuesCommittedUntil: null,

  setTransactions: (transactions) => {
    const currentUserValueSettings = get().userValueSettings;
    const analysis = calculationService.calculateImpactAnalysis(
      transactions,
      currentUserValueSettings
    );
    set({ transactions: transactions, impactAnalysis: analysis });
  },

  connectBank: async (publicToken, user) => {
    if (!user || (get().appStatus !== "idle" && get().appStatus !== "error")) return;
    set({
      appStatus: "connecting_bank",
      connectionStatus: { isConnected: false, error: null },
    });
    try {
      const authHeaders = await getAuthHeader();
      if (!authHeaders) throw new Error("User not authenticated for token exchange.");
      const response = await fetch("/api/banking/exchange_token", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ public_token: publicToken }),
      });
      const data = await response.json();
      if (!response.ok || !data.access_token) {
        throw new Error(data.error || `Token exchange failed (${response.status})`);
      }
      const tokenInfo: StoredTokenInfo = {
        token: data.access_token,
        userId: user.uid,
        timestamp: Date.now(),
      };
      localStorage.setItem("plaid_access_token_info", JSON.stringify(tokenInfo));
      sessionStorage.removeItem("wasManuallyDisconnected");
      set({
        connectionStatus: { isConnected: true, error: null },
        appStatus: "idle",
      });
      await get().fetchTransactions(data.access_token);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to connect bank";
      set({
        appStatus: "error",
        connectionStatus: { isConnected: false, error: errorMessage },
      });
    }
  },

  resetState: () => {
    const defaultSettings = {
        levels: VALUE_CATEGORIES.reduce((acc, category) => {
            acc[category.id] = category.defaultLevel;
            return acc;
        }, {} as { [key: string]: number }),
        order: VALUE_CATEGORIES.map(cat => cat.id),
        valuesHash: createValuesHash(VALUE_CATEGORIES.reduce((acc, category) => {
            acc[category.id] = category.defaultLevel;
            return acc;
        }, {} as { [key: string]: number }))
    };
    sessionStorage.setItem("wasManuallyDisconnected", "true");
    localStorage.removeItem("plaid_access_token_info");
    set({
      transactions: [],
      savedTransactions: null,
      impactAnalysis: null,
      connectionStatus: { isConnected: false, error: null },
      appStatus: "idle",
      hasSavedData: false,
      userValueSettings: defaultSettings,
      valuesCommittedUntil: null,
    });
  },

  disconnectBank: () => get().resetState(),

  fetchTransactions: async (accessToken) => {
    const { appStatus } = get();
    if (appStatus !== "idle" && appStatus !== "error" && appStatus !== "initializing" && appStatus !== "loading_settings") return;
    set({ appStatus: "fetching_plaid", connectionStatus: { ...get().connectionStatus, error: null } });
    let tokenToUse = accessToken;
    try {
      if (!tokenToUse) {
        const storedData = localStorage.getItem("plaid_access_token_info");
        if (!storedData) throw new Error("No access token available");
        const tokenInfo = JSON.parse(storedData) as StoredTokenInfo;
        if (!auth.currentUser || tokenInfo.userId !== auth.currentUser.uid) {
          throw new Error("Invalid access token for current user.");
        }
        tokenToUse = tokenInfo.token;
      }
      const authHeaders = await getAuthHeader();
      if (!authHeaders) throw new Error("User not authenticated.");
      const response = await fetch("/api/banking/transactions", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ access_token: tokenToUse }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error?.includes("ITEM_LOGIN_REQUIRED")) get().resetState();
        throw new Error(errorData.details || errorData.error || "Plaid fetch failed");
      }
      const rawPlaidTransactions = await response.json();
      const mappedTransactions = mapPlaidTransactions(rawPlaidTransactions);
      set({ connectionStatus: { isConnected: true, error: null } });
      await get().analyzeAndCacheTransactions(mappedTransactions);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load transactions";
      set({ appStatus: "error", connectionStatus: { isConnected: false, error: errorMessage } });
    }
  },

  manuallyFetchTransactions: () => get().fetchTransactions(),

  analyzeAndCacheTransactions: async (incomingTransactions) => {
    if (analysisLock.current) {
      console.log("analyzeAndCacheTransactions: Skipping, analysis already in progress.");
      return;
    }
    
    try {
        analysisLock.current = true;
        set({ appStatus: "analyzing" });

        if (!incomingTransactions || incomingTransactions.length === 0) {
            get().setTransactions([]);
            return;
        }

        const { savedTransactions: currentSavedTx, userValueSettings } = get();
        const baseTransactions = currentSavedTx || [];
        const mergedInitialTransactions = mergeTransactions(baseTransactions, incomingTransactions);

        const transactionsToProcess = mergedInitialTransactions.map(tx => ({ ...tx, analyzed: tx.analyzed ?? false }));
        const processedTxMap = new Map<string | null, Transaction>(transactionsToProcess.map(tx => [getTransactionIdentifier(tx), tx]));
        const transactionsForApi: Transaction[] = [];

        const cacheLookupPromises = transactionsToProcess
            .filter(tx => !tx.analyzed)
            .map(async (tx) => {
                const normalizedName = normalizeVendorName(tx.name);
                if (normalizedName !== "unknown_vendor") {
                    try {
                        const cachedData = await getVendorAnalysis(normalizedName);
                        if (cachedData) {
                            const txId = getTransactionIdentifier(tx);
                            const updatedTx: Transaction = {
                                ...tx,
                                analyzed: true,
                                ...cachedData,
                            };
                            processedTxMap.set(txId, updatedTx);
                            return;
                        }
                    } catch (e) { console.error(`Cache lookup error for ${tx.name}:`, e); }
                }
                transactionsForApi.push(tx);
            });
        await Promise.all(cacheLookupPromises);

        if (transactionsForApi.length > 0) {
            const authHeaders = await getAuthHeader();
            if (!authHeaders) throw new Error("User not authenticated for analysis.");
            const response = await fetch("/api/analysis", {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ transactions: transactionsForApi }),
            });
            if (!response.ok) throw new Error(`Analysis API Error: ${response.status}`);
            
            const analysisResponse = await response.json() as ApiAnalysisResponse;
            if (!analysisResponse.transactions) throw new Error("Invalid API response");

            const apiResultsMap = new Map<string, ApiAnalysisResultItem>();
            analysisResponse.transactions.forEach(aTx => {
                if(aTx.plaidTransactionId) apiResultsMap.set(`plaid-${aTx.plaidTransactionId}`, aTx);
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
                        const vendorData = { ...finalTx, originalName: finalTx.name, analysisSource: 'gemini' as const };
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
            await get().saveTransactionBatch(finalTransactions);
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
    if (!currentUser) throw new Error("User not logged in for save.");
    const { userValueSettings } = get();
    try {
        const authHeaders = await getAuthHeader();
        if (!authHeaders) throw new Error("User not authenticated for saving batch.");
        
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
        if (!sanitizedPayload) throw new Error("Failed to sanitize payload.");

        const response = await fetch("/api/transactions/save", {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(sanitizedPayload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Save Batch API Error: ${response.status}`);
        }
    } catch (error) {
        console.error("Error saving batch via API:", error);
        throw error;
    }
  },

  loadLatestTransactions: async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return false;
    
    if (sessionStorage.getItem("wasManuallyDisconnected") === "true") {
      set({ connectionStatus: { isConnected: false, error: null } });
      return false;
    }
    
    set({ appStatus: "loading_latest", hasSavedData: false, savedTransactions: null });
    
    try {
        const authHeaders = await getAuthHeader();
        if (!authHeaders) throw new Error("User not authenticated.");
        const response = await fetch("/api/transactions/latest", { headers: authHeaders });
        
        if (response.status === 404) {
            set({ hasSavedData: false, transactions: [], impactAnalysis: null });
            return false;
        }
        if (!response.ok) throw new Error(`Load Latest API Error: ${response.status}`);
        
        const data = await response.json();
        const batch = data.batch;

        if (batch && batch.transactions) {
            const loadedTransactions = (batch.transactions as Transaction[]).map(tx => ({ ...tx, analyzed: tx.analyzed ?? true }));
            const analysis = calculationService.calculateImpactAnalysis(loadedTransactions, get().userValueSettings);
            set({
                transactions: loadedTransactions,
                savedTransactions: loadedTransactions,
                impactAnalysis: analysis,
                hasSavedData: true,
                connectionStatus: { isConnected: true, error: null },
            });
            return true;
        } else {
             set({ hasSavedData: false, transactions: [], impactAnalysis: null });
             return false;
        }
    } catch (error) {
        set({ appStatus: "error", connectionStatus: { isConnected: false, error: error instanceof Error ? error.message : "Failed to load" } });
        return false;
    } finally {
        if (get().appStatus === "loading_latest") set({ appStatus: "idle" });
    }
  },

  initializeStore: async (user: User | null) => {
    if (!user) {
        get().resetState();
        return;
    }
    set({ appStatus: "initializing" });
    try {
        await get().initializeUserValueSettings(user.uid);
        const loadedFromFirebase = await get().loadLatestTransactions();
        if (!loadedFromFirebase) {
            const storedData = localStorage.getItem("plaid_access_token_info");
            if (storedData) {
                const tokenInfo = JSON.parse(storedData) as StoredTokenInfo;
                if (tokenInfo.userId === user.uid) {
                    await get().fetchTransactions(tokenInfo.token);
                } else {
                    set({ connectionStatus: { isConnected: false, error: null } });
                }
            } else {
                 set({ connectionStatus: { isConnected: false, error: null } });
            }
        }
    } catch (error) {
        set({ appStatus: "error", connectionStatus: { isConnected: false, error: error instanceof Error ? error.message : "Initialization failed" } });
    } finally {
        if (get().appStatus === "initializing") set({ appStatus: "idle" });
    }
},

  initializeUserValueSettings: async (userId) => {
    set({ appStatus: "loading_settings" });
    try {
      const userSettingsRef = doc(db, "userValueSettings", userId);
      const docSnap = await getDoc(userSettingsRef);
      const settingsToSet: UserValueSettings = {
        levels: VALUE_CATEGORIES.reduce((acc, category) => ({ ...acc, [category.id]: category.defaultLevel }), {}),
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
      const oldLevel = userValueSettings.levels[categoryId];
      if (newLevel === oldLevel) return;

      const newLevels = { ...userValueSettings.levels };
      const change = newLevel - (oldLevel || 0);
      let currentTotal = Object.values(newLevels).reduce((sum, level) => sum + level, 0);
      
      newLevels[categoryId] = newLevel;
      currentTotal += change;

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
      get().setTransactions(transactions); // Recalculate impact

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
    const categoryDefinition = VALUE_CATEGORIES.find(cat => cat.name === practiceCategoryName);
    if (!categoryDefinition) return 1.0;
    const userLevel = userValueSettings.levels[categoryDefinition.id] || NEUTRAL_LEVEL;
    return NEGATIVE_PRACTICE_MULTIPLIERS[userLevel] ?? 1.0;
  },

  resetUserValuesToDefault: async (userId: string) => {
    const defaultSettings = {
        levels: VALUE_CATEGORIES.reduce((acc, cat) => ({...acc, [cat.id]: cat.defaultLevel}), {}),
        order: VALUE_CATEGORIES.map(cat => cat.id),
        valuesHash: createValuesHash(VALUE_CATEGORIES.reduce((acc, cat) => ({...acc, [cat.id]: cat.defaultLevel}), {}))
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