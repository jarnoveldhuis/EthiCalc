// src/components/dashboard/DashboardLayout.tsx
"use client";

import { User } from "firebase/auth";
import { ReactNode } from "react";
import { Header } from "@/shared/components/Header";

interface DashboardLayoutProps {
  children: ReactNode;
  user: User | null;
  onLogout: () => void;
  onDisconnectBank: () => void;
  isBankConnected?: boolean;
}

// src/components/dashboard/DashboardLayout.tsx

export function DashboardLayout({ 
  children, 
  user, 
  onLogout, 
  onDisconnectBank,  // Make sure this prop is defined
  isBankConnected = false
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and title */}
            <div className="flex items-center">
              <span className="text-2xl">🌍</span>
              <h1 className="ml-2 text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                Ethinomic Dashboard
              </h1>
            </div>

            {/* Pass the disconnect function to the Header */}
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