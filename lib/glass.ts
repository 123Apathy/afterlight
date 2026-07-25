import { Platform } from 'react-native';

// Shared frosted-glass treatment (Apple "Liquid Glass"-style: blurred
// backdrop, translucent fill, a bright rim to catch light, soft shadow for
// lift). Used by nav arrows, the comment-count pill, and the reaction
// picker popup -- kept in one place so they can't drift apart in tone.
export const glassBlur =
  Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } as object)
    : undefined;

export const glassSurface = {
  backgroundColor: 'rgba(255,255,255,0.14)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.32)',
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
};

// Gold-lit edge for large surfaces (menu cards, gate cards): a hairline ring
// whose top and bottom edges catch warm light while the middle stays clear,
// so a flat card reads as a lit pane rather than a filled rectangle.
// Web-only (mask-composite has no RN-native equivalent); native keeps the
// plain border it already has. Technique harvested from a motionsites
// "liquid glass" reference, recoloured to Everlit's gold.
export const goldLitEdge =
  Platform.OS === 'web'
    ? ({
        boxShadow:
          'inset 0 1px 0 rgba(245, 240, 235, 0.10), inset 0 -1px 0 rgba(212, 169, 118, 0.14)',
      } as object)
    : undefined;
