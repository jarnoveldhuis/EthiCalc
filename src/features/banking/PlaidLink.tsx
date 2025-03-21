// src/features/banking/PlaidLink.tsx
import { useEffect, useState, useCallback } from "react";

interface PlaidLinkProps {
  onSuccess: (public_token: string) => void;
  onExit?: () => void;
}

// Add this interface to help TypeScript understand the Plaid object
interface PlaidHandler {
  open: () => void;
  exit: () => void;
}

interface PlaidError {
  error_code: string;
  error_message: string;
  display_message: string | null;
}

// Declare the global Plaid object
declare global {
  interface Window {
    Plaid: {
      create: (config: {
        token: string;
        onSuccess: (public_token: string) => void;
        onExit: (err?: PlaidError) => void;
        onLoad: () => void;
      }) => PlaidHandler;
    };
  }
}

export default function PlaidLink({ onSuccess, onExit }: PlaidLinkProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Link token on component mount
  useEffect(() => {
    async function fetchLinkToken() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch("/api/banking/create_link_token");
        
        if (!response.ok) {
          throw new Error(`Failed to create link token: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Generated Plaid Link Token");
        setLinkToken(data.link_token);
      } catch (err) {
        console.error("Error fetching Plaid link token:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize Plaid");
      } finally {
        setLoading(false);
      }
    }

    fetchLinkToken();
  }, []);

  // Open Plaid Link
  const openPlaidLink = useCallback(() => {
    if (!linkToken) {
      setError("Plaid initialization failed. Please try again.");
      return;
    }
    
    try {
      const handler = window.Plaid.create({
        token: linkToken,
        onSuccess: (public_token: string) => {
          console.log("Plaid Link Success!");
          onSuccess(public_token);
        },
        onExit: (err?: PlaidError) => {
          if (err) {
            console.error("Plaid Link Exit Error:", err);
            setError(err.display_message || err.error_message || "Plaid connection canceled");
          }
          if (onExit) onExit();
        },
        onLoad: () => {
          console.log("Plaid Link Loaded");
        }
      });
    
      handler.open();
    } catch (err) {
      console.error("Error opening Plaid Link:", err);
      setError(err instanceof Error ? err.message : "Failed to open Plaid Link");
    }
  }, [linkToken, onSuccess, onExit]);

  return (
    <div className="flex flex-col items-center">
      {error && (
        <div className="text-red-500 mb-4 text-sm">
          {error}
        </div>
      )}
      
      <button
        onClick={openPlaidLink}
        className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-200 ${
          loading ? "opacity-70 cursor-not-allowed" : ""
        }`}
        disabled={loading || !linkToken}
      >
        {loading ? "Connecting..." : "Connect Bank Account"}
      </button>
    </div>
  );
}