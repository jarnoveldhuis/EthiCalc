import React from 'react';
import { useCountUp } from '@/hooks/useCountUp';

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({
  value,
  prefix = '$',
  suffix = '',
  className = ''
}: AnimatedCounterProps) {
  // Convert negative values to positive for display, but track the sign

  const isNegative = value < 0;
  const absValue = Math.abs(value);
  
  // Use the count up hook with our options
  const displayValue = useCountUp(absValue, {
    duration: 1000, // A bit faster than default for snappiness
    easing: 'easeOut', // Feels more natural for money
    decimalPlaces: 2,  // Standard for currency
  });
  
  // Determine color based on debt/credit status
  const getTextColorClass = () => {
    if (value <= 0) return 'text-green-200'; // Credit/benefit
    if (value > 50) return "text-orange-200";
    return 'text-red-200'; // Debt
  };

  return (
    <span className={`font-bold ${getTextColorClass()} ${className}`}>
      {isNegative ? '-' : ''}{prefix}{displayValue}{suffix}
    </span>
  );
}