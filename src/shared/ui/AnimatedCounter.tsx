// src/shared/ui/AnimatedCounter.jsx
// import React, { useEffect } from 'react'; // Import useEffect for logging
import { useCountUp } from '@/hooks/useCountUp';

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  decimalPlaces?: number;
  title?: string; // Keep title prop if used
}

export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  className = '',
  decimalPlaces = 0, // Default to 0 if not provided
  title // Keep title prop if used
}: AnimatedCounterProps) {

  // Define options for the hook
  const countUpOptions = {
    duration: 1500, // Slightly shorter duration might feel better for lists
    easing: "easeOut" as const,
    decimalPlaces: decimalPlaces, // Use the passed prop
  };

  // Get the animated value string from the hook
  const displayValue = useCountUp(value, countUpOptions);

  // // --- Add Debug Log ---
  // // Log the value received and the formatted string from the hook
  // useEffect(() => {
  //   // Only log if it's potentially for the category scores (e.g., has decimal places or specific class)
  //   // You might adjust this condition based on where you use the counter
  //   if (decimalPlaces > 0 || className?.includes('value-text-score')) {
  //      console.log(`AnimatedCounter - Input value: ${value}, Output displayValue: ${displayValue}`);
  //   }
  // // Log whenever the displayValue changes
  // }, [displayValue, value, decimalPlaces, className]);
  // // --- End Debug Log ---


  // Render the value
  return (
    <span className={`font-bold ${className}`} title={title}> {/* Add title attribute */}
       {prefix}{displayValue}{suffix}
    </span>
  );
}