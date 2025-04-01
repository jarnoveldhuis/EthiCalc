import { useState } from 'react';
import { Transaction } from '@/shared/types/transactions';

interface UseDonationModalProps {
  transactions: Transaction[];
}

interface DonationModalState {
  isOpen: boolean;
  practice: string;
  searchTerm: string;
  amount: number;
}

export function useDonationModal({ transactions }: UseDonationModalProps) {
  const [modalState, setModalState] = useState<DonationModalState>({
    isOpen: false,
    practice: "All Societal Debt",
    searchTerm: "environment",
    amount: 0
  });

  const openDonationModal = (practice: string, amount: number, searchTerm?: string) => {
    // If no search term provided, try to find one from transactions
    if (!searchTerm) {
      const transaction = transactions.find(tx => 
        tx.unethicalPractices?.includes(practice)
      );
      searchTerm = transaction?.practiceSearchTerms?.[practice] || "environment";
    }

    setModalState({
      isOpen: true,
      practice,
      searchTerm,
      amount
    });
  };

  const closeDonationModal = () => {
    setModalState(prev => ({
      ...prev,
      isOpen: false
    }));
  };

  return {
    modalState,
    openDonationModal,
    closeDonationModal
  };
} 