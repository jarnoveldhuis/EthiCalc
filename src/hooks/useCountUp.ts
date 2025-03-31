import { useState, useEffect, useCallback, useRef } from 'react';

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
 * @returns The current animated value
 */
export function useCountUp(
  targetValue: number,
  options: CountUpOptions = {}
): string {
  const {
    duration = 1500,
    easing = 'easeOut',
    delay = 0,
    decimalPlaces = 2,
    formatter = (value: number) => value.toFixed(decimalPlaces)
  } = options;
  
  // State to hold the current display value
  const [displayValue, setDisplayValue] = useState<number>(0);
  
  // Track previous value to handle direction changes
  const prevValueRef = useRef<number>(0);
  
  // Store animation frame reference for cleanup
  const animationRef = useRef<number | null>(null);
  
  // Easing functions
  const easingFunctions = {
    linear: (t: number) => t,
    easeIn: (t: number) => t * t,
    easeOut: (t: number) => t * (2 - t),
    easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  };
  
  useEffect(() => {
    // Skip the animation if targetValue and displayValue are the same
    if (targetValue === prevValueRef.current) return;
    
    let startTimestamp: number | null = null;
    let startValue = prevValueRef.current;
    prevValueRef.current = targetValue;
    
    // If we want to delay the animation
    if (delay > 0) {
      const delayTimeout = setTimeout(() => startAnimation(), delay);
      return () => clearTimeout(delayTimeout);
    } else {
      startAnimation();
    }
    
    function startAnimation() {
      // Cancel any existing animation
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
      
      // Animation step function
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        
        // Calculate progress (0 to 1)
        const elapsed = timestamp - startTimestamp;
        const progress = Math.min(elapsed / duration, 1);
        
        // Apply easing
        const easedProgress = easingFunctions[easing](progress);
        
        // Calculate current value
        const currentValue = startValue + (targetValue - startValue) * easedProgress;
        
        // Update state with the new value
        setDisplayValue(currentValue);
        
        // Continue animation if not complete
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(step);
        } else {
          // Ensure we end exactly at the target value
          setDisplayValue(targetValue);
          animationRef.current = null;
        }
      };
      
      // Start the animation
      animationRef.current = requestAnimationFrame(step);
    }
    
    // Cleanup function
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetValue, duration, easing, delay]);
  
  // Apply formatting to the current value
  return formatter(displayValue);
}