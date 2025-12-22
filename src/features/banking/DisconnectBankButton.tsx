// src/features/banking/DisconnectBankButton.tsx
import { useState } from 'react';

interface DisconnectBankButtonProps {
  onDisconnect: () => void;
  className?: string;
}

export function DisconnectBankButton({ onDisconnect, className = "" }: DisconnectBankButtonProps) {
  const [confirming, setConfirming] = useState(false);
  
  return confirming ? (
    <div className={`flex space-x-2 ${className}`}>
      <button
        onClick={() => {
          onDisconnect();
          setConfirming(false);
        }}
        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
      >
        Confirm Disconnect
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded text-sm"
      >
        Cancel
      </button>
    </div>
  ) : (
    <button
      onClick={() => setConfirming(true)}
      className={`bg-white dark:bg-white text-gray-900 dark:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-100 px-3 py-1.5 rounded text-sm font-medium border border-gray-300 dark:border-gray-300 ${className}`}
    >
      Disconnect Bank
    </button>
  );
}