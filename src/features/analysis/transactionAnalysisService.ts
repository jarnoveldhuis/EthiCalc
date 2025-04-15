// src/features/analysis/transactionAnalysisService.ts
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  Transaction,
  AnalyzedTransactionData, // Keep this type for the expected structure from OpenAI
} from "@/shared/types/transactions";
import { transactionAnalysisPrompt } from "./promptTemplates";
import { config } from "@/config";
import { calculationService } from "@/core/calculations/impactService";
// --- Removed Firestore/Vendor imports ---

// Interface for the expected raw OpenAI JSON structure
interface OpenAIResponseTransaction extends Partial<Transaction> {
  citations?: Record<string, string>;
  // Include other fields expected directly from OpenAI based on your prompt
}
interface OpenAIResponse {
  transactions: OpenAIResponseTransaction[];
}

/**
 * Calls OpenAI API to analyze transactions. Does NOT interact with Firestore cache.
 * Returns the raw analysis results from OpenAI.
 */
export async function analyzeTransactionsViaAPI(
  transactionsToAnalyze: Transaction[]
): Promise<OpenAIResponseTransaction[]> {
  if (!Array.isArray(transactionsToAnalyze) || transactionsToAnalyze.length === 0) {
    console.log("analyzeTransactionsViaAPI: No transactions provided for API call.");
    return []; // Return empty array if nothing to send
  }

  const openai = new OpenAI({
      apiKey: config.openai.apiKey,
      timeout: config.openai.timeout || 170000,
  });
  const modelToUse = config.openai.webSearchEnabled
      ? "gpt-4o-search-preview"
      : config.openai.model;

  console.log(`analyzeTransactionsViaAPI: Sending ${transactionsToAnalyze.length} txs to OpenAI model: ${modelToUse}`);

  try {
      // Prepare data for OpenAI API
      const sanitizedTransactions = transactionsToAnalyze.map((tx) => ({
          plaidTransactionId: tx.plaidTransactionId,
          date: tx.date || "N/A",
          name: tx.name || "Unknown Merchant", // Use tx.name
          amount: typeof tx.amount === "number" ? tx.amount : 0,
          plaidCategories: tx.plaidCategories || [],
          location: tx.location || []
      }));

      const systemPrompt = transactionAnalysisPrompt;
      const userMessage = JSON.stringify({ transactions: sanitizedTransactions });

      const messages: ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
      ];

      // Make the API call
      const completionParams = {
         model: modelToUse,
         messages: messages,
         // response_format: { type: "json_object" }, // Optional
      };
      const rawResponse = await openai.chat.completions.create(completionParams);

      const responseMessage = rawResponse.choices[0]?.message;
      const messageContent = responseMessage?.content || "";

      if (!messageContent) {
          throw new Error("OpenAI returned empty content.");
      }

      // Robust JSON Parsing
      let jsonString = messageContent.trim();
        if (jsonString.startsWith("```json")) {
        jsonString = jsonString.substring(7, jsonString.length - 3).trim();
      } else if (jsonString.startsWith("```")) {
        jsonString = jsonString.substring(3, jsonString.length - 3).trim();
      }
      const firstBrace = jsonString.indexOf("{");
      const lastBrace = jsonString.lastIndexOf("}");
      if (firstBrace === -1 || lastBrace <= firstBrace) {
         throw new Error("Could not find valid JSON object boundaries in OpenAI response.");
      }
      jsonString = jsonString.substring(firstBrace, lastBrace + 1);

      let analyzedData: OpenAIResponse;
      try {
          analyzedData = JSON.parse(jsonString);
      } catch (parseError) {
          console.error("JSON parsing error in analyzeTransactionsViaAPI:", parseError);
          console.error("Attempted to parse:", jsonString);
          throw new Error(`Failed to parse JSON from OpenAI: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      if (!analyzedData.transactions || !Array.isArray(analyzedData.transactions)) {
          throw new Error("OpenAI response format invalid: 'transactions' array missing/invalid.");
      }
      console.log(`analyzeTransactionsViaAPI: Received ${analyzedData.transactions.length} analyzed objects from OpenAI.`);

      // Return the raw transaction analysis objects from OpenAI
      return analyzedData.transactions;

  } catch (error) {
      console.error("Error during OpenAI API call:", error);
      // Re-throw the error to be handled by the caller (e.g., the API route handler)
      throw error instanceof Error ? error : new Error("Core OpenAI analysis failed unexpectedly.");
  }
}


/**
 * Processes a list of transactions (potentially mixed analyzed/unanalyzed)
 * to calculate final aggregate impact data using calculationService.
 * This can be used client-side after merging cache/API results.
 */
export function processTransactionList(
  transactions: Transaction[]
): AnalyzedTransactionData {
  if (!Array.isArray(transactions)) {
    console.warn("processTransactionList: Received invalid input.");
    return { transactions: [], totalPositiveImpact: 0, totalNegativeImpact: 0, totalSocietalDebt: 0, debtPercentage: 0 };
  }

  // Ensure all transactions have 'analyzed' flag (default to false if missing)
  const processedList = transactions.map(tx => ({...tx, analyzed: tx.analyzed ?? false}));

  // Use calculationService for all aggregate calculations
  const positiveImpact = calculationService.calculatePositiveImpact(processedList);
  const negativeImpact = calculationService.calculateNegativeImpact(processedList);
  const totalSocietalDebt = negativeImpact; // Raw negative impact sum
  const debtPercentage = calculationService.calculateDebtPercentage(processedList);

   // Optional: Recalculate per-transaction debt ONLY if needed for display downstream
   const updatedTransactions = processedList.map((t) => {
       let transactionSocietalDebt = 0;
       const practiceWeights = t.practiceWeights || {};
       const amount = t.amount || 0;
       const unethicalPractices = Array.isArray(t.unethicalPractices) ? t.unethicalPractices : [];
       const ethicalPractices = Array.isArray(t.ethicalPractices) ? t.ethicalPractices : [];

       unethicalPractices.forEach((practice) => {
         const weight = practiceWeights[practice] ?? 0;
         if (!isNaN(weight)) transactionSocietalDebt += amount * (weight / 100);
       });
       ethicalPractices.forEach((practice) => {
          const weight = practiceWeights[practice] ?? 0;
           if (!isNaN(weight)) transactionSocietalDebt -= amount * (weight / 100);
       });
       return { ...t, societalDebt: isNaN(transactionSocietalDebt) ? 0 : transactionSocietalDebt };
   });

  // Return the final analysis object structure
  return {
    transactions: updatedTransactions,
    totalPositiveImpact: positiveImpact,
    totalNegativeImpact: negativeImpact,
    totalSocietalDebt: totalSocietalDebt,
    debtPercentage,
  };
}