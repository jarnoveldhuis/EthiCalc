import { User } from "firebase/auth";

interface DebugPanelProps {
  user: User | null;
  isSandboxMode: boolean;
  showDebugPanel: boolean;
  onToggleDebugPanel: () => void;
  onLoadSampleData: () => void;
  onResetTransactions: () => Promise<void>;
}

export function DebugPanel({
  user,
  isSandboxMode,
  showDebugPanel,
  onToggleDebugPanel,
  onLoadSampleData,
  onResetTransactions
}: DebugPanelProps) {
  if (!isSandboxMode) {
    return null;
  }
  
  return (
    <div className="mt-4 text-center">
      <button
        onClick={onToggleDebugPanel}
        className="text-xs text-blue-600 underline"
      >
        {showDebugPanel ? "Hide Debug Panel" : "Show Debug Panel"}
      </button>

      {showDebugPanel && (
        <div className="mt-4 p-4 border border-gray-300 rounded bg-gray-50">
          <h3 className="font-bold text-gray-700 mb-2">
            Sandbox Testing Tools
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <button
              onClick={onLoadSampleData}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded font-medium text-sm"
            >
              Load Sample Data
            </button>

            <button
              onClick={onResetTransactions}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded font-medium text-sm"
            >
              Reset All Data
            </button>
          </div>

          <div className="mt-3 text-xs text-gray-600">
            <div>User ID: {user?.uid || "Not logged in"}</div>
            <p className="mt-1 text-yellow-700">
              <strong>Note:</strong> These options are only visible in
              development/sandbox mode.
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 