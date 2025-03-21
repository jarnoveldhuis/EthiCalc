import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";

interface DashboardLoadingProps {
  message: string;
}

export function DashboardLoading({ message }: DashboardLoadingProps) {
  return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner message={message} />
    </div>
  );
}

interface DashboardEmptyStateProps {
  effectiveConnectionStatus: boolean;
  // onDisconnectBank: () => void;
  bankConnecting?: boolean;
  isConnecting?: boolean;
}

export function DashboardEmptyState({ 
  effectiveConnectionStatus,
  // onDisconnectBank,
  bankConnecting = false,
  isConnecting = false
}: DashboardEmptyStateProps) {
  if (bankConnecting || isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-6">
        <LoadingSpinner message="Connecting to your bank..." />
        <p className="text-sm text-gray-500 mt-4">
          This might take a moment. Please do not close this window.
        </p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center h-64 p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-2">
        No Transactions Found
      </h2>
      <p className="text-gray-600 mb-4">
        {effectiveConnectionStatus
          ? "We couldn't find any transactions in your connected account."
          : "Connect your bank or use the debug tools to load transactions."}
      </p>
    </div>
  );
} 