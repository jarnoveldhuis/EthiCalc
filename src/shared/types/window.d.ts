// src/types/window.d.ts
interface Window {
    resetBankConnection?: () => void;
    FORCE_DISCONNECT_PLAID?: () => void;
  }