// src/features/dashboard/ViewTabs.tsx
"use client";

import React from "react";

export type ViewType = 'balance' | 'transactions';

interface ViewTabsProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
}

export function ViewTabs({ activeView, onViewChange }: ViewTabsProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onViewChange('balance')}
        className={`px-4 py-2 font-medium text-sm transition-colors ${
          activeView === 'balance'
            ? 'text-[var(--card-foreground)] border-b-2 border-[var(--card-foreground)]'
            : 'text-[var(--muted-foreground)] hover:text-[var(--card-foreground)]'
        }`}
      >
        Balance Sheet
      </button>
      <button
        onClick={() => onViewChange('transactions')}
        className={`px-4 py-2 font-medium text-sm transition-colors ${
          activeView === 'transactions'
            ? 'text-[var(--card-foreground)] border-b-2 border-[var(--card-foreground)]'
            : 'text-[var(--muted-foreground)] hover:text-[var(--card-foreground)]'
        }`}
      >
        Transactions
      </button>
    </div>
  );
}
