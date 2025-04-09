// src/shared/ui/AnimatedCounter.jsx
import React from 'react';
import { useCountUp } from '@/hooks/useCountUp'; //

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  decimalPlaces?: number; // <-- ADDED prop
}

export function AnimatedCounter({
  value,
  prefix = '', // Default prefix to empty (important!)
  suffix = '',
  className = '',
  decimalPlaces // <-- Use the new prop
}: AnimatedCounterProps) {

  // Determine options for useCountUp, including decimalPlaces
  const countUpOptions = {
    duration: 1000,
    easing: "easeOut" as const,
    // Use passed decimalPlaces, fallback to 0 if undefined
    decimalPlaces: decimalPlaces !== undefined ? decimalPlaces : 0,
  };

  // useCountUp handles the animation and formatting based on options
  const displayValue = useCountUp(value, countUpOptions); // Pass options

  // REMOVED internal color logic (getTextColorClass)
  // Color is now fully controlled by the passed className

  return (
    // Apply the passed className directly. Ensure font-bold is kept if desired.
    // The prefix is now handled by useCountUp if needed, or rendered outside.
    // Rendering prefix/suffix outside gives more control.
    <span className={`font-bold ${className}`}>
       {/* Prefix is often handled outside now, but kept if useCountUp formatter needs it */}
       {prefix}{displayValue}{suffix}
    </span>
  );
}