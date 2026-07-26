import { useEffect } from 'react';
import { Platform } from 'react-native';

// Close an overlay with the Escape key -- web only (native has the system
// back gesture instead). Bound only while the overlay is open. If several
// overlays are somehow open at once, defaultPrevented lets exactly one of
// them claim each key press instead of the whole stack closing together.
export default function useEscapeToClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, onClose]);
}
