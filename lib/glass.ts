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
