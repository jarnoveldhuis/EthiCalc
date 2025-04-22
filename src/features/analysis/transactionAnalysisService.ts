// src/features/analysis/transactionAnalysisService.ts
import OpenAI from "openai";
// Import necessary types from @google/genai
import { GoogleGenAI, Tool, FinishReason } from "@google/genai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { z } from 'zod'; // Import Zod
import {
  Transaction,
  AnalyzedTransactionData,
  // Removed unused Charity type import
} from "@/shared/types/transactions";
import { transactionAnalysisPrompt } from "./promptTemplates";
import { config } from "@/config";
import { calculationService } from "@/core/calculations/impactService";

// --- Zod Schema Definition for LLM Response ---

// Schema for the Charity object within the response
// Keep CharitySchema definition even if Charity type import is removed
const CharitySchema = z.object({
    name: z.string(),
    url: z.string().url() // Validate URL format
});

// Schema for a single transaction object within the LLM response
const AnalysisResultTransactionSchema = z.object({
  plaidTransactionId: z.string().min(1, { message: "plaidTransactionId is required" }),
  date: z.string().optional(),
  name: z.string().optional(),
  amount: z.number().optional(),
  // FIX: Removed .nullable() to match expected 'number | undefined' type
  societalDebt: z.number().optional(),
  unethicalPractices: z.array(z.string()).optional().default([]),
  ethicalPractices: z.array(z.string()).optional().default([]),
  practiceWeights: z.record(z.number()).optional().default({}),
  practiceDebts: z.record(z.number()).optional().default({}),
  practiceSearchTerms: z.record(z.string()).optional().default({}),
  practiceCategories: z.record(z.string()).optional().default({}),
  charities: z.record(CharitySchema).optional().default({}),
  information: z.record(z.string()).optional().default({}),
  citations: z.record(z.array(z.string().url().or(z.string().startsWith('/')).or(z.literal(""))))
                 .optional().default({})
                 .catch({})
}).passthrough();

// Schema for the overall analysis response structure
const AnalysisResponseSchema = z.object({
  transactions: z.array(AnalysisResultTransactionSchema)
                 .min(1, { message: "LLM response must contain at least one transaction" }),
});

// Removed unused ValidatedAnalysisResponse type alias

// Define the return type based on the validated structure's transaction part
// This now correctly infers societalDebt as 'number | undefined'
type AnalysisResultTransaction = z.infer<typeof AnalysisResultTransactionSchema>;

// --- End Zod Schema Definition ---


// Type Guard (keep for error handling)
interface ErrorWithDetails extends Error {
    errorDetails: unknown;
}
function hasErrorDetails(error: unknown): error is ErrorWithDetails {
    return typeof error === 'object' && error !== null && 'errorDetails' in error;
}


export async function analyzeTransactionsViaAPI(
  transactionsToAnalyze: Transaction[]
): Promise<AnalysisResultTransaction[]> { // Return type uses the Zod inferred type
  if (!Array.isArray(transactionsToAnalyze) || transactionsToAnalyze.length === 0) {
    console.log("analyzeTransactionsViaAPI: No transactions provided for API call.");
    return [];
  }

  // Sanitize input
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
      // *** GEMINI LOGIC ***
      if (!config.gemini.apiKey) { throw new Error("Gemini API key missing."); }
      const genAI = new GoogleGenAI({apiKey: config.gemini.apiKey});
      modelUsed = config.gemini.previewModel;
      const tools: Tool[] = [{ googleSearch: {} }];
      const contents = [ { role: "user", parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] } ]; // Use \n\n for newline
      console.log(`analyzeTransactionsViaAPI: Sending ${transactionsToAnalyze.length} txs to Gemini model: ${modelUsed} (Non-Streaming, Search Enabled)`);
      const result = await genAI.models.generateContent({
          model: modelUsed, contents: contents, config: { tools: tools, responseMimeType: 'text/plain' }
      });
      console.log("Gemini Raw Result Object:", JSON.stringify(result, null, 2));
      const finishReason = result?.candidates?.[0]?.finishReason;
      const safetyRatings = result?.candidates?.[0]?.safetyRatings;
      const blockReason = result?.promptFeedback?.blockReason;
      console.log("Gemini Prompt Feedback (raw):", JSON.stringify(result?.promptFeedback, null, 2));
      if (blockReason) { console.error(`Gemini response blocked for prompt. Reason: ${blockReason}`); }
      if (finishReason && finishReason !== FinishReason.STOP && finishReason !== FinishReason.MAX_TOKENS) {
           console.error(`Gemini response candidate finished unexpectedly. Reason: ${finishReason}`);
           console.error(`Safety Ratings: ${JSON.stringify(safetyRatings)}`);
      }
      messageContent = result?.candidates?.[0]?.content?.parts?.map(part => part.text).join('') || "";
      if (!messageContent) {
        console.error("Gemini returned empty messageContent.");
        let errorMessage = "Gemini returned empty content";
        if (blockReason) { errorMessage += ` (Prompt blocked: ${blockReason})`; }
        else if (finishReason && finishReason !== FinishReason.STOP && finishReason !== FinishReason.MAX_TOKENS) { errorMessage += ` (Generation stopped: ${finishReason})`; }
        else { errorMessage += " (Check logs)"; }
        throw new Error(errorMessage);
      }
      // *** END GEMINI LOGIC ***

    } else {
      // *** OPENAI LOGIC ***
      if (!config.openai.apiKey) { throw new Error("OpenAI API key missing."); }
      const openai = new OpenAI({ apiKey: config.openai.apiKey, timeout: config.openai.timeout || 170000 });
      modelUsed = config.openai.webSearchEnabled ? "gpt-4o-search-preview" : config.openai.model;
      console.log(`analyzeTransactionsViaAPI: Sending ${transactionsToAnalyze.length} txs to OpenAI model: ${modelUsed}`);
      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ];
      const completionParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model: modelUsed, messages: messages, response_format: { type: "json_object" },
      };
      const rawResponse = await openai.chat.completions.create(completionParams);
      messageContent = rawResponse.choices[0]?.message?.content || "";
      if (!messageContent) { throw new Error("OpenAI returned empty content."); }
      // *** END OPENAI LOGIC ***
    }

    // *** UPDATED PARSING & VALIDATION LOGIC ***
    let jsonString = messageContent.trim();
    jsonString = jsonString.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const firstBrace = jsonString.indexOf("{");
    const lastBrace = jsonString.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) {
      console.error("Raw API Response:", messageContent);
      throw new Error(`Could not find JSON boundaries in ${config.analysisProvider} response.`);
    }
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(jsonString);
    } catch (parseError) {
      console.error(`JSON parsing error (${config.analysisProvider}):`, parseError);
      console.error("Attempted to parse:", jsonString);
      throw new Error(`Failed to parse JSON from ${config.analysisProvider}. Content: "${jsonString.substring(0,100)}...". Error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    const validationResult = AnalysisResponseSchema.safeParse(parsedJson);
    if (!validationResult.success) {
        console.error(`LLM Response Validation Failed (${config.analysisProvider}):`, validationResult.error.flatten());
        console.error("Parsed JSON that failed:", JSON.stringify(parsedJson, null, 2));
        throw new Error(`LLM response validation failed. Issues: ${JSON.stringify(validationResult.error.flatten())}`);
    }
    const validatedData = validationResult.data;
    console.log(`analyzeTransactionsViaAPI: Parsed and validated response from ${config.analysisProvider}.`);
    return validatedData.transactions;
    // *** END UPDATED PARSING & VALIDATION LOGIC ***

  } catch (error) {
    if (hasErrorDetails(error)) { console.error("Gemini Error Details:", JSON.stringify(error.errorDetails, null, 2)); }
    else if (error instanceof Error) { console.error(`Error during ${config.analysisProvider} API call/processing (${modelUsed}):`, error.message, error.stack); }
    else { console.error(`Unknown error during ${config.analysisProvider} API call (${modelUsed}):`, error); }
    throw error;
  }
}

// --- processTransactionList function remains unchanged ---
export function processTransactionList(
  transactions: Transaction[]
): AnalyzedTransactionData {

  if (!Array.isArray(transactions)) {
    console.warn("processTransactionList: Invalid input.");
    return { transactions: [], totalPositiveImpact: 0, totalNegativeImpact: 0, totalSocietalDebt: 0, debtPercentage: 0 };
  }

  const processedList = transactions.map((tx) => ({
    ...tx,
    analyzed: tx.analyzed ?? false,
    unethicalPractices: tx.unethicalPractices ?? [],
    ethicalPractices: tx.ethicalPractices ?? [],
    practiceWeights: tx.practiceWeights ?? {},
    practiceSearchTerms: tx.practiceSearchTerms ?? {},
    practiceCategories: tx.practiceCategories ?? {},
    information: tx.information ?? {},
    citations: typeof tx.citations === 'object' && tx.citations !== null
      ? Object.entries(tx.citations).reduce((acc, [key, value]) => {
          const urls = Array.isArray(value) ? value.map(String) : (value ? [String(value)] : []);
          // Filter out empty strings and ensure they are valid URLs or relative paths before adding
          acc[key] = urls.filter(url => typeof url === 'string' && url.length > 0 && (url.startsWith('http') || url.startsWith('/')));
          return acc;
        }, {} as Record<string, string[]>)
      : {},
  }));

  const positiveImpact = calculationService.calculatePositiveImpact(processedList);
  const negativeImpact = calculationService.calculateNegativeImpact(processedList);
  const totalSocietalDebt = negativeImpact;
  const debtPercentage = calculationService.calculateDebtPercentage(processedList);

  const updatedTransactions = processedList.map((t) => {
    let transactionSocietalDebt = 0;
    const practiceWeights = t.practiceWeights || {};
    const amount = t.amount || 0;
    (t.unethicalPractices || []).forEach((practice) => {
      const weight = practiceWeights[practice] ?? 0;
      if (!isNaN(weight)) transactionSocietalDebt += amount * (weight / 100);
    });
    (t.ethicalPractices || []).forEach((practice) => {
      const weight = practiceWeights[practice] ?? 0;
      if (!isNaN(weight)) transactionSocietalDebt -= amount * (weight / 100);
    });
    return { ...t, societalDebt: isNaN(transactionSocietalDebt) ? 0 : transactionSocietalDebt };
  });

  return {
    transactions: updatedTransactions,
    totalPositiveImpact: positiveImpact,
    totalNegativeImpact: negativeImpact,
    totalSocietalDebt: totalSocietalDebt,
    debtPercentage,
  };
}