// src/shared/components/ui/LoadingSpinner.tsx
interface LoadingSpinnerProps {
  message?: string;
  className?: string;
}

export function LoadingSpinner({ 
  message = "Loading...", 
  className = "" 
}: LoadingSpinnerProps) {
  return (
    <div className={`flex justify-center items-center py-4 ${className}`}>
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      <span className="ml-3 text-gray-700">{message}</span>
    </div>
  );
}