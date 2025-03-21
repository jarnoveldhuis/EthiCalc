// src/features/debug/ManualFetchButton.tsx
import { useState, useEffect } from 'react';

interface ManualFetchButtonProps {
  onFetch: () => Promise<void>;
  className?: string;
  showAfterTimeout?: number; // Time in ms to wait before showing the button
}

export function ManualFetchButton({ 
  onFetch, 
  className = '',
  showAfterTimeout = 5000 // Default to 5 seconds
}: ManualFetchButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [visible, setVisible] = useState(false);
  
  // Show button after timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, showAfterTimeout);
    
    return () => clearTimeout(timer);
  }, [showAfterTimeout]);
  
  // Don't render anything until visible
  if (!visible) return null;
  
  const handleClick = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      await onFetch();
      setResult({ success: true, message: 'Transactions refreshed successfully' });
    } catch (error) {
      console.error('Manual fetch error:', error);
      setResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unable to refresh transactions'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className={`rounded border border-blue-200 bg-blue-50 p-3 ${className}`}>
      <div className="text-xs text-blue-800 mb-2">
        If transactions are not appearing, you can try refreshing them manually:
      </div>
      
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`text-sm px-3 py-1 rounded font-medium ${
          isLoading
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isLoading ? 'Refreshing...' : 'Refresh Transactions'}
      </button>
      
      {result && (
        <div 
          className={`mt-2 text-xs px-2 py-1 rounded ${
            result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}