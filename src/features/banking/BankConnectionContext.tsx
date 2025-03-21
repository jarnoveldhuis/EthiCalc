// src/features/banking/BankConnectionContext.tsx
import { createContext, useContext, ReactNode } from 'react';

interface BankConnectionContextValue {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  disconnectBank: () => void;
}

const BankConnectionContext = createContext<BankConnectionContextValue | undefined>(undefined);

export function BankConnectionProvider({ 
  children,
  value
}: { 
  children: ReactNode;
  value: BankConnectionContextValue;
}) {
  return (
    <BankConnectionContext.Provider value={value}>
      {children}
    </BankConnectionContext.Provider>
  );
}

export function useBankConnection() {
  const context = useContext(BankConnectionContext);
  if (context === undefined) {
    throw new Error('useBankConnection must be used within a BankConnectionProvider');
  }
  return context;
}