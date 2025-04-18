// src/features/analysis/transactionAnalysisService.ts
import OpenAI from "openai";
// Import necessary types from @google/genai
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Tool, FinishReason } from "@google/genai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  Transaction,
  AnalyzedTransactionData,
} from "@/shared/types/transactions";
import { transactionAnalysisPrompt } from "./promptTemplates";
import { config } from "@/config";
import { calculationService } from "@/core/calculations/impactService";

// Interfaces remain the same...
interface AnalysisResultTransaction extends Partial<Transaction> {
  citations?: Record<string, string>;
}
interface AnalysisResponse {
  transactions: AnalysisResultTransaction[];
}

// Type Guard (keep for error handling)
interface ErrorWithDetails extends Error {
    errorDetails: unknown;
}
function hasErrorDetails(error: unknown): error is ErrorWithDetails {
    return typeof error === 'object' && error !== null && 'errorDetails' in error;
}


export async function analyzeTransactionsViaAPI(
  transactionsToAnalyze: Transaction[]
): Promise<AnalysisResultTransaction[]> {
  if (!Array.isArray(transactionsToAnalyze) || transactionsToAnalyze.length === 0) {
    console.log("analyzeTransactionsViaAPI: No transactions provided for API call.");
    return [];
  }

  const sanitizedTransactions = transactionsToAnalyze.map((tx) => ({
        plaidTransactionId: tx.plaidTransactionId,
        date: tx.date || "N/A",
        name: tx.name || "Unknown Merchant",
        amount: typeof tx.amount === "number" ? tx.amount : 0,
        plaidCategories: tx.plaidCategories || [],
        location: tx.location || []
      }));
  const userMessage = JSON.stringify({ transactions: sanitizedTransactions });
  const systemPrompt = transactionAnalysisPrompt;
  let messageContent = "";
  let modelUsed = "";

  try {
    if (config.analysisProvider === 'gemini') {
      // *** GEMINI NON-STREAMING LOGIC ***
      if (!config.gemini.apiKey) { throw new Error("Gemini API key missing."); }

      const genAI = new GoogleGenAI({apiKey: config.gemini.apiKey});
      modelUsed = config.gemini.previewModel;

      // Define config components
      const tools: Tool[] = [{ googleSearch: {} }]; // Use documented structure
      const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        ];
      // NOTE: User specified 'text/plain' earlier, but we need JSON. Reverting.
      const contents = [ { role: "user", parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] } ];

      console.log(
        `analyzeTransactionsViaAPI: Sending ${transactionsToAnalyze.length} txs to Gemini model: ${modelUsed} (Non-Streaming, Search Enabled)`
      );

      // CORRECTED Non-Streaming API CALL using the 'config' parameter
      const result = await genAI.models.generateContent({
          model: modelUsed,
          contents: contents,
          // Group optional settings under the 'config' object
          config: {
              tools: tools,
              safetySettings: safetySettings,
              responseMimeType: 'text/plain'
          }
      });


      // RESPONSE HANDLING
      console.log("Gemini Raw Result Object:", JSON.stringify(result, null, 2));

      // *** CORRECTED Access to feedback/finish reasons ***
      // Access directly from 'result' or 'result.response' based on actual object structure seen in logs
      // The logs showed candidates directly on result, let's assume promptFeedback might be too.
      const finishReason = result?.candidates?.[0]?.finishReason; // Finish reason is on the candidate
      const safetyRatings = result?.candidates?.[0]?.safetyRatings; // Safety ratings are on the candidate
      const blockReason = result?.promptFeedback?.blockReason; // Prompt feedback might be directly on result
      console.log("Gemini Prompt Feedback (raw):", JSON.stringify(result?.promptFeedback, null, 2)); // Log promptFeedback presence

      if (blockReason) {
           console.error(`Gemini response blocked for prompt. Reason: ${blockReason}`);
      }
      // Also check candidate finish reason for safety/other blocks
      if (finishReason && finishReason !== FinishReason.STOP && finishReason !== FinishReason.MAX_TOKENS) {
           console.error(`Gemini response candidate finished unexpectedly. Reason: ${finishReason}`);
           console.error(`Safety Ratings: ${JSON.stringify(safetyRatings)}`);
      }
      // *** END CORRECTION ***

      // Extract text directly from the result structure shown in logs
      messageContent = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";


      // *** RESTORED Error Logic ***
      if (!messageContent) {
        console.error("Gemini returned empty messageContent. Full result object logged above.");
        let errorMessage = "Gemini returned empty content";
        if (blockReason) {
            errorMessage += ` (Prompt blocked: ${blockReason})`;
        } else if (finishReason && finishReason !== FinishReason.STOP && finishReason !== FinishReason.MAX_TOKENS) {
             errorMessage += ` (Generation stopped: ${finishReason})`;
        } else {
            errorMessage += " (Check logs for potential issues)";
        }
        throw new Error(errorMessage);
      }
      // *** END RESTORED Error Logic ***
      // *** END GEMINI LOGIC ***


    } else {
      // *** OPENAI LOGIC (Existing - Non-Streaming) ***
      if (!config.openai.apiKey) {
        throw new Error("OpenAI API key missing.");
      }
      const openai = new OpenAI({
        apiKey: config.openai.apiKey,
        timeout: config.openai.timeout || 170000, // OpenAI SDK uses timeout option
      });
      modelUsed = config.openai.webSearchEnabled
        ? "gpt-4o-search-preview"
        : config.openai.model;

      console.log(
        `analyzeTransactionsViaAPI: Sending ${transactionsToAnalyze.length} txs to OpenAI model: ${modelUsed}`
      );

      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ];
      const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
        {
          model: modelUsed,
          messages: messages,
          response_format: { type: "json_object" },
        };

      const rawResponse = await openai.chat.completions.create(
        completionParams
      );
      messageContent = rawResponse.choices[0]?.message?.content || "";

      if (!messageContent) {
        throw new Error("OpenAI returned empty content.");
      }
      // *** END OPENAI LOGIC ***
    }

    // *** COMMON PARSING LOGIC *** (Remains the same)
    let jsonString = messageContent.trim();
    // Remove potential markdown code fences first
    if (jsonString.startsWith("```json")) {
      jsonString = jsonString.substring(7, jsonString.length - 3).trim();
    } else if (jsonString.startsWith("```")) {
      jsonString = jsonString.substring(3, jsonString.length - 3).trim();
    }

    const firstBrace = jsonString.indexOf("{");
    const lastBrace = jsonString.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) {
      console.error("Raw Aggregated API Response Content:", messageContent); // Log raw content on failure
      throw new Error(
        `Could not find valid JSON object boundaries in ${config.analysisProvider} response.`
      );
    }
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);

    let analyzedData: AnalysisResponse;
    try {
      analyzedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error(
        `JSON parsing error in analyzeTransactionsViaAPI (${config.analysisProvider}):`,
        parseError
      );
      console.error("Attempted to parse:", jsonString); // Log the string that failed parsing
      throw new Error(
        `Failed to parse JSON from ${config.analysisProvider}: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`
      );
    }

    if (
      !analyzedData.transactions ||
      !Array.isArray(analyzedData.transactions)
    ) {
      throw new Error(
        `${config.analysisProvider} response format invalid: 'transactions' array missing/invalid.`
      );
    }

    return analyzedData.transactions;
  } catch (error) {
    // *** UPDATED ERROR HANDLING using Type Guard ***
    if (hasErrorDetails(error)) { // Use the type guard function
      // Inside this block, TypeScript knows 'error' has 'errorDetails'
      console.error("Gemini Error Details:", JSON.stringify(error.errorDetails, null, 2)); // Access directly, stringify for better logging
    } else if (error instanceof Error) {
        // Standard error logging if it doesn't have details
        console.error(`Error during ${config.analysisProvider} API call (${modelUsed}):`, error.message);
        console.error("Stack trace:", error.stack);
    } else {
        // Fallback for non-Error objects
        console.error(`An unknown error occurred during ${config.analysisProvider} API call (${modelUsed}):`, error);
    }
    // *** END UPDATED ERROR HANDLING ***
    throw error; // Re-throw error for the API handler
  }
}

// --- processTransactionList function remains unchanged ---
export function processTransactionList(
  transactions: Transaction[]
): AnalyzedTransactionData {
  // ... (keep existing implementation) ...

  if (!Array.isArray(transactions)) {
    console.warn("processTransactionList: Received invalid input.");
    return {
      transactions: [],
      totalPositiveImpact: 0,
      totalNegativeImpact: 0,
      totalSocietalDebt: 0,
      debtPercentage: 0,
    };
  }

  const processedList = transactions.map((tx) => ({
    ...tx,
    analyzed: tx.analyzed ?? false,
  }));

  const positiveImpact =
    calculationService.calculatePositiveImpact(processedList);
  const negativeImpact =
    calculationService.calculateNegativeImpact(processedList);
  const totalSocietalDebt = negativeImpact;
  const debtPercentage =
    calculationService.calculateDebtPercentage(processedList);

  const updatedTransactions = processedList.map((t) => {
    let transactionSocietalDebt = 0;
    const practiceWeights = t.practiceWeights || {};
    const amount = t.amount || 0;
    const unethicalPractices = Array.isArray(t.unethicalPractices)
      ? t.unethicalPractices
      : [];
    const ethicalPractices = Array.isArray(t.ethicalPractices)
      ? t.ethicalPractices
      : [];

    unethicalPractices.forEach((practice) => {
      const weight = practiceWeights[practice] ?? 0;
      if (!isNaN(weight)) transactionSocietalDebt += amount * (weight / 100);
    });
    ethicalPractices.forEach((practice) => {
      const weight = practiceWeights[practice] ?? 0;
      if (!isNaN(weight)) transactionSocietalDebt -= amount * (weight / 100);
    });
    // Ensure societalDebt is calculated correctly, even if negative (ethical surplus)
    return {
      ...t,
      societalDebt: isNaN(transactionSocietalDebt)
        ? 0
        : transactionSocietalDebt,
    };
  });

  return {
    transactions: updatedTransactions,
    totalPositiveImpact: positiveImpact,
    totalNegativeImpact: negativeImpact,
    totalSocietalDebt: totalSocietalDebt,
    debtPercentage,
  };
}
