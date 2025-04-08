// src/features/analysis/transactionAnalysisService.ts
import OpenAI from "openai";
// Import the specific type for messages
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  Transaction,
  AnalyzedTransactionData,
} from "@/shared/types/transactions";
// Import the updated prompt text (ensure the variable points to the new prompt)
import { transactionAnalysisPrompt } from "./promptTemplates";
import { config } from "@/config"; // Import the config object
import { calculationService } from "@/core/calculations/impactService";

// Interface for the expected OpenAI JSON structure
interface OpenAIResponseTransaction extends Partial<Transaction> {
  citations?: Record<string, string>;
}
interface OpenAIResponse {
  transactions: OpenAIResponseTransaction[];
}

/**
 * Core domain logic for analyzing transactions using OpenAI.
 */
export async function analyzeTransactionsCore(
  transactions: Transaction[]
): Promise<AnalyzedTransactionData> {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    console.warn(
      "analyzeTransactionsCore: Received empty/invalid transaction array."
    );
    return {
      transactions: [],
      totalPositiveImpact: 0,
      totalNegativeImpact: 0,
      totalSocietalDebt: 0,
      debtPercentage: 0,
    };
  }

  const transactionsToAnalyze = transactions.filter((tx) => !tx.analyzed);

  if (transactionsToAnalyze.length === 0) {
    console.log(
      "analyzeTransactionsCore: No transactions need analysis. Processing existing."
    );
    return processAnalyzedTransactions(transactions);
  }

  const openai = new OpenAI({
    apiKey: config.openai.apiKey, //
    timeout: config.openai.timeout || 90000, //
  });

  // <<< START CHANGE: Determine model based on config >>>
  const modelToUse = config.openai.webSearchEnabled //
    ? "gpt-4o-search-preview" // Use the search preview model if web search is enabled
    : config.openai.model; // Otherwise, use the default model from config

  console.log(
    `analyzeTransactionsCore: Sending ${transactionsToAnalyze.length} txs to OpenAI model: ${modelToUse}`
  );
  // <<< END CHANGE >>>

  try {
    const sanitizedTransactions = transactionsToAnalyze.map((tx) => ({
      plaidTransactionId: tx.plaidTransactionId, // REQUIRED
      date: tx.date || "N/A",
      name: tx.name || "Unknown Merchant",
      amount: typeof tx.amount === "number" ? tx.amount : 0,
    }));

    const systemPrompt = transactionAnalysisPrompt; // Use the updated prompt
    const userMessage = JSON.stringify({ transactions: sanitizedTransactions });

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const completionParams = {
      model: modelToUse, // <<< CHANGE: Use the determined model >>>
      messages: messages,
      // response_format: { type: "json_object" }, // Consider enabling if available
    };
    console.log(messages);
    const rawResponse = await openai.chat.completions.create(completionParams);
    const responseMessage = rawResponse.choices[0]?.message;
    const messageContent = responseMessage?.content || "";
    console.log("response:", responseMessage);
    if (!messageContent) {
      throw new Error("OpenAI returned empty content.");
    }

    // Robust JSON Parsing (keep existing logic)
    let jsonString = messageContent.trim();
    if (jsonString.startsWith("```json")) {
      jsonString = jsonString.substring(7, jsonString.length - 3).trim();
    } else if (jsonString.startsWith("```")) {
      jsonString = jsonString.substring(3, jsonString.length - 3).trim();
    }
    const firstBrace = jsonString.indexOf("{");
    const lastBrace = jsonString.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("Could not find JSON object in OpenAI response.");
    }
    jsonString = jsonString.substring(firstBrace, lastBrace + 1);

    let analyzedData: OpenAIResponse;
    try {
      analyzedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error(
        "JSON parsing error in analyzeTransactionsCore:",
        parseError
      );
      console.error("Raw OpenAI response content:", messageContent);
      throw new Error(
        `Failed to parse JSON from OpenAI. Error: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`
      );
    }

    if (
      !analyzedData.transactions ||
      !Array.isArray(analyzedData.transactions)
    ) {
      throw new Error(
        "OpenAI response format invalid: 'transactions' array missing/invalid."
      );
    }
    console.log(
      `analyzeTransactionsCore: Received ${analyzedData.transactions.length} analyzed transaction objects.`
    );

    // --- Merge OpenAI results with original data ---
    const analyzedTxMap = new Map<string, OpenAIResponseTransaction>();
    analyzedData.transactions.forEach((analyzedTx) => {
      const idFromAI = analyzedTx.plaidTransactionId;
      if (idFromAI) {
        analyzedTxMap.set(idFromAI, {
          ...analyzedTx,
          analyzed: true,
          citations: analyzedTx.citations || {},
        });
      } else {
        console.warn("OpenAI tx missing plaidTransactionId:", analyzedTx.name);
      }
    });

    const finalTransactions = transactions.map((originalTx) => {
      const originalId = originalTx.plaidTransactionId;
      if (originalId && analyzedTxMap.has(originalId)) {
        const analyzedVersion = analyzedTxMap.get(originalId)!;
        return {
          date: originalTx.date,
          name: originalTx.name,
          amount: originalTx.amount,
          plaidTransactionId: originalId,
          plaidCategories: originalTx.plaidCategories,
          societalDebt: analyzedVersion.societalDebt,
          unethicalPractices: analyzedVersion.unethicalPractices || [],
          ethicalPractices: analyzedVersion.ethicalPractices || [],
          practiceWeights: analyzedVersion.practiceWeights || {},
          practiceDebts: analyzedVersion.practiceDebts || {},
          practiceSearchTerms: analyzedVersion.practiceSearchTerms || {},
          practiceCategories: analyzedVersion.practiceCategories || {},
          charities: analyzedVersion.charities || {},
          information: analyzedVersion.information || {},
          citations: analyzedVersion.citations || {}, // Include citations
          analyzed: true,
        };
      } else {
        return { ...originalTx, analyzed: originalTx.analyzed ?? false };
      }
    });

    console.log(
      `analyzeTransactionsCore: Merged into ${finalTransactions.length} txs. Processing final calculations...`
    );
    return processAnalyzedTransactions(finalTransactions);
  } catch (error) {
    console.error(
      "Error during OpenAI analysis in analyzeTransactionsCore:",
      error
    );
    if (error instanceof Error && error.message.includes("API key")) {
      throw new Error("OpenAI API key error.");
    }
    throw error instanceof Error
      ? error
      : new Error("Core transaction analysis failed unexpectedly.");
  }
}

/**
 * Process analyzed/merged transactions: calculate societal debt per transaction and aggregate totals.
 */
export function processAnalyzedTransactions(
  transactions: Transaction[]
): AnalyzedTransactionData {
  if (!Array.isArray(transactions)) {
    console.warn("processAnalyzedTransactions: Received invalid input.");
    return {
      transactions: [],
      totalPositiveImpact: 0,
      totalNegativeImpact: 0,
      totalSocietalDebt: 0,
      debtPercentage: 0,
    };
  }

  const updatedTransactions = transactions.map((t) => {
    // Calculate debt per transaction (existing logic)
    const practiceDebts: Record<string, number> = {};
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
      const portion = amount * (weight / 100);
      if (!isNaN(portion)) {
        practiceDebts[practice] = portion;
        transactionSocietalDebt += portion;
      }
    });
    ethicalPractices.forEach((practice) => {
      const weight = practiceWeights[practice] ?? 0;
      const portion = -1 * (amount * (weight / 100));
      if (!isNaN(portion)) {
        practiceDebts[practice] = portion;
        transactionSocietalDebt += portion;
      }
    });

    // Ensure search terms exist (existing logic)
    const practiceSearchTerms = t.practiceSearchTerms || {};
    const defaultMappings: Record<string, string> = {
      "Factory Farming": "animal welfare",
      "High Emissions": "climate",
      "Environmental Degradation": "conservation",
      "Water Waste": "water conservation",
      "Resource Depletion": "sustainability",
      "Data Privacy Issues": "digital rights",
      "Labor Exploitation": "workers rights",
      "Excessive Packaging": "environment",
      "Animal Testing": "animal rights",
      "High Energy Usage": "renewable energy",
      /* Add other mappings */
    };
    [...unethicalPractices, ...ethicalPractices].forEach((p) => {
      if (!practiceSearchTerms[p])
        practiceSearchTerms[p] = defaultMappings[p] || p.toLowerCase();
    });

    // Final object for this transaction
    const processedTx: Transaction = {
      date: t.date || "N/A",
      name: t.name || "Unknown",
      amount: amount,
      plaidTransactionId: t.plaidTransactionId,
      plaidCategories: t.plaidCategories,
      societalDebt: transactionSocietalDebt,
      practiceDebts,
      analyzed: t.analyzed ?? true,
      unethicalPractices,
      ethicalPractices,
      practiceWeights,
      practiceSearchTerms,
      practiceCategories: t.practiceCategories || {},
      charities: t.charities || {},
      information: t.information || {}, // Keep original information
      citations: t.citations || {}, // Include citations directly
      isCreditApplication: t.isCreditApplication,
      creditApplied: t.creditApplied,
    };
    return processedTx;
  });

  // --- Use calculationService for Aggregate Totals (existing logic) ---
  const positiveImpact =
    calculationService.calculatePositiveImpact(updatedTransactions);
  const negativeImpact =
    calculationService.calculateNegativeImpact(updatedTransactions);
  const debtPercentage =
    calculationService.calculateDebtPercentage(updatedTransactions);
  const totalSocietalDebtOnlyNegative = negativeImpact;

  return {
    transactions: updatedTransactions,
    totalPositiveImpact: positiveImpact,
    totalNegativeImpact: negativeImpact,
    totalSocietalDebt: totalSocietalDebtOnlyNegative,
    debtPercentage,
  };
}
