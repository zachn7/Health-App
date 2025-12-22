import { useState, useEffect } from 'react';
import { safeJSONParse } from '@/lib/schemas';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  // Get from local storage then parse stored json or return initialValue
  const readValue = (): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (!item) {
        return initialValue;
      }
      
      // For useLocalStorage, we'll use a more permissive schema since it's generic
      const dynamicSchema: any = { safeParse: (data: any) => ({ success: true, data }) };
      const parseResult = safeJSONParse(item, dynamicSchema, `localStorage key "${key}"`);
      
      if (parseResult.success && parseResult.data !== undefined) {
        return parseResult.data as T;
      } else {
        console.warn(`Error reading localStorage key "${key}":`, parseResult.error);
        return initialValue;
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Save state
      setStoredValue(valueToStore);
      
      // Save to local storage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const dynamicSchema: any = { safeParse: (data: any) => ({ success: true, data }) };
          const parseResult = safeJSONParse(e.newValue, dynamicSchema, `localStorage change "${key}"`);
          
          if (parseResult.success && parseResult.data !== undefined) {
            setStoredValue(parseResult.data as T);
          } else {
            console.warn(`Error handling storage change for key "${key}":`, parseResult.error);
          }
        } catch (error) {
          console.warn(`Error handling storage change for key "${key}":`, error);
        }
      }
    };

    // Add event listener for changes from other tabs
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]);

  return [storedValue, setValue];
}