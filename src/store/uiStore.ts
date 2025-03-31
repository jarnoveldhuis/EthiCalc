// src/store/uiStore.ts
import { create } from 'zustand';

export type ViewType = 'balance-sheet' | 'transactions' | 'vendors' | 'categories' | 'premium';

interface UIState {
  // UI State
  activeView: ViewType;
  isSidebarExpanded: boolean;
  donationModalOpen: boolean;
  donationPractice: string | null;
  donationAmount: number;
  feedbackMessage: string | null;
  
  // Actions
  setActiveView: (view: ViewType) => void;
  toggleSidebar: () => void;
  openDonationModal: (practice: string, amount: number) => void;
  closeDonationModal: () => void;
  showFeedback: (message: string) => void;
  clearFeedback: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  activeView: 'balance-sheet',
  isSidebarExpanded: true,
  donationModalOpen: false,
  donationPractice: null,
  donationAmount: 0,
  feedbackMessage: null,
  
  // Actions
  setActiveView: (view) => set({ activeView: view }),
  toggleSidebar: () => set((state) => ({ isSidebarExpanded: !state.isSidebarExpanded })),
  openDonationModal: (practice, amount) => set({ 
    donationModalOpen: true, 
    donationPractice: practice, 
    donationAmount: amount 
  }),
  closeDonationModal: () => set({ donationModalOpen: false }),
  showFeedback: (message) => set({ feedbackMessage: message }),
  clearFeedback: () => set({ feedbackMessage: null })
}));