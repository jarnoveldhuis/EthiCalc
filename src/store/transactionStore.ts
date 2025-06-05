// src/store/transactionStore.ts

import { create } from "zustand";
import { Transaction, Charity, Citation } from "@/shared/types/transactions";
import { ImpactAnalysis } from "@/core/calculations/type";
import { calculationService } from "@/core/calculations/impactService";
import { User } from "firebase/auth";
import { auth, db } from "@/core/firebase/firebase";
import { Timestamp, doc, getDoc, setDoc } from "firebase/firestore";
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
import { firebaseDebug } from "@/core/firebase/debugUtils";
import {
  VALUE_CATEGORIES,
  NEUTRAL_LEVEL,
  NEGATIVE_PRACTICE_MULTIPLIERS,
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

export type UserValueSettings = { [categoryId: string]: number };

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
  commitUserValues: (userId: string) => Promise<void>;
}

function getTransactionIdentifier(transaction: Transaction): string | null { /* ... (no change) ... */
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
function sanitizeDataForFirestore<T>(data: T): T | null { /* ... (no change) ... */
  if (data === undefined) return null;
  if (data === null || typeof data !== "object") {
      return data;
  }
  if (data instanceof Timestamp) {
      return data;
  }
  if (Array.isArray(data)) {
      return data.map(item => sanitizeDataForFirestore(item)).filter(item => item !== undefined) as T;
  }
  const sanitizedObject: { [key: string]: unknown } = {};
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
const getAuthHeader = async (): Promise<HeadersInit | null> => { /* ... (no change) ... */
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
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  savedTransactions: null,
  impactAnalysis: null,
  connectionStatus: { isConnected: false, error: null },
  appStatus: "idle",
  hasSavedData: false,
  userValueSettings: VALUE_CATEGORIES.reduce((acc, category) => {
    acc[category.id] = category.defaultLevel;
    return acc;
  }, {} as UserValueSettings),
  valuesCommittedUntil: null,

  setTransactions: (transactions) => {
    const currentUserValueSettings = get().userValueSettings;
    const analysis = calculationService.calculateImpactAnalysis(transactions, currentUserValueSettings);
    set({ transactions: transactions, impactAnalysis: analysis });
  },

  connectBank: async (publicToken, user) => { /* ... (previous version with type-safe error handling) ... */
    const { appStatus } = get();
    if (!user || (appStatus !== "idle" && appStatus !== "error")) return;
    set({ appStatus: "connecting_bank", connectionStatus: { isConnected: false, error: null }});
    let exchangedToken: string | null = null;
    try {
      const authHeaders = await getAuthHeader();
      if (!authHeaders) throw new Error("User not authenticated for token exchange.");
      const response = await fetch("/api/banking/exchange_token", { method: "POST", headers: authHeaders, body: JSON.stringify({ public_token: publicToken })});
      const data = await response.json();
      if (!response.ok || !data.access_token) throw new Error(data.error || `Token exchange failed (${response.status})`);
      exchangedToken = data.access_token;
      const tokenInfo: StoredTokenInfo = { token: exchangedToken!, userId: user.uid, timestamp: Date.now() };
      localStorage.setItem("plaid_access_token_info", JSON.stringify(tokenInfo));
      set((state) => ({ connectionStatus: { ...state.connectionStatus, isConnected: true, error: null }, appStatus: "idle" }));
      try { sessionStorage.removeItem("wasManuallyDisconnected"); } catch (e: unknown) { console.error(e instanceof Error ? e.message : String(e)); }
      console.log("connectBank: Token exchanged, fetching transactions...");
      await get().fetchTransactions(exchangedToken ?? undefined);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to connect bank";
      console.error("Error connecting bank:", errorMessage, error);
      set({ appStatus: "error", connectionStatus: { isConnected: false, error: errorMessage }});
    }
  },

  resetState: () => { /* ... (no change from previous correct version) ... */
    console.log("TransactionStore: resetState triggered.");
    const defaultSettings = VALUE_CATEGORIES.reduce((acc, category) => {
      acc[category.id] = category.defaultLevel;
      return acc;
    }, {} as UserValueSettings);
    try { sessionStorage.setItem("wasManuallyDisconnected", "true"); } catch (e: unknown) { console.error(e instanceof Error ? e.message : String(e)); }
    try { localStorage.removeItem("plaid_access_token_info"); } catch (e: unknown) { console.error(e instanceof Error ? e.message : String(e)); }
    set({
      transactions: [], savedTransactions: null, impactAnalysis: null,
      connectionStatus: { isConnected: false, error: null },
      appStatus: "idle", hasSavedData: false, userValueSettings: defaultSettings, valuesCommittedUntil: null,
    });
  },
  disconnectBank: () => { get().resetState(); },

  fetchTransactions: async (accessToken) => {
    const { appStatus } = get();
    if (appStatus !== 'idle' && appStatus !== 'error' && appStatus !== 'initializing' && appStatus !== 'loading_settings') {
      console.log(`fetchTransactions: Skipping (Current Status: ${appStatus}).`); return;
    }
    set({ appStatus: 'fetching_plaid', connectionStatus: { ...get().connectionStatus, error: null } });
    let tokenToUse: string | null = accessToken || null;
    const currentUserId = auth.currentUser?.uid;
    try {
      const authHeaders = await getAuthHeader();
      if (!authHeaders) throw new Error("User not authenticated for fetching transactions.");
      if (!tokenToUse) {
        const storedData = localStorage.getItem('plaid_access_token_info');
        if (!storedData) throw new Error('No access token available');
        try {
          const tokenInfo = JSON.parse(storedData) as StoredTokenInfo;
          if (!currentUserId || tokenInfo.userId !== currentUserId) {
            localStorage.removeItem('plaid_access_token_info');
            throw new Error('Invalid access token for current user.');
          }
          tokenToUse = tokenInfo.token;
        } catch (parseError: unknown) { // UPDATED
          localStorage.removeItem('plaid_access_token_info');
          const errorMsg = parseError instanceof Error ? parseError.message : "Error parsing stored Plaid token";
          console.error("Error parsing stored Plaid token:", errorMsg, parseError);
          throw new Error('Failed to read stored access token.');
        }
      }
      if(!tokenToUse) throw new Error("Access token missing after checks.");
      firebaseDebug.log('PLAID_FETCH', { status: 'starting', tokenPresent: !!tokenToUse });
      const response = await fetch('/api/banking/transactions', { method: 'POST', headers: authHeaders, body: JSON.stringify({ access_token: tokenToUse }) });
      firebaseDebug.log('PLAID_FETCH', { status: 'response_received', ok: response.ok, statusCode: response.status });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        firebaseDebug.log('PLAID_FETCH', { status: 'error_response', errorData });
        if (errorData.error?.includes('ITEM_LOGIN_REQUIRED')) {
          get().resetState();
          throw new Error('Bank connection expired. Please reconnect.');
        }
        throw new Error(`Plaid fetch failed: ${response.status} ${errorData.details || errorData.error || 'Unknown Plaid error'}`);
      }
      const rawPlaidTransactions = await response.json();
      firebaseDebug.log('PLAID_FETCH', { status: 'data_received', count: rawPlaidTransactions?.length });
      const mappedTransactions = mapPlaidTransactions(rawPlaidTransactions);
      if (!Array.isArray(mappedTransactions)) throw new Error('Invalid mapped transaction data format');
      set(state => ({ connectionStatus: { ...state.connectionStatus, isConnected: true, error: mappedTransactions.length === 0 ? 'No transactions found' : null }}));
      await get().analyzeAndCacheTransactions(mappedTransactions);
    } catch (error: unknown) { // UPDATED
      const errorMessage = error instanceof Error ? error.message : String(error ?? 'Failed to load transactions');
      console.error('Error in fetchTransactions:', errorMessage, error);
      firebaseDebug.log('PLAID_FETCH', { status: 'catch_error', error: errorMessage });
      const isTokenError = errorMessage.includes('No access token') || errorMessage.includes('expired') || errorMessage.includes('Invalid access token');
      set(state => ({ appStatus: 'error', connectionStatus: { isConnected: isTokenError ? false : state.connectionStatus.isConnected, error: errorMessage }}));
    }
  },

  manuallyFetchTransactions: async () => { /* ... (no change, relies on fetchTransactions) ... */
    const { appStatus } = get();
    if (appStatus !== 'idle' && appStatus !== 'error') return;
    try {
      await get().fetchTransactions();
    } catch (error: unknown) {
      console.error("Manual fetch error:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  },

  analyzeAndCacheTransactions: async (incomingTransactions) => { /* ... (previous version with type-safe error handling in cache lookup) ... */
    const { appStatus, savedTransactions: currentSavedTx, userValueSettings } = get();
    if (appStatus !== 'fetching_plaid' && appStatus !== 'idle' && appStatus !== 'error' && appStatus !== 'initializing' && appStatus !== 'loading_settings') {
        console.log(`analyzeAndCacheTransactions: Skipping (Current Status: ${appStatus}).`); return;
    }
    if (!incomingTransactions || incomingTransactions.length === 0) {
        const analysis = calculationService.calculateImpactAnalysis([], userValueSettings);
        set({ appStatus: "idle", transactions: [], savedTransactions: [], impactAnalysis: analysis, connectionStatus: { ...get().connectionStatus, isConnected: true, error: "No transactions found after fetch." } });
        return;
    }
    set({ appStatus: "analyzing", connectionStatus: { ...get().connectionStatus, error: null } });
    firebaseDebug.log("ANALYSIS", { status: "starting", incomingCount: incomingTransactions.length });
    const baseTransactions = currentSavedTx || [];
    const mergedInitialTransactions = mergeTransactions(baseTransactions, incomingTransactions);
    const transactionsToProcess = mergedInitialTransactions.map(tx => ({ ...tx, analyzed: tx.analyzed ?? false }));
    const transactionsForApi: Transaction[] = [];
    const transactionsFromCache: Transaction[] = [];
    const processedTxMap = new Map<string | null, Transaction>(transactionsToProcess.filter(tx => tx.analyzed).map(tx => [getTransactionIdentifier(tx), tx]));
    firebaseDebug.log('ANALYSIS_CACHE', { status: 'starting_lookup', count: transactionsToProcess.filter(tx => !tx.analyzed).length });
    const cacheLookupPromises = transactionsToProcess.filter(tx => !tx.analyzed).map(async (tx) => {
        const normalizedName = normalizeVendorName(tx.name);
        if (normalizedName !== "unknown_vendor") {
            try {
                const cachedData = await getVendorAnalysis(normalizedName);
                return { tx, cachedData };
            } catch (e: unknown) { // UPDATED
                console.error(`Cache lookup error for ${tx.name}:`, e instanceof Error ? e.message : String(e));
                return { tx, cachedData: null };
            }
        }
        return { tx, cachedData: null };
    });
    const cacheResults = await Promise.all(cacheLookupPromises);
    firebaseDebug.log('ANALYSIS_CACHE', { status: 'lookup_complete', resultsCount: cacheResults.length });
    cacheResults.forEach(({ tx, cachedData }) => {
        const txId = getTransactionIdentifier(tx);
        if (cachedData) {
            const updatedTx: Transaction = { ...tx, analyzed: true, unethicalPractices: cachedData.unethicalPractices || [], ethicalPractices: cachedData.ethicalPractices || [], practiceWeights: cachedData.practiceWeights || {}, practiceSearchTerms: cachedData.practiceSearchTerms || {}, practiceCategories: cachedData.practiceCategories || {}, information: cachedData.information || {}, citations: cachedData.citations || {} };
            transactionsFromCache.push(updatedTx);
            processedTxMap.set(txId, updatedTx);
        } else {
            if (!processedTxMap.has(txId) || !processedTxMap.get(txId)?.analyzed) {
                transactionsForApi.push(tx);
                if (!processedTxMap.has(txId)) { processedTxMap.set(txId, tx); }
            }
        }
    });
    firebaseDebug.log("ANALYSIS", { cacheHits: transactionsFromCache.length, alreadyAnalyzed: transactionsToProcess.filter(tx => tx.analyzed).length - transactionsFromCache.length, needingApi: transactionsForApi.length });
    let analysisError: Error | null = null;
    try {
        if (transactionsForApi.length > 0) {
            firebaseDebug.log('ANALYSIS_API', { status: 'calling', count: transactionsForApi.length });
            const authHeaders = await getAuthHeader();
            if (!authHeaders) throw new Error("User not authenticated for analysis.");
            const response = await fetch("/api/analysis", { method: "POST", headers: authHeaders, body: JSON.stringify({ transactions: transactionsForApi }) });
            firebaseDebug.log('ANALYSIS_API', { status: 'response_received', ok: response.ok, statusCode: response.status });
            if (!response.ok) { const errData = await response.json().catch(() => ({})); throw new Error(errData.error || `Analysis API Error: ${response.status}`); }
            const analysisResponse = await response.json() as ApiAnalysisResponse;
            if (!analysisResponse || !Array.isArray(analysisResponse.transactions)) throw new Error("Invalid API response format");
            firebaseDebug.log('ANALYSIS_API', { status: 'data_received', count: analysisResponse.transactions.length });
            const openAiResultsMap = new Map<string, ApiAnalysisResultItem>();
            analysisResponse.transactions.forEach(aTx => { if (aTx.plaidTransactionId) openAiResultsMap.set(`plaid-${aTx.plaidTransactionId}`, aTx); else if (aTx.name) { const originalTxForApi = transactionsForApi.find(t => t.name === aTx.name); if (originalTxForApi && originalTxForApi.plaidTransactionId) { openAiResultsMap.set(`plaid-${originalTxForApi.plaidTransactionId}`, aTx);}}});
            set({ appStatus: "saving_cache" });
            transactionsForApi.forEach(originalTx => {
                const txId = getTransactionIdentifier(originalTx);
                const apiResult = txId ? openAiResultsMap.get(txId) : null;
                if (txId && apiResult) {
                    const finalTx: Transaction = { ...originalTx, analyzed: true, societalDebt: apiResult.societalDebt, unethicalPractices: apiResult.unethicalPractices || [], ethicalPractices: apiResult.ethicalPractices || [], practiceWeights: apiResult.practiceWeights || {}, practiceDebts: apiResult.practiceDebts || {}, practiceSearchTerms: apiResult.practiceSearchTerms || {}, practiceCategories: apiResult.practiceCategories || {}, charities: apiResult.charities || {}, information: apiResult.information || {}, citations: apiResult.citations || {} };
                    processedTxMap.set(txId, finalTx);
                    const normName = normalizeVendorName(finalTx.name);
                    if (normName !== "unknown_vendor") {
                        const vendorData: Omit<VendorAnalysis, 'analyzedAt'> = { originalName: finalTx.name, analysisSource: config.analysisProvider as 'openai' | 'gemini', unethicalPractices: finalTx.unethicalPractices ?? [], ethicalPractices: finalTx.ethicalPractices ?? [], practiceWeights: finalTx.practiceWeights ?? {}, practiceSearchTerms: finalTx.practiceSearchTerms ?? {}, practiceCategories: finalTx.practiceCategories ?? {}, information: finalTx.information ?? {}, citations: finalTx.citations ?? {} };
                        saveVendorAnalysis(normName, vendorData).then(() => firebaseDebug.log('ANALYSIS_CACHE_SAVE', { status: 'success', vendor: normName })).catch(err => firebaseDebug.log('ANALYSIS_CACHE_SAVE', { status: 'error', vendor: normName, error: err.message }));
                    }
                } else { if (txId) processedTxMap.set(txId, { ...originalTx, analyzed: false }); }
            });
        }
        const finalTransactions = Array.from(processedTxMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const latestUserValueSettings = get().userValueSettings;
        const finalImpact = calculationService.calculateImpactAnalysis(finalTransactions, latestUserValueSettings);
        set({ transactions: finalTransactions, savedTransactions: finalTransactions, impactAnalysis: finalImpact, appStatus: "idle", connectionStatus: { ...get().connectionStatus, error: null }, hasSavedData: true });
        firebaseDebug.log("ANALYSIS", { status: "complete", finalCount: finalTransactions.length });
        if (finalTransactions.length > 0) { get().saveTransactionBatch(finalTransactions).catch(err => console.error("Background saveTransactionBatch failed:", err));}
    } catch (error: unknown) { // UPDATED
        analysisError = error instanceof Error ? error : new Error(String(error));
        console.error("Error during analysis orchestration:", analysisError.message, analysisError);
        firebaseDebug.log("ANALYSIS", { status: "error", error: analysisError.message });
        set({ appStatus: "error", connectionStatus: { ...get().connectionStatus, error: analysisError.message || "Analysis failed" }});
    } finally {
      const finalStatus = get().appStatus;
      if (finalStatus === "saving_cache" || finalStatus === "analyzing") { set({ appStatus: analysisError ? 'error' : 'idle' });}
    }
  },

  saveTransactionBatch: async (transactionsToSave) => { /* ... (previous version with type-safe error handling) ... */
    const { appStatus, userValueSettings } = get();
    if (appStatus === 'saving_batch') return;
    if (!transactionsToSave || transactionsToSave.length === 0) { console.log("Save Batch: No transactions to save."); return; }
    const currentUser = auth.currentUser;
    if (!currentUser) { console.error("Save Batch Error: User not logged in."); return; }
    set({ appStatus: 'saving_batch' });
    firebaseDebug.log('SAVE_BATCH_API', { status: 'starting', count: transactionsToSave.length });
    try {
        const authHeaders = await getAuthHeader();
        if (!authHeaders) throw new Error("User not authenticated for saving batch.");
        const finalizedTransactions = transactionsToSave.map(tx => ({ ...tx, analyzed: tx.analyzed ?? true }));
        const analysisForSave = calculationService.calculateImpactAnalysis(finalizedTransactions, userValueSettings);
        const batchPayload = { analyzedData: { transactions: finalizedTransactions, totalSocietalDebt: analysisForSave.negativeImpact, debtPercentage: analysisForSave.debtPercentage, totalPositiveImpact: analysisForSave.positiveImpact, totalNegativeImpact: analysisForSave.negativeImpact }};
        const sanitizedPayload = sanitizeDataForFirestore(batchPayload);
        if (!sanitizedPayload) throw new Error("Failed to sanitize payload for Firestore.");
        firebaseDebug.log('SAVE_BATCH_API', { status: 'calling', userId: currentUser.uid });
        const response = await fetch('/api/transactions/save', { method: 'POST', headers: authHeaders, body: JSON.stringify(sanitizedPayload) });
        firebaseDebug.log('SAVE_BATCH_API', { status: 'response_received', ok: response.ok, statusCode: response.status });
        if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(errorData.error || `Save Batch API Error: ${response.status}`);}
        const result = await response.json();
        set({ hasSavedData: true });
        firebaseDebug.log('SAVE_BATCH_API', { status: 'success', result });
    } catch (error: unknown) { // UPDATED
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error saving batch via API:', errorMessage, error);
        firebaseDebug.log('SAVE_BATCH_API', { status: 'error', error: errorMessage });
        set(state => ({ appStatus: 'error', connectionStatus: { ...state.connectionStatus, error: state.connectionStatus.error ?? 'Failed to save batch history' }}));
    } finally { if (get().appStatus === 'saving_batch') { set({ appStatus: 'idle' }); }
    }
  },

  loadLatestTransactions: async (): Promise<boolean> => { /* ... (previous version with type-safe error handling) ... */
    const currentUser = auth.currentUser;
    if (!currentUser) { console.log("loadLatestTransactions: No user."); set({ appStatus: 'idle', transactions: [], savedTransactions: null, impactAnalysis: null }); return false; }
    const userId = currentUser.uid;
    let wasManuallyDisconnected = false;
    try { wasManuallyDisconnected = sessionStorage.getItem("wasManuallyDisconnected") === "true"; } catch {}
    if (wasManuallyDisconnected) { set({ appStatus: 'idle', connectionStatus: { isConnected: false, error: "Manually disconnected." }}); return false; }
    const { appStatus } = get();
    if (appStatus !== 'idle' && appStatus !== 'error' && appStatus !== 'initializing') { console.log(`loadLatestTransactions: Skipping (Status: ${appStatus})`); return get().hasSavedData; }
    set({ appStatus: 'loading_latest', hasSavedData: false, savedTransactions: null, connectionStatus: { ...get().connectionStatus, error: null } });
    firebaseDebug.log('LOAD_LATEST', { status: 'starting', userId });
    let success = false;
    try {
        const authHeaders = await getAuthHeader();
        if (!authHeaders) throw new Error("User not authenticated.");
        const response = await fetch('/api/transactions/latest', { method: 'GET', headers: authHeaders });
        firebaseDebug.log('LOAD_LATEST', { status: 'response_received', ok: response.ok, statusCode: response.status });
        if (response.status === 404) {
            firebaseDebug.log('LOAD_LATEST', { status: 'no_data_found' });
            set({ hasSavedData: false, savedTransactions: null, transactions: [], impactAnalysis: null, appStatus: 'idle' }); success = false; return success;
        }
        if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(errorData.error || `Load Latest API Error: ${response.status}`);}
        const data = await response.json();
        const batch = data.batch;
        if (batch && batch.transactions) {
            const loadedTransactions = (batch.transactions as Transaction[]).map(tx => ({ ...tx, analyzed: tx.analyzed ?? true }));
            if (!Array.isArray(loadedTransactions)) throw new Error("Invalid data format in loaded batch");
            firebaseDebug.log('LOAD_LATEST', { status: 'data_received', count: loadedTransactions.length });
            const currentUserValueSettings = get().userValueSettings;
            const analysis = calculationService.calculateImpactAnalysis(loadedTransactions, currentUserValueSettings);
            firebaseDebug.log('LOAD_LATEST', { status: 'impact_calculated', analysis });
            set({ transactions: loadedTransactions, savedTransactions: loadedTransactions, impactAnalysis: analysis, hasSavedData: true, connectionStatus: { isConnected: true, error: null }, appStatus: 'idle' });
            success = true;
        } else {
            firebaseDebug.log('LOAD_LATEST', { status: 'no_batch_data' });
            set({ hasSavedData: false, savedTransactions: null, transactions: [], impactAnalysis: null, appStatus: 'idle' }); success = false;
        }
    } catch (error: unknown) { // UPDATED
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ loadLatestTransactions Error:', errorMessage, error);
        firebaseDebug.log('LOAD_LATEST', { status: 'error', error: errorMessage });
        set(state => ({ appStatus: 'error', connectionStatus: { ...state.connectionStatus, error: errorMessage || 'Failed to load saved data' }, hasSavedData: false, savedTransactions: null }));
        success = false;
    } finally { if (get().appStatus === 'loading_latest') { set({ appStatus: success ? 'idle' : 'error' }); } }
    return success;
  },

  initializeStore: async (user: User | null) => { /* ... (previous version with type-safe error handling) ... */
    const { appStatus, resetState } = get();
    if (!user) { resetState(); return; }
    if (appStatus !== 'idle' && appStatus !== 'error') { console.log(`initializeStore: Skipping (Status: ${appStatus})`); return; }
    let wasManuallyDisconnected = false;
    try { wasManuallyDisconnected = sessionStorage.getItem("wasManuallyDisconnected") === "true"; } catch (e: unknown) { console.error(e instanceof Error ? e.message : String(e)); }
    if (wasManuallyDisconnected) { set({ appStatus: 'idle', connectionStatus: { isConnected: false, error: "Manually disconnected." }}); try { localStorage.removeItem("plaid_access_token_info"); } catch(e: unknown){console.error(e instanceof Error ? e.message : String(e))} return; }
    set({ appStatus: 'initializing', connectionStatus: { ...get().connectionStatus, error: null } });
    firebaseDebug.log('INITIALIZE', { status: 'starting', userId: user.uid });
    try {
        await get().initializeUserValueSettings(user.uid);
        firebaseDebug.log('INITIALIZE', { status: 'settings_initialized' });
        const loadedFromFirebase = await get().loadLatestTransactions();
        firebaseDebug.log('INITIALIZE', { status: 'load_latest_complete', success: loadedFromFirebase });
        if (!loadedFromFirebase) {
            let hasValidStoredToken = false, tokenToFetch: string | null = null;
            try {
                const storedData = localStorage.getItem("plaid_access_token_info");
                if (storedData) { const tokenInfo = JSON.parse(storedData) as StoredTokenInfo; if (tokenInfo.userId === user.uid) { hasValidStoredToken = true; tokenToFetch = tokenInfo.token; } else { localStorage.removeItem("plaid_access_token_info"); }}
            } catch (e: unknown) { localStorage.removeItem("plaid_access_token_info"); console.error(e instanceof Error ? e.message : String(e)); }
            firebaseDebug.log('INITIALIZE', { status: 'token_check_complete', hasToken: hasValidStoredToken });
            if (hasValidStoredToken && tokenToFetch) {
                firebaseDebug.log('INITIALIZE', { status: 'no_firebase_data_fetching_fresh' });
                await get().fetchTransactions(tokenToFetch);
                firebaseDebug.log('INITIALIZE', { status: 'finished_after_fresh_fetch' });
            } else {
                firebaseDebug.log('INITIALIZE', { status: 'finished_no_data_no_token' });
                if (get().transactions.length === 0) { set({ impactAnalysis: calculationService.calculateImpactAnalysis([], get().userValueSettings) }); }
                set(state => ({ connectionStatus: { ...state.connectionStatus, isConnected: false, error: null }, appStatus: 'idle' }));
            }
        } else {
            set(state => ({ connectionStatus: { ...state.connectionStatus, isConnected: true, error: null } }));
            firebaseDebug.log('INITIALIZE', { status: 'finished_with_firebase_data' });
        }
    } catch (error: unknown) { // UPDATED
        const errorMessage = error instanceof Error ? error.message : "Initialization failed";
        console.error("❌ initializeStore Error:", errorMessage, error);
        firebaseDebug.log('INITIALIZE', { status: 'error', error: errorMessage });
        set({ appStatus: 'error', connectionStatus: { isConnected: false, error: errorMessage } });
    } finally { if (get().appStatus === 'initializing') { set({ appStatus: 'idle' }); } firebaseDebug.log('INITIALIZE', { status: 'finally_complete', finalAppStatus: get().appStatus });}
  },

  initializeUserValueSettings: async (userId) => { /* ... (previous version with type-safe error handling) ... */
    set({ appStatus: "loading_settings" });
    try {
        const userSettingsRef = doc(db, "userValueSettings", userId);
        const docSnap = await getDoc(userSettingsRef);
        let settingsToSet = VALUE_CATEGORIES.reduce((acc, category) => { acc[category.id] = category.defaultLevel; return acc; }, {} as UserValueSettings);
        let committedUntilDate: Timestamp | null = null;
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && data.userValueSettings) { const fetchedSettings = data.userValueSettings; settingsToSet = VALUE_CATEGORIES.reduce((acc, category) => { acc[category.id] = fetchedSettings[category.id] !== undefined ? fetchedSettings[category.id] : category.defaultLevel; return acc;}, {} as UserValueSettings);}
            if (data && data.valuesCommittedUntil) { committedUntilDate = data.valuesCommittedUntil as Timestamp; }
        } else { await setDoc(userSettingsRef, { userValueSettings: settingsToSet, valuesCommittedUntil: null }, { merge: true }); }
        set({ userValueSettings: settingsToSet, valuesCommittedUntil: committedUntilDate, appStatus: "idle" });
        const { transactions } = get();
        if (transactions.length > 0) { const analysis = calculationService.calculateImpactAnalysis(transactions, settingsToSet); set({ impactAnalysis: analysis });}
        firebaseDebug.log("INIT_USER_SETTINGS", { status: "User value settings initialized/loaded.", userId, settings: settingsToSet, committedUntil: committedUntilDate });
    } catch (error: unknown) { // UPDATED
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error initializing user value settings:", errorMessage, error);
        firebaseDebug.log("INIT_USER_SETTINGS_ERROR", { userId, error: errorMessage });
        set({ appStatus: "error" });
    } finally { if (get().appStatus === 'loading_settings') { set({ appStatus: 'idle' });}}
  },

  updateUserValue: async (userId, categoryId, newLevel) => { /* ... (previous version with type-safe error handling) ... */
    if (!userId) { console.warn("updateUserValue: No userId provided."); return; }
    const currentSettings = get().userValueSettings;
    const updatedSettings = { ...currentSettings, [categoryId]: newLevel };
    set({ userValueSettings: updatedSettings, appStatus: "saving_settings" });
    const { transactions } = get();
    const analysis = calculationService.calculateImpactAnalysis(transactions, updatedSettings);
    set({ impactAnalysis: analysis });
    try {
        const userSettingsRef = doc(db, "userValueSettings", userId);
        await setDoc(userSettingsRef, { userValueSettings: updatedSettings }, { merge: true });
        set({ appStatus: "idle" });
        firebaseDebug.log("UPDATE_USER_VALUE", { status: "User value updated and saved.", userId, categoryId, newLevel });
    } catch (error: unknown) { // UPDATED
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error saving user value settings:", errorMessage, error);
        firebaseDebug.log("UPDATE_USER_VALUE_ERROR", { userId, categoryId, newLevel, error: errorMessage });
        set({ appStatus: "error" });
    }
  },

  getUserValueMultiplier: (practiceCategoryName) => { /* ... (no change) ... */
    if (!practiceCategoryName) return 1.0;
    const userValueSettings = get().userValueSettings;
    const categoryDefinition = VALUE_CATEGORIES.find(catDef => catDef.name === practiceCategoryName);
    if (!categoryDefinition) return 1.0;
    const userLevel = userValueSettings[categoryDefinition.id] || NEUTRAL_LEVEL;
    return NEGATIVE_PRACTICE_MULTIPLIERS[userLevel] ?? 1.0;
  },

  resetUserValuesToDefault: async (userId: string) => { /* ... (previous version with type-safe error handling) ... */
    const defaultSettings = VALUE_CATEGORIES.reduce((acc, category) => { acc[category.id] = category.defaultLevel; return acc; }, {} as UserValueSettings);
    set({ userValueSettings: defaultSettings, appStatus: "saving_settings", valuesCommittedUntil: null });
    const { transactions } = get();
    const analysis = calculationService.calculateImpactAnalysis(transactions, defaultSettings);
    set({ impactAnalysis: analysis });
    try {
        const userSettingsRef = doc(db, "userValueSettings", userId);
        await setDoc(userSettingsRef, { userValueSettings: defaultSettings, valuesCommittedUntil: null }, { merge: true });
        set({ appStatus: "idle" });
        firebaseDebug.log("RESET_USER_VALUES", { status: "User value settings reset to default.", userId });
    } catch (error: unknown) { // UPDATED
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error resetting user value settings:", errorMessage, error);
        firebaseDebug.log("RESET_USER_VALUES_ERROR", { userId, error: errorMessage });
        set({ appStatus: "error" });
    }
  },

  commitUserValues: async (userId: string) => { /* ... (previous version with type-safe error handling) ... */
    set({ appStatus: "saving_settings" });
    try {
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const endOfMonthTimestamp = Timestamp.fromDate(endOfMonth);
        const userSettingsRef = doc(db, "userValueSettings", userId);
        await setDoc(userSettingsRef, { valuesCommittedUntil: endOfMonthTimestamp }, { merge: true });
        set({ valuesCommittedUntil: endOfMonthTimestamp, appStatus: "idle" });
        firebaseDebug.log("COMMIT_USER_VALUES", { status: "User values committed.", userId, commitUntil: endOfMonth.toISOString() });
    } catch (error: unknown) { // UPDATED
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Error committing user values:", errorMessage, error);
        firebaseDebug.log("COMMIT_USER_VALUES_ERROR", { userId, error: errorMessage });
        set({ appStatus: "error" });
    }
  },
}));