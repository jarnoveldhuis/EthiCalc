// src/app/api/values/stats/route.ts
import { getValueStatsHandler } from "@/features/values/api/getValueStatsHandler";

// A POST request is more appropriate here since we are sending a body
// with the user's value settings to the server for processing.
export { getValueStatsHandler as POST };