import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Multiple components read the same keys (e.g. useActiveProject in Home AND
// the menu overlay). Each hook instance is plain useState, so without this
// registry a write from one instance never reaches the others until a full
// reload — creating a project from the menu left the screen behind it on the
// old state. Every instance registers its setter per key; a write notifies
// them all synchronously.
const subscribers = new Map<string, Set<(value: string) => void>>();

function isWeb() {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

export function useLocalStorage(key: string, initial: string) {
  const [value, setValue] = useState(() => {
    if (isWeb()) {
      return window.localStorage.getItem(key) || initial;
    }
    return initial;
  });

  useEffect(() => {
    let set = subscribers.get(key);
    if (!set) {
      set = new Set();
      subscribers.set(key, set);
    }
    set.add(setValue);
    return () => {
      set.delete(setValue);
    };
  }, [key]);

  const setEverywhere = (next: string) => {
    if (isWeb()) {
      window.localStorage.setItem(key, next);
    }
    const set = subscribers.get(key);
    if (set) {
      for (const notify of set) notify(next);
    } else {
      setValue(next);
    }
  };

  return [value, setEverywhere] as const;
}
