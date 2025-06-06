// src/components/dashboard/DashboardLayout.tsx
"use client";

import { User } from "firebase/auth";
import { ReactNode, useMemo, useState } from "react"; // Import useState
import { Header } from "@/shared/components/Header";
import Image from "next/image";
import { UserValuesModal } from "@/features/values/UserValuesModal"; // Import the modal
import { useTransactionStore } from "@/store/transactionStore"; // Added import

interface DashboardLayoutProps {
  children: ReactNode;
  user: User | null;
  onLogout: () => void;
  onDisconnectBank: () => void;
  isBankConnected?: boolean;
  effectiveDebt?: number; // <-- Add prop type for effectiveDebt
}

// Helper function to determine header background color based on debt
const getHeaderBackgroundColor = (debt: number): string => {
  // Return hex codes for direct styling
  if (debt <= 0) return '#e0f2fe'; // Example: Light Sky Blue (Good)
  if (debt < 20) return '#fef9c3'; // Example: Light Yellow (Okay)
  if (debt < 50) return '#ffedd5'; // Example: Light Orange (Warning)
  return '#fee2e2'; // Example: Light Red (Bad)
  // You can adjust these hex codes or use HSL values etc.
};

export function DashboardLayout({
  children,
  user,
  onLogout,
  onDisconnectBank,
  isBankConnected = false,
  effectiveDebt = 0 // <-- Receive the prop, default to 0
}: DashboardLayoutProps) {

  const [isValuesModalOpen, setIsValuesModalOpen] = useState(false); // State for the modal
  const commitUserValues = useTransactionStore((state) => state.commitUserValues); // Get action

  // Calculate the background color using useMemo for efficiency
  const headerBackgroundColor = useMemo(() => getHeaderBackgroundColor(effectiveDebt), [effectiveDebt]);

  const handleCommitValues = async () => {
    if (user && user.uid) {
      try {
        await commitUserValues(user.uid);
        console.log("User values committed successfully.");
        return true;
      } catch (error) {
        console.error("Failed to commit user values:", error);
        return false;
      }
    }
    return false;
  };

  return (
    <div className="min-h-screen"> {/* Removed bg-gray-100, uses CSS var */}
      {/* Header - Apply dynamic inline style for background */}
      <header
        className="border-b border-[var(--border-color)] shadow-sm sticky top-0 z-30 transition-colors duration-300 ease-in-out" // Increased z-index
        style={{ backgroundColor: headerBackgroundColor }} // <-- Apply dynamic background color
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and title */}
            <div className="flex items-center">
              {/* The Image component remains unchanged */}
              <Image src="/cashLogo.png" alt="KarmaBalance Logo" width={60} height={60} className="mr-2" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                Social Balance
              </h1>
            </div>

            {/* Header component (user menu, etc.) */}
            <Header
              user={user}
              onLogout={onLogout}
              onDisconnectBank={onDisconnectBank}
              isBankConnected={isBankConnected}
              onOpenValuesModal={() => setIsValuesModalOpen(true)} // Pass the handler
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Render UserValuesModal */}
      {isValuesModalOpen && (
        <UserValuesModal 
          isOpen={isValuesModalOpen} 
          onClose={() => setIsValuesModalOpen(false)} 
          onCommit={handleCommitValues} // Pass the handler
        />
      )}
    </div>
  );
}