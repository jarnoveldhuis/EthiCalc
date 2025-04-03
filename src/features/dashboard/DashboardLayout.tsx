// src/components/dashboard/DashboardLayout.tsx
"use client";

import { User } from "firebase/auth";
import { ReactNode } from "react";
import { Header } from "@/shared/components/Header";
import Image from "next/image";

interface DashboardLayoutProps {
  children: ReactNode;
  user: User | null;
  onLogout: () => void;
  onDisconnectBank: () => void;
  isBankConnected?: boolean;
}

export function DashboardLayout({
  children,
  user,
  onLogout,
  onDisconnectBank,
  isBankConnected = false
}: DashboardLayoutProps) {
  return (
    // REMOVED bg-gray-100 from this div. The background will now come from the body style set via CSS variables.
    <div className="min-h-screen">
      {/* Header - Apply header background variable */}
      <header className="bg-[var(--header-background)] border-b border-[var(--border-color)] shadow-sm sticky top-0 z-10 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and title */}
            <div className="flex items-center">
              {/* Consider adding dark mode variant if logo has transparency issues */}
              <Image src="/cashLogo.png" alt="KarmaBalance Logo" width={60} height={60} className="mr-2" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                KarmaBalance
              </h1>
            </div>

            {/* Pass the disconnect function and connection status to the Header */}
            <Header
              user={user}
              onLogout={onLogout}
              onDisconnectBank={onDisconnectBank}
              isBankConnected={isBankConnected}
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}