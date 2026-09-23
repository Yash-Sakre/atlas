import { useEffect, useState } from 'react';

/**
 * useDebounce — returns a debounced copy of `value` that only updates
 * after `delayMs` of quiet time.
 *
 * @param value   the value to debounce
 * @param delayMs debounce delay in milliseconds
 * @returns the debounced value
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
