// src/hooks/useCountUp.ts
import { useState, useEffect, useRef, useMemo } from 'react';

// Define the function signature with TypeScript
interface CountUpOptions {
  duration?: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  delay?: number;
  decimalPlaces?: number;
  formatter?: (value: number) => string;
}

/**
 * A hook that creates a smooth counting animation
 * @param targetValue The target value to count up/down to
 * @param options Animation options
 * @returns The current animated value formatted as a string
 */
export function useCountUp(
  targetValue: number,
  options: CountUpOptions = {}
): string {
  const {
    duration = 1500, // Keep duration reasonable
    easing = 'easeOut',
    delay = 0,
    decimalPlaces = 0, // Default decimal places
    // Default formatter using decimalPlaces
    formatter = (value: number) => value.toFixed(decimalPlaces)
  } = options;

  // FIX: Initialize displayValue state with the initial targetValue
  const [displayValue, setDisplayValue] = useState<number>(targetValue);

  // FIX: Initialize prevValueRef with the initial targetValue
  const prevValueRef = useRef<number>(targetValue);

  // Store animation frame reference for cleanup
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    // Get the value it should animate FROM
    const startValue = prevValueRef.current;

    // If the target hasn't actually changed, don't re-animate
    if (targetValue === startValue) {
        // Ensure the display value matches the target if no animation runs
        if (displayValue !== targetValue) {
            setDisplayValue(targetValue);
        }
        return;
    }

    let startTimestamp: number | null = null;

    // Define easing functions
    const easingFunctions = {
      linear: (t: number) => t,
      easeIn: (t: number) => t * t,
      easeOut: (t: number) => t * (2 - t),
      easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    };

    // Animation step function
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;

      // Calculate progress (0 to 1)
      const elapsed = timestamp - startTimestamp;
      let progress = Math.min(elapsed / duration, 1);

      // Apply easing
      const easedProgress = easingFunctions[easing](progress);

      // Calculate current value based on eased progress
      const currentValue = startValue + (targetValue - startValue) * easedProgress;

      // Update state with the new intermediate value
      setDisplayValue(currentValue);

      // Continue animation if not complete
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        // Ensure we end exactly at the target value AFTER animation completes
        setDisplayValue(targetValue);
        prevValueRef.current = targetValue; // Update ref after animation finishes
        animationRef.current = null;
      }
    };

    // Function to start the animation (handles delay)
    const startAnimation = () => {
        // Cancel any existing animation frame before starting a new one
        if (animationRef.current !== null) {
          cancelAnimationFrame(animationRef.current);
        }
        // Start the animation loop
        animationRef.current = requestAnimationFrame(step);
    }

    // Use timeout for delay if specified
    if (delay > 0) {
      const delayTimeout = setTimeout(startAnimation, delay);
      // Cleanup timeout if dependencies change before delay finishes
      return () => clearTimeout(delayTimeout);
    } else {
      startAnimation(); // Start immediately if no delay
    }

    // Cleanup function for the effect
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
      // Update ref immediately when the targetValue prop changes
      // This ensures the *next* animation starts from the correct previous target
      prevValueRef.current = targetValue;
    };
    // Dependencies: run effect when targetValue or animation parameters change
  }, [targetValue, duration, easing, delay]); // Removed 'displayValue' from deps

  // Apply formatting to the current internal displayValue state
  // Ensure formatter handles potential NaN/Infinity during animation if easing is extreme
  const formattedValue = useMemo(() => {
      if (isNaN(displayValue) || !isFinite(displayValue)) {
          // Handle invalid numbers during animation, maybe return start/end value
          return formatter(targetValue); // Format the target as fallback
      }
      return formatter(displayValue);
  }, [displayValue, formatter, targetValue]); // Recalculate formatting only when displayValue changes

  return formattedValue;
}