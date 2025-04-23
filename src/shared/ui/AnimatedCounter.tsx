// src/shared/ui/AnimatedCounter.jsx
import { useCountUp } from '@/hooks/useCountUp';
// Removed unnecessary useMemo import

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  decimalPlaces?: number; // Keep prop for flexibility
  title?: string;
}

export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  className = '',
  decimalPlaces = 0, // Default to 0 decimal places
  title
}: AnimatedCounterProps) {

  // Define options for the hook - REMOVED useMemo wrapper
  const countUpOptions = {
    duration: 1500, // Keep duration defined here
    easing: "easeOut" as const, // Keep easing defined here
    decimalPlaces: decimalPlaces, // Use the passed prop
  };
  // END REMOVAL of useMemo

  // Get the animated value string from the hook
  const displayValue = useCountUp(value, countUpOptions);

  // Render the value
  return (
    <span className={`font-bold ${className}`} title={title}>
       {prefix}{displayValue}{suffix}
    </span>
  );
}