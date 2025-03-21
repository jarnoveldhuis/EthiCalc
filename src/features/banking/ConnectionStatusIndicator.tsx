// src/features/banking/ConnectionStatusIndicator.tsx
import { useState } from "react";
// import { BankDisconnectButton } from "./BankDisconnectButton";

interface ConnectionStatusIndicatorProps {
  isConnected: boolean;
  onDisconnect: () => void;
  className?: string;
}

export function ConnectionStatusIndicator({
  isConnected,
  onDisconnect,
  className = "",
}: ConnectionStatusIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Don't show anything if not connected
  if (!isConnected) {
    return null;
  }

  return (
    <div className={`text-sm ${className}`}>
      <div className="flex items-center space-x-2">
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
          <span
            className="text-green-700 cursor-pointer"
            onClick={() => setShowDetails(!showDetails)}
          >
            Bank Connected
          </span>
        </div>

        {/* <BankDisconnectButton
          onDisconnect={onDisconnect}
          isConnected={isConnected}
        /> */}
      </div>

      {showDetails && (
        <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
          <div>
            <strong>Connection Status:</strong> Active
          </div>
          <div>
            <strong>Connected Since:</strong>{" "}
            {localStorage.getItem("plaid_access_token_info")
              ? new Date(
                  JSON.parse(
                    localStorage.getItem("plaid_access_token_info") || "{}"
                  ).timestamp || 0
                ).toLocaleString()
              : "Unknown"}
          </div>
          <div className="mt-1">
            If you are having connection issues, try the{" "}
            <button
              onClick={() => {
                if (
                  confirm(
                    "Are you sure you want to force disconnect your bank account?"
                  )
                ) {
                  onDisconnect();
                }
              }}
              className="text-red-600 underline"
            >
              Force Disconnect
            </button>{" "}
            option.
          </div>
        </div>
      )}
    </div>
  );
}
