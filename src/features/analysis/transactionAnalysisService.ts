// src/features/analysis/transactionAnalysisService.ts
import OpenAI from "openai";
// Import necessary types from @google/genai
import { GoogleGenAI, Tool, FinishReason } from "@google/genai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  Transaction,
  AnalyzedTransactionData,
} from "@/shared/types/transactions";
import { transactionAnalysisPrompt } from "./promptTemplates"; // Make sure this has the updated prompt
import { config } from "@/config";
import { calculationService } from "@/core/calculations/impactService";

// --- MODIFIED Interface ---
// Update the 'citations' type to expect an array of strings
interface AnalysisResultTransaction extends Partial<Transaction> {
  citations?: Record<string, string[]>; // Changed from string to string[]
}
interface AnalysisResponse {
  transactions: AnalysisResultTransaction[];
}
// --- End MODIFIED Interface ---

// Type Guard (keep for error handling)
interface ErrorWithDetails extends Error {
    errorDetails: unknown;
}
function hasErrorDetails(error: unknown): error is ErrorWithDetails {
    return typeof error === 'object' && error !== null && 'errorDetails' in error;
}


export async function analyzeTransactionsViaAPI(
  transactionsToAnalyze: Transaction[]
): Promise<AnalysisResultTransaction[]> { // Return type uses the updated interface
  if (!Array.isArray(transactionsToAnalyze) || transactionsToAnalyze.length === 0) {
    console.log("analyzeTransactionsViaAPI: No transactions provided for API call.");
    return [];
  }

  // Sanitize input (no changes needed here)
  const sanitizedTransactions = transactionsToAnalyze.map((tx) => ({
        plaidTransactionId: tx.plaidTransactionId,
        date: tx.date || "N/A",
        name: tx.name || "Unknown Merchant",
        amount: typeof tx.amount === "number" ? tx.amount : 0,
        plaidCategories: tx.plaidCategories || [],
        location: tx.location || []
      }));
  const userMessage = JSON.stringify({ transactions: sanitizedTransactions });
  const systemPrompt = transactionAnalysisPrompt; // Ensure this uses your updated prompt
  let messageContent = "";
  let modelUsed = "";

  try {
    if (config.analysisProvider === 'gemini') {
      // *** GEMINI NON-STREAMING LOGIC ***
      if (!config.gemini.apiKey) { throw new Error("Gemini API key missing."); }

      const genAI = new GoogleGenAI({apiKey: config.gemini.apiKey});
      modelUsed = config.gemini.previewModel; // Or your chosen Gemini model

      const tools: Tool[] = [{ googleSearch: {} }];
      const contents = [ { role: "user", parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] } ];

      console.log(
        `analyzeTransactionsViaAPI: Sending ${transactionsToAnalyze.length} txs to Gemini model: ${modelUsed} (Non-Streaming, Search Enabled)`
      );

      // API CALL using the 'config' parameter
      const result = await genAI.models.generateContent({
          model: modelUsed,
          contents: contents,
          // Group optional settings under the 'config' object
          config: {
              tools: tools,
              // Keep as text/plain if application/json caused issues with grounding
              responseMimeType: 'text/plain'
          }
      });


      // RESPONSE HANDLING
      console.log("Gemini Raw Result Object:", JSON.stringify(result, null, 2));

      const finishReason = result?.candidates?.[0]?.finishReason;
      const safetyRatings = result?.candidates?.[0]?.safetyRatings;
      const blockReason = result?.promptFeedback?.blockReason;
      console.log("Gemini Prompt Feedback (raw):", JSON.stringify(result?.promptFeedback, null, 2));

      if (blockReason) {
           console.error(`Gemini response blocked for prompt. Reason: ${blockReason}`);
      }
      if (finishReason && finishReason !== FinishReason.STOP && finishReason !== FinishReason.MAX_TOKENS) {
           console.error(`Gemini response candidate finished unexpectedly. Reason: ${finishReason}`);
           console.error(`Safety Ratings: ${JSON.stringify(safetyRatings)}`);
      }

      // Extract text
      // Handle potentially multiple parts (though likely just one for non-streaming text)
      messageContent = result?.candidates?.[0]?.content?.parts
          ?.map(part => part.text)
          .join('') || "";


      if (!messageContent) {
        console.error("Gemini returned empty messageContent. Full result object logged above.");
        let errorMessage = "Gemini returned empty content";
        if (blockReason) { errorMessage += ` (Prompt blocked: ${blockReason})`; }
        else if (finishReason && finishReason !== FinishReason.STOP && finishReason !== FinishReason.MAX_TOKENS) { errorMessage += ` (Generation stopped: ${finishReason})`; }
        else { errorMessage += " (Check logs for potential issues)"; }
        throw new Error(errorMessage);
      }
      // *** END GEMINI LOGIC ***

    } else {
      // *** OPENAI LOGIC ***
      if (!config.openai.apiKey) { throw new Error("OpenAI API key missing."); }
      const openai = new OpenAI({
        apiKey: config.openai.apiKey,
        timeout: config.openai.timeout || 170000,
      });
      modelUsed = config.openai.webSearchEnabled ? "gpt-4o-search-preview" : config.openai.model;

      console.log(`analyzeTransactionsViaAPI: Sending ${transactionsToAnalyze.length} txs to OpenAI model: ${modelUsed}`);

      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ];
      const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model: modelUsed,
        messages: messages,
        response_format: { type: "json_object" },
      };

      const rawResponse = await openai.chat.completions.create(completionParams);
      messageContent = rawResponse.choices[0]?.message?.content || "";

      if (!messageContent) { throw new Error("OpenAI returned empty content."); }
      // *** END OPENAI LOGIC ***
    }

    // *** COMMON PARSING LOGIC ***
    // This robust parsing logic remains the same
    let jsonString = messageContent.trim();
    jsonString = jsonString.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, ''); // Remove fences

    const firstBrace = jsonString.indexOf("{");
    const lastBrace = jsonString.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) {
      console.error("Raw Aggregated API Response Content:", messageContent);
      throw new Error(`Could not find valid JSON object boundaries in ${config.analysisProvider} response after cleaning.`);
    }
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);

    let analyzedData: AnalysisResponse; // Uses the updated interface
    try {
      analyzedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error(`JSON parsing error in analyzeTransactionsViaAPI (${config.analysisProvider}):`, parseError);
      console.error("Attempted to parse:", jsonString);
      throw new Error(`Failed to parse JSON from ${config.analysisProvider}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    // --- Validation (Adjusted for new citations type) ---
    if (!analyzedData.transactions || !Array.isArray(analyzedData.transactions)) {
      throw new Error(`${config.analysisProvider} response format invalid: 'transactions' array missing/invalid.`);
    }

    // Optional: Add validation for the citations field within each transaction if needed
    // e.g., check if analyzedData.transactions[i].citations is an object where values are arrays of strings
    // This depends on how strict you need to be.

    // --- Return using the updated type ---
    return analyzedData.transactions;

  } catch (error) {
     // Error handling remains the same
    if (hasErrorDetails(error)) {
      console.error("Gemini Error Details:", JSON.stringify(error.errorDetails, null, 2));
    } else if (error instanceof Error) {
        console.error(`Error during ${config.analysisProvider} API call (${modelUsed}):`, error.message);
        console.error("Stack trace:", error.stack);
    } else {
        console.error(`An unknown error occurred during ${config.analysisProvider} API call (${modelUsed}):`, error);
    }
    throw error; // Re-throw error for the API handler
  }
}

// --- processTransactionList function remains unchanged ---
// This function calculates overall impact based on the *results* of the analysis
// It doesn't directly parse the raw API string, so it doesn't need modification
// for the citation format change unless you use citations in impact calculations.
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
    // Ensure citations is an array (or default if missing)
    // Note: This modification depends on if your Transaction type *itself*
    //       was updated to use string[] for citations. If Transaction still
    //       uses Record<string, string>, this mapping might be incorrect.
    //       Assuming Transaction type was also updated:
    citations: typeof tx.citations === 'object' && tx.citations !== null
      ? Object.entries(tx.citations).reduce((acc, [key, value]) => {
          acc[key] = Array.isArray(value) ? value : (value ? [String(value)] : []);
          return acc;
        }, {} as Record<string, string[]>)
      : {},
  }));

  const positiveImpact =
    calculationService.calculatePositiveImpact(processedList);
  const negativeImpact =
    calculationService.calculateNegativeImpact(processedList);
  const totalSocietalDebt = negativeImpact; // Using negativeImpact as total debt
  const debtPercentage =
    calculationService.calculateDebtPercentage(processedList);

  // Recalculate societalDebt per transaction based on weights
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