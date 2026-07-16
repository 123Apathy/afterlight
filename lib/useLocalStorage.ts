import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export function useLocalStorage(key: string, initial: string) {
  const [value, setValue] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem(key) || initial;
    }
    return initial;
  });

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  }, [key, value]);

  return [value, setValue] as const;
}
