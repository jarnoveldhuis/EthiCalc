// src/features/charity/donationHelper.ts
import { useUIStore } from '@/store/uiStore'; // Assuming you use this for modal state

// Define interfaces for the helper
interface PracticeInfo {
  name: string;
  amount: number;
  searchTerm?: string;
}

// Helper function to extract the proper search term from a transaction
export function getPracticeSearchTerm(
  transaction: Transaction, 
  practiceName: string
): string | undefined {
  // First check if there's a direct mapping in the transaction
  if (transaction.practiceSearchTerms && transaction.practiceSearchTerms[practiceName]) {
    return transaction.practiceSearchTerms[practiceName];
  }
  
  // Default mappings as fallback
  const searchTermMap: Record<string, string> = {
    "Factory Farming": "animal welfare",
    "High Emissions": "climate",
    "Environmental Degradation": "conservation",
    "Data Privacy Issues": "digital rights",
    "Labor Exploitation": "workers rights",
    "Excessive Packaging": "environment",
    "All Societal Debt": "environment",
    // Add more mappings as needed
  };
  
  return searchTermMap[practiceName];
}

// Hook to handle donation modal opening with consistent data
export function useDonationHandler() {
  const { openDonationModal } = useUIStore();
  
  // Function to open donation modal with proper info
  const handleOpenDonation = useCallback((
    practice: string,
    amount: number,
    searchTerm?: string
  ) => {
    openDonationModal(practice, amount, searchTerm);
  }, [openDonationModal]);
  
  // Helper for offsetting an entire transaction
  const handleOffsetTransaction = useCallback((transaction: Transaction) => {
    // Find the highest impact unethical practice
    let highestImpactPractice = "";
    let highestImpactAmount = 0;
    
    // Check all unethical practices
    (transaction.unethicalPractices || []).forEach(practice => {
      const weight = transaction.practiceWeights?.[practice] || 0;
      const amount = transaction.amount * (weight / 100);
      
      if (amount > highestImpactAmount) {
        highestImpactAmount = amount;
        highestImpactPractice = practice;
      }
    });
    
    // Get the search term for this practice
    const searchTerm = getPracticeSearchTerm(transaction, highestImpactPractice);
    
    // Open the donation modal with the highest impact practice
    handleOpenDonation(
      highestImpactPractice || "Transaction Impact",
      transaction.societalDebt || 0,
      searchTerm
    );
  }, [handleOpenDonation]);
  
  // Helper for offsetting a specific practice
  const handleOffsetPractice = useCallback((
    practice: string,
    amount: number,
    transaction?: Transaction
  ) => {
    // Get search term from transaction if available
    const searchTerm = transaction 
      ? getPracticeSearchTerm(transaction, practice)
      : undefined;
    
    handleOpenDonation(practice, amount, searchTerm);
  }, [handleOpenDonation]);
  
  // Helper for offsetting total debt
  const handleOffsetAll = useCallback((
    totalDebt: number,
    transactions: Transaction[] = []
  ) => {
    // Find the practice with the highest overall impact
    const practiceImpacts: Record<string, number> = {};
    
    // Sum up impacts by practice across all transactions
    transactions.forEach(tx => {
      (tx.unethicalPractices || []).forEach(practice => {
        const weight = tx.practiceWeights?.[practice] || 0;
        const impact = tx.amount * (weight / 100);
        
        practiceImpacts[practice] = (practiceImpacts[practice] || 0) + impact;
      });
    });
    
    // Find the highest impact practice
    let highestPractice = "All Societal Debt";
    let highestImpact = 0;
    
    Object.entries(practiceImpacts).forEach(([practice, impact]) => {
      if (impact > highestImpact) {
        highestImpact = impact;
        highestPractice = practice;
      }
    });
    
    // Get search term for the highest impact practice
    let searchTerm: string | undefined;
    
    // Try to find a transaction with this practice that has a search term
    for (const tx of transactions) {
      if (tx.unethicalPractices?.includes(highestPractice) && 
          tx.practiceSearchTerms?.[highestPractice]) {
        searchTerm = tx.practiceSearchTerms[highestPractice];
        break;
      }
    }
    
    // Open donation modal
    handleOpenDonation(highestPractice, totalDebt, searchTerm);
  }, [handleOpenDonation]);
  
  return {
    handleOpenDonation,
    handleOffsetTransaction,
    handleOffsetPractice,
    handleOffsetAll
  };
}