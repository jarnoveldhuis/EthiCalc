// src/shared/ui/AnimatedCounter.jsx
import { useCountUp } from '@/hooks/useCountUp';

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  decimalPlaces?: number;
  duration?: number; // Add duration prop
  title?: string;
}

export function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  className = '',
  decimalPlaces = 0,
  duration = 2000, // Default duration for counters (e.g., 2000ms)
  title
}: AnimatedCounterProps) {

  const countUpOptions = {
    duration: duration, // Use the prop or its default
    easing: "easeOut" as const,
    decimalPlaces: decimalPlaces,
  };

  const displayValue = useCountUp(value, countUpOptions);

  return (
    <span className={`font-bold ${className}`} title={title}>
       {prefix}{displayValue}{suffix}
    </span>
  );
}