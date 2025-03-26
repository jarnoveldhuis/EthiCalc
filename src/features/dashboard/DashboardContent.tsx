// src/components/dashboard/DashboardContent.tsx
"use client";

import { ReactNode } from 'react';

interface DashboardContentProps {
  children: ReactNode;
  title?: string;
}

export function DashboardContent({ 
  children, 
  title 
}: DashboardContentProps) {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {title && (
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-bold text-lg">{title}</h2>
        </div>
      )}
      
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}