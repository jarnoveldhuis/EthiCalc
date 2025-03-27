import { create } from 'zustand';
import { TabType } from '@/features/dashboard/TabView';

interface UIState {
  activeView: TabType;
  isMenuOpen: boolean;
  showFeedback: boolean;
  feedbackMessage: string;
  isDonationModalOpen: boolean;
  lastAppliedAmount: number;
  
  // Actions
  setActiveView: (view: TabType) => void;
  toggleMenu: () => void;
  setShowFeedback: (show: boolean) => void;
  setFeedbackMessage: (message: string) => void;
  setDonationModalOpen: (isOpen: boolean) => void;
  setLastAppliedAmount: (amount: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // State
  activeView: "transaction-table",
  isMenuOpen: false,
  showFeedback: false,
  feedbackMessage: "",
  isDonationModalOpen: false,
  lastAppliedAmount: 0,
  
  // Actions
  setActiveView: (view) => set({ activeView: view }),
  toggleMenu: () => set((state) => ({ isMenuOpen: !state.isMenuOpen })),
  setShowFeedback: (show) => set({ showFeedback: show }),
  setFeedbackMessage: (message) => set({ feedbackMessage: message }),
  setDonationModalOpen: (isOpen) => set({ isDonationModalOpen: isOpen }),
  setLastAppliedAmount: (amount) => set({ lastAppliedAmount: amount }),
})); 