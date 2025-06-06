// src/features/values/api/getValueStatsHandler.ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyAuth, handleAuthError, AuthError } from "@/utils/serverAuth";
import { firebaseAdminDb, isAdminSdkInitialized } from "@/lib/firebaseAdmin";
import { errorResponse, successResponse } from "@/shared/utils/api";
import { VALUE_CATEGORIES } from "@/config/valuesConfig";

const ValueSettingsSchema = z.object({
  levels: z.record(z.string(), z.number()),
  order: z.array(z.string()),
  calculateRank: z.boolean().optional().default(false),
});

function createValuesHash(levels: Record<string, number>): string {
  return Object.keys(levels)
    .sort()
    .map((key) => `${key}:${levels[key]}`)
    .join("_");
}

async function getUserBalanceScore(userId: string): Promise<number> {
    if (!isAdminSdkInitialized() || !firebaseAdminDb) return 0;

    const txBatchQuery = firebaseAdminDb.collection("transactionBatches")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(1);

    const txSnapshot = await txBatchQuery.get();
    if (txSnapshot.empty) return 0;

    const latestBatch = txSnapshot.docs[0].data();
    const positiveImpact = latestBatch.totalPositiveImpact ?? 0;
    const negativeImpact = latestBatch.totalNegativeImpact ?? 0;

    if (negativeImpact <= 0.005) {
      return positiveImpact > 0.005 ? 101 : 100;
    }
    // Return the percentage of negative impact offset by positive actions
    return Math.round((positiveImpact / negativeImpact) * 100);
}

export async function getValueStatsHandler(req: NextRequest) {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    if (!isAdminSdkInitialized() || !firebaseAdminDb) {
      throw new Error("Firestore Admin SDK not initialized.");
    }
    
    const body = await req.json();
    const validationResult = ValueSettingsSchema.safeParse(body);

    if (!validationResult.success) {
      return errorResponse("Invalid value settings provided", 400, validationResult.error.flatten());
    }

    const { levels, calculateRank } = validationResult.data;
    if (VALUE_CATEGORIES.some(cat => levels[cat.id] === undefined)) {
        return errorResponse("Incomplete value settings provided", 400);
    }

    const valuesHash = createValuesHash(levels);
    const settingsCollection = firebaseAdminDb.collection("userValueSettings");

    // --- THIS IS THE FIX ---
    // Start with a base query and conditionally add the "committed" filter.
    let q = settingsCollection.where("valuesHash", "==", valuesHash);

    // Only filter by commitment status IF we are calculating the final rank.
    if (calculateRank) {
        q = q.where("valuesCommittedUntil", ">", new Date());
    }
    // --- END FIX ---
    
    const querySnapshot = await q.get();
    const matchingUsersCount = querySnapshot.size;

    let rank: number | null = null;
    let totalInRank: number | null = null;

    if (calculateRank && matchingUsersCount > 0) {
        totalInRank = matchingUsersCount;
        const userIds = querySnapshot.docs.map(doc => doc.id);
        
        const scores = await Promise.all(
            userIds.map(id => getUserBalanceScore(id))
        );

        const tribeScores = userIds.map((id, index) => ({
            userId: id,
            score: scores[index]
        })).sort((a, b) => b.score - a.score);

        const currentUserIndex = tribeScores.findIndex(u => u.userId === userId);
        if (currentUserIndex !== -1) {
            rank = currentUserIndex + 1;
        }
    }

    return successResponse({
      matchingUsers: matchingUsersCount,
      rank: rank,
      totalInRank: totalInRank
    });

  } catch (error) {
    if (error instanceof AuthError) { return handleAuthError(error); }
    console.error("❌ Get Value Stats API error:", error);
    return errorResponse("Internal server error while fetching value stats", 500);
  }
}