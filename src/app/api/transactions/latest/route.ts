
// src/app/api/transactions/latest/route.ts
import { getLatestTransactionsHandler } from '../../../../features/analysis/api/getLatestTransactionsHandler'; // Adjusted path potentially

// Map the GET request to the getLatestTransactionsHandler
// Note: We are securing this GET route with token verification inside the handler
export { getLatestTransactionsHandler as GET };
