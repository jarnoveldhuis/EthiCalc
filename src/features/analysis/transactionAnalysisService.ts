// src/features/analysis/transactionAnalysisService.ts
import OpenAI from "openai";
import { Transaction, AnalyzedTransactionData } from "@/shared/types/transactions";
// Import the specific prompt template you are using (make sure it includes plaidTransactionId instructions)
import { transactionAnalysisPrompt } from "./promptTemplates";
import { config } from "@/config";
// import type { ChatCompletion } from "openai/resources/chat";
import { calculationService } from "@/core/calculations/impactService";

// --- Interfaces (keep as defined before) ---
interface Citation { url: string; title: string; start_index?: number; end_index?: number; }
interface OpenAIAnnotation { type: string; url_citation?: Citation; }
interface OpenAICompletionParams { model: string; messages: Array<{ role: "system" | "user" | "assistant"; content: string; }>; }
// interface CitationInfo { url: string; title: string; relevantPractice?: string; }
interface OpenAIResponse { transactions: Partial<Transaction>[]; } // Expecting OpenAI to return partial Transaction objects
// --- End Interfaces ---


// --- processCitationReferences (Keep as is if using citations) ---
const extractedCitations: Record<string, string> = {};
function processCitationReferences( info: Record<string, string> | undefined, annotations: OpenAIAnnotation[] | undefined ): Record<string, string> {
  const processed: Record<string, string> = {};
  if (!info) return processed;
    const citationUrls: string[] = [];
    if (annotations) {
        annotations.forEach(a => { if (a.type === 'url_citation' && a.url_citation?.url) citationUrls.push(a.url_citation.url); });
    }
    Object.entries(info).forEach(([key, value]) => {
        let processedValue = value;
        const turnSearchPattern = /\[CITATION:turn(\d+)search(\d+)\]/g;
        let i = 0;
        processedValue = processedValue.replace(turnSearchPattern, (match) => {
            if (i < citationUrls.length) { const url = citationUrls[i++]; extractedCitations[match] = url; return `[Source](${url})`; }
            return match;
        });
        Object.entries(extractedCitations).forEach(([ref, url]) => { processedValue = processedValue.replace(ref, `[Source](${url})`); });
        processed[key] = processedValue;
    });
  return processed;
}
// --- End processCitationReferences ---


/**
 * Core domain logic for analyzing transactions using OpenAI.
 */
export async function analyzeTransactionsCore(
  transactions: Transaction[] // Input should be Type 'Transaction' (with plaidTransactionId)
): Promise<AnalyzedTransactionData> {

  if (!Array.isArray(transactions) || transactions.length === 0) {
    console.warn("analyzeTransactionsCore: Received empty/invalid transaction array.");
    return { transactions: [], totalPositiveImpact: 0, totalNegativeImpact: 0, totalSocietalDebt: 0, debtPercentage: 0 };
  }

  // Filter transactions needing analysis (should already be filtered by caller, but safety check)
  const transactionsToAnalyze = transactions.filter((tx) => !tx.analyzed);

  if (transactionsToAnalyze.length === 0) {
    console.log("analyzeTransactionsCore: No transactions need analysis. Processing existing.");
    return processAnalyzedTransactions(transactions); // Process to ensure format consistency
  }

  // --- Create OpenAI client ---
  const openai = new OpenAI({
    apiKey: config.openai.apiKey,
    timeout: config.openai.timeout || 90000,
  });
  console.log(`analyzeTransactionsCore: Sending ${transactionsToAnalyze.length} txs to OpenAI: ${config.openai.model}`);

  try {
    // --- Prepare Sanitized Data for OpenAI ---
    const sanitizedTransactions = transactionsToAnalyze.map((tx) => ({
      // *** THIS IS THE FIX: Include the ID mapped previously ***
      plaidTransactionId: tx.plaidTransactionId, // Ensure this exists on tx object
      // *** END FIX ***
      date: tx.date || 'N/A',
      name: tx.name || 'Unknown Merchant',
      amount: typeof tx.amount === 'number' ? tx.amount : 0,
    }));

    // --- Prepare Prompt ---
    const systemPrompt = transactionAnalysisPrompt; // Ensure this prompt requests plaidTransactionId back
    const userMessage = JSON.stringify({ transactions: sanitizedTransactions });
    // --- OpenAI API Call ---
    const completionParams: OpenAICompletionParams = {
        model: config.openai.model,
        messages: [ { role: "system", content: systemPrompt }, { role: "user", content: userMessage } ],
        // response_format: { type: "json_object" }, // Enable if model supports JSON mode
    };
    const rawResponse = await openai.chat.completions.create(completionParams);
    console.log("rawResponse",rawResponse)
    // --- Process Response ---
    const responseMessage = rawResponse.choices[0]?.message;
    const messageContent = responseMessage?.content || "";

    if (!messageContent) { throw new Error("OpenAI returned empty content."); }

    // Robust JSON Parsing
    let jsonString = messageContent.trim();
    if (jsonString.startsWith("```json")) { jsonString = jsonString.substring(7, jsonString.length - 3).trim(); }
    else if (jsonString.startsWith("```")) { jsonString = jsonString.substring(3, jsonString.length - 3).trim(); }
    const firstBrace = jsonString.indexOf('{'); const lastBrace = jsonString.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace <= firstBrace) { throw new Error("Could not find JSON object in OpenAI response."); }
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);

    let analyzedData: OpenAIResponse;
    try { analyzedData = JSON.parse(jsonString); }
    catch (parseError) {
        console.error("JSON parsing error in analyzeTransactionsCore:", parseError);
        console.error("Raw OpenAI response content:", messageContent);
        throw new Error(`Failed to parse JSON from OpenAI. Error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    if (!analyzedData.transactions || !Array.isArray(analyzedData.transactions)) {
      throw new Error("OpenAI response format invalid: 'transactions' array missing/invalid.");
    }
    console.log(`analyzeTransactionsCore: Received ${analyzedData.transactions.length} analyzed transaction objects.`);

    // --- Merge OpenAI results with original data ---
    const analyzedTxMap = new Map<string, Partial<Transaction>>(); // Store partial results from AI
     analyzedData.transactions.forEach(analyzedTx => {
         const idFromAI = analyzedTx.plaidTransactionId;
         if (idFromAI) { analyzedTxMap.set(idFromAI, { ...analyzedTx, analyzed: true }); } // Mark analyzed
         else { console.warn("OpenAI tx missing plaidTransactionId:", analyzedTx.name); }
     });

     // Merge back with the original *full* transaction list passed to this function
     const finalTransactions = transactions.map(originalTx => {
         const originalId = originalTx.plaidTransactionId; // ID from the *input* tx object
         if (originalId && analyzedTxMap.has(originalId)) {
             const analyzedVersion = analyzedTxMap.get(originalId)!;
             // Combine original essential info with potentially partial AI analysis results
             return {
                 // Keep original core fields
                 date: originalTx.date,
                 name: originalTx.name,
                 amount: originalTx.amount,
                 plaidTransactionId: originalId, // Ensure ID persists
                 plaidCategories: originalTx.plaidCategories, // Keep original Plaid categories if mapped

                 // Add/overwrite with fields from AI analysis
                 societalDebt: analyzedVersion.societalDebt, // AI might recalculate this based on its analysis
                 unethicalPractices: analyzedVersion.unethicalPractices || [],
                 ethicalPractices: analyzedVersion.ethicalPractices || [],
                 practiceWeights: analyzedVersion.practiceWeights || {},
                 practiceDebts: analyzedVersion.practiceDebts || {},
                 practiceSearchTerms: analyzedVersion.practiceSearchTerms || {},
                 practiceCategories: analyzedVersion.practiceCategories || {},
                 charities: analyzedVersion.charities || {},
                 information: analyzedVersion.information || {},
                 analyzed: true // Mark definitively analyzed
             };
         } else {
             // If not analyzed, return original state, ensuring 'analyzed' is correctly false/undefined
             return { ...originalTx, analyzed: originalTx.analyzed ?? false };
         }
     });


    // --- Process final merged list ---
    console.log(`analyzeTransactionsCore: Merged into ${finalTransactions.length} txs. Processing final calculations...`);
    return processAnalyzedTransactions(finalTransactions);

  } catch (error) {
    console.error("Error during OpenAI analysis in analyzeTransactionsCore:", error);
    if (error instanceof Error && error.message.includes("API key")) { throw new Error("OpenAI API key error."); }
    throw error instanceof Error ? error : new Error("Core transaction analysis failed unexpectedly.");
  }
}


/**
 * Process analyzed/merged transactions: calculate societal debt per transaction and aggregate totals.
 */
export function processAnalyzedTransactions(
  transactions: Transaction[] // Receives the final merged list
): AnalyzedTransactionData {

  if (!Array.isArray(transactions)) {
     console.warn("processAnalyzedTransactions: Received invalid input.");
     return { transactions: [], totalPositiveImpact: 0, totalNegativeImpact: 0, totalSocietalDebt: 0, debtPercentage: 0 };
  }

  const updatedTransactions = transactions.map((t) => {
    // Calculate debt per transaction based on its own final practices/weights
    const practiceDebts: Record<string, number> = {};
    let transactionSocietalDebt = 0;
    const practiceWeights = t.practiceWeights || {};
    const amount = t.amount || 0;
    const unethicalPractices = Array.isArray(t.unethicalPractices) ? t.unethicalPractices : [];
    const ethicalPractices = Array.isArray(t.ethicalPractices) ? t.ethicalPractices : [];

    unethicalPractices.forEach((practice) => {
      const weight = practiceWeights[practice] ?? 0;
      const portion = amount * (weight / 100);
      if (!isNaN(portion)) { practiceDebts[practice] = portion; transactionSocietalDebt += portion; }
    });
    ethicalPractices.forEach((practice) => {
      const weight = practiceWeights[practice] ?? 0;
      const portion = -1 * (amount * (weight / 100));
      if (!isNaN(portion)) { practiceDebts[practice] = portion; transactionSocietalDebt += portion; }
    });

    // Ensure search terms exist (using default map)
    const practiceSearchTerms = t.practiceSearchTerms || {};
    const defaultMappings: Record<string, string> = {
        "Factory Farming": "animal welfare", "High Emissions": "climate",
        "Environmental Degradation": "conservation", "Water Waste": "water conservation",
        "Resource Depletion": "sustainability", "Data Privacy Issues": "digital rights",
        "Labor Exploitation": "workers rights", "Excessive Packaging": "environment",
        "Animal Testing": "animal rights", "High Energy Usage": "renewable energy",
         /* Add other mappings */
     };
    [...unethicalPractices, ...ethicalPractices].forEach(p => { if (!practiceSearchTerms[p]) practiceSearchTerms[p] = defaultMappings[p] || p.toLowerCase(); });

    // Process citations in information field if necessary
    const processedInformation = processCitationReferences(t.information, undefined /* Pass annotations here if available */);


    // Final object for this transaction
    const processedTx: Transaction = {
      date: t.date || 'N/A',
      name: t.name || 'Unknown',
      amount: amount,
      plaidTransactionId: t.plaidTransactionId, // Ensure ID is carried through
      plaidCategories: t.plaidCategories,
      societalDebt: transactionSocietalDebt, // Calculated debt for THIS transaction
      practiceDebts,
      analyzed: t.analyzed ?? true,
      unethicalPractices, ethicalPractices, practiceWeights,
      practiceSearchTerms,
      practiceCategories: t.practiceCategories || {},
      charities: t.charities || {},
      information: processedInformation,
       // Include other fields from Transaction type that might exist on 't'
       isCreditApplication: t.isCreditApplication,
       creditApplied: t.creditApplied,
    };
    return processedTx;
  });

  // --- Use calculationService for Aggregate Totals ---
  const positiveImpact = calculationService.calculatePositiveImpact(updatedTransactions);
  const negativeImpact = calculationService.calculateNegativeImpact(updatedTransactions);
  const debtPercentage = calculationService.calculateDebtPercentage(updatedTransactions);
  const totalSocietalDebtOnlyNegative = negativeImpact; // Use raw negative sum

  // console.log(`processAnalyzedTransactions: Final calculations - Pos: ${positiveImpact}, Neg: ${negativeImpact}, Debt%: ${debtPercentage}`);

  return {
    transactions: updatedTransactions,
    totalPositiveImpact: positiveImpact,
    totalNegativeImpact: negativeImpact,
    totalSocietalDebt: totalSocietalDebtOnlyNegative,
    debtPercentage,
  };
}