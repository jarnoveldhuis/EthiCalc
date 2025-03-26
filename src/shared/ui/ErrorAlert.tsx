import { useState } from 'react';

interface ErrorAlertProps {
  message: string;
}

export function ErrorAlert({ message }: ErrorAlertProps) {
  const [dismissed, setDismissed] = useState(false);
  
  if (dismissed) return null;
  
  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
      <span className="block sm:inline">{message}</span>
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-0 bottom-0 right-0 px-4"
        aria-label="Close"
      >
        <span className="text-xl">&times;</span>
      </button>
    </div>
  );
}