import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../constants/theme';
import { glassBlur, glassSurface } from '../lib/glass';
import PressableScale from './PressableScale';

type CoachMarkProps = {
  visible: boolean;
  text: string;
  // Screen-space point the ring is centered on (the element being taught).
  anchor: { x: number; y: number };
  // Whether the message bubble sits above or below that point.
  placement: 'above' | 'below';
  buttonLabel: string;
  onNext: () => void;
  // Viewport size, for clamping the bubble on-screen.
  screenWidth: number;
  screenHeight: number;
  ringSize?: number;
};

const BUBBLE_WIDTH = 260;
const ARROW = 9;
const GAP = 14;

// A single onboarding coach mark: a soft scrim that captures taps (so the
// app underneath can't be poked mid-tour), a pulsing gold ring around the
// element being pointed at, and a message bubble with a Next/Got it button.
// Positions are computed from an anchor point + viewport size rather than
// runtime measurement -- every target sits at a deterministic screen spot.
export default function CoachMark({
  visible,
  text,
  anchor,
  placement,
  buttonLabel,
  onNext,
  screenWidth,
  screenHeight,
  ringSize = 66,
}: CoachMarkProps) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  React.useEffect(() => {
    if (!visible || reduceMotion) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [visible, reduceMotion]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.12 }],
    opacity: 0.5 + pulse.value * 0.5,
  }));

  if (!visible) return null;

  const bubbleLeft = Math.max(
    14,
    Math.min(anchor.x - BUBBLE_WIDTH / 2, screenWidth - 14 - BUBBLE_WIDTH)
  );
  // Where the little arrow sits along the bubble's edge, aimed at the anchor.
  const arrowLeft = Math.max(16, Math.min(anchor.x - bubbleLeft - ARROW, BUBBLE_WIDTH - 32));

  // "below": grow down from just under the ring. "above": pin the bubble's
  // BOTTOM edge just over the ring (measured from the screen bottom) so it
  // grows upward regardless of its own height.
  const bubblePos =
    placement === 'below'
      ? { top: anchor.y + ringSize / 2 + GAP }
      : { bottom: screenHeight - (anchor.y - ringSize / 2 - GAP) };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      {/* Scrim swallows taps so the app can't be interacted with mid-step. */}
      <Pressable style={styles.scrim} onPress={() => {}} />

      {/* Highlight ring on the target. */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            left: anchor.x - ringSize / 2,
            top: anchor.y - ringSize / 2,
          },
          ringStyle,
        ]}
        pointerEvents="none"
      />

      {/* Message bubble. */}
      <View
        style={[
          styles.bubble,
          glassSurface,
          glassBlur,
          { left: bubbleLeft, width: BUBBLE_WIDTH },
          bubblePos,
        ]}
      >
        {/* Arrow */}
        {placement === 'below' ? (
          <View style={[styles.arrowUp, { left: arrowLeft }]} pointerEvents="none" />
        ) : null}

        <Text style={styles.text}>{text}</Text>
        <PressableScale onPress={onNext} scaleTo={0.96} style={styles.button}>
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </PressableScale>

        {placement === 'above' ? (
          <View style={[styles.arrowDown, { left: arrowLeft }]} pointerEvents="none" />
        ) : null}
      </View>
    </View>
  );
}

const BUBBLE_BG = 'rgba(28, 22, 20, 0.86)';

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 8, 7, 0.55)',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: colors.goldWarm,
    backgroundColor: 'rgba(212, 169, 118, 0.12)',
  },
  bubble: {
    position: 'absolute',
    backgroundColor: BUBBLE_BG,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    zIndex: 2,
  },
  text: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: colors.white,
    marginBottom: 12,
  },
  button: {
    alignSelf: 'flex-end',
    height: 34,
    paddingHorizontal: 18,
    borderRadius: 17,
    backgroundColor: colors.goldWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: '#1A1613',
  },
  arrowUp: {
    position: 'absolute',
    top: -ARROW,
    width: 0,
    height: 0,
    borderLeftWidth: ARROW,
    borderRightWidth: ARROW,
    borderBottomWidth: ARROW,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: BUBBLE_BG,
  },
  arrowDown: {
    position: 'absolute',
    bottom: -ARROW,
    width: 0,
    height: 0,
    borderLeftWidth: ARROW,
    borderRightWidth: ARROW,
    borderTopWidth: ARROW,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: BUBBLE_BG,
  },
});
