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
    duration = 1500,
    easing = 'easeOut',
    delay = 0,
    decimalPlaces = 0,
    formatter = (value: number) => value.toFixed(decimalPlaces)
  } = options;

  const [displayValue, setDisplayValue] = useState<number>(targetValue);
  const prevValueRef = useRef<number>(targetValue);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = prevValueRef.current;

    if (targetValue === startValue) {
        if (displayValue !== targetValue) { setDisplayValue(targetValue); }
        return;
    }

    let startTimestamp: number | null = null;
    const easingFunctions = {
      linear: (t: number) => t,
      easeIn: (t: number) => t * t,
      easeOut: (t: number) => t * (2 - t),
      easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    };

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      // FIX: Change 'let' to 'const'
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easingFunctions[easing](progress);
      const currentValue = startValue + (targetValue - startValue) * easedProgress;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        setDisplayValue(targetValue);
        prevValueRef.current = targetValue;
        animationRef.current = null;
      }
    };

    const startAnimation = () => {
        if (animationRef.current !== null) { cancelAnimationFrame(animationRef.current); }
        animationRef.current = requestAnimationFrame(step);
    }

    // FIX: Change 'let' to 'const'
    const currentAnimationRequest = animationRef.current;

    let delayTimeoutId: NodeJS.Timeout | null = null;
    if (delay > 0) {
      delayTimeoutId = setTimeout(startAnimation, delay);
    } else {
      startAnimation();
    }

    // Cleanup function
    return () => {
      if(delayTimeoutId) clearTimeout(delayTimeoutId);
      // Use the captured value from the start of the effect run
      if (currentAnimationRequest !== null) {
        cancelAnimationFrame(currentAnimationRequest);
      }
      prevValueRef.current = targetValue;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetValue, duration, easing, delay]);

  const formattedValue = useMemo(() => {
      if (isNaN(displayValue) || !isFinite(displayValue)) {
          return formatter(targetValue);
      }
      return formatter(displayValue);
  }, [displayValue, formatter, targetValue]);

  return formattedValue;
}