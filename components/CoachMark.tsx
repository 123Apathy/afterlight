import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../constants/theme';
import { glassBlur } from '../lib/glass';
import PressableScale from './PressableScale';

type CoachMarkProps = {
  visible: boolean;
  text: string;
  // Screen-space point the ring is centered on (the element being taught).
  anchor: { x: number; y: number };
  // Whether the message bubble sits above or below that point.
  placement: 'above' | 'below';
  buttonLabel?: string;
  onNext?: () => void;
  // Interactive step: the user advances by tapping the real element the ring
  // points at (e.g. the grid button), not a Next button. Everything becomes
  // non-blocking so those taps reach the app, and no button is shown.
  interactive?: boolean;
  // Rectangular highlight (rims a photo, say) instead of the round ring. Still
  // pulses. Given in screen coordinates.
  box?: { left: number; top: number; width: number; height: number };
  // A copy of the target's own glyph rendered at the anchor and swelling with
  // the pulse, so the element itself appears to breathe (e.g. the pink heart)
  // rather than a separate ring around it.
  pulseNode?: React.ReactNode;
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
  interactive = false,
  box,
  pulseNode,
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
  // For a glyph copy: swell only, no opacity fade (an icon flickering in and
  // out reads as a glitch, a gentle swell reads as "tap me").
  const nodeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.18 }],
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

  // Only the recommended action is reachable while a mark is up: a
  // non-interactive step fully blocks everything but its Next button;
  // an interactive step blocks everything EXCEPT a hole cut around the exact
  // element it's asking you to tap (the grid button, a photo, an arrow), so
  // you can't swipe past it, only do the one thing.
  const hole = box || {
    left: anchor.x - ringSize / 2,
    top: anchor.y - ringSize / 2,
    width: ringSize,
    height: ringSize,
  };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {interactive ? (
        <>
          <Pressable style={[styles.scrim, styles.scrimLight, { bottom: undefined, height: Math.max(0, hole.top) }]} onPress={() => {}} />
          <Pressable style={[styles.scrim, styles.scrimLight, { top: hole.top + hole.height }]} onPress={() => {}} />
          <Pressable style={[styles.scrim, styles.scrimLight, { top: hole.top, bottom: undefined, height: hole.height, right: undefined, width: Math.max(0, hole.left) }]} onPress={() => {}} />
          <Pressable style={[styles.scrim, styles.scrimLight, { top: hole.top, bottom: undefined, height: hole.height, left: hole.left + hole.width }]} onPress={() => {}} />
        </>
      ) : (
        <Pressable style={[styles.scrim, styles.scrimLight]} onPress={() => {}} />
      )}

      {/* Highlight on the target, pulsing: a copy of the target's glyph
          (pulseNode) that swells in place, else a rectangular box that rims a
          photo, else the default round ring. */}
      {pulseNode ? (
        <Animated.View
          style={[
            styles.pulseNode,
            { left: anchor.x - 40, top: anchor.y - 40 },
            nodeStyle,
          ]}
          pointerEvents="none"
        >
          {pulseNode}
        </Animated.View>
      ) : box ? (
        <Animated.View
          style={[
            styles.ring,
            styles.ringBox,
            { left: box.left, top: box.top, width: box.width, height: box.height },
            ringStyle,
          ]}
          pointerEvents="none"
        />
      ) : (
        <>
          {/* The touch-blocking hole above is a square (it's built from four
              rectangles), but the ring drawn on it is round, so the square's
              corners poked out past the ring as bright, undimmed patches. This
              re-dims exactly that leftover corner area using a circular
              box-shadow spread -- the web/CSS way to paint "everything outside
              a circle" -- so the visible gap matches the round ring and round
              button underneath instead of a square. Decorative only
              (pointerEvents none); the real hole is still the rectangles
              above. Native falls back to the flat rectangles, unaffected. */}
          {Platform.OS === 'web' && (
            <View
              pointerEvents="none"
              style={[
                styles.holeRounder,
                {
                  left: anchor.x - ringSize / 2,
                  top: anchor.y - ringSize / 2,
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  // Spread must exceed the viewport DIAGONAL, not just its
                  // larger side: a box-shadow's corners are rounded (radius
                  // grows with the spread), so at wide/tall ratios an
                  // under-sized spread let the far corner's arc curve back into
                  // view as an undimmed wedge. Sizing off hypot()*2 keeps those
                  // rounded corners far off-screen at ANY aspect ratio.
                  // @ts-expect-error web-only CSS shorthand, not in RN's style types
                  boxShadow: `0 0 0 ${Math.ceil(Math.hypot(screenWidth, screenHeight) * 2)}px rgba(10, 8, 7, 0.32)`,
                },
              ]}
            />
          )}
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
        </>
      )}

      {/* Message bubble: the same card language as the Comment/Details sheets
          (warm dark glass, hairline border, 24px radius) so the tour reads as
          part of the app, not a separate overlay. No pointer arrow -- the
          highlight already shows the target. */}
      <View
        style={[
          styles.bubble,
          glassBlur,
          { left: bubbleLeft, width: BUBBLE_WIDTH },
          bubblePos,
        ]}
        pointerEvents={interactive ? 'none' : 'auto'}
      >
        <Text style={[styles.text, interactive && styles.textInteractive]}>{text}</Text>
        {!interactive && (
          <PressableScale onPress={onNext} scaleTo={0.96} style={styles.button}>
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </PressableScale>
        )}
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
  // Positioned/sized per-instance; backgroundColor stays transparent so only
  // its box-shadow (added inline, web-only) paints.
  holeRounder: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  // Lighter dim for interactive steps so the element they must tap stays clear.
  scrimLight: {
    backgroundColor: 'rgba(10, 8, 7, 0.32)',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: colors.goldWarm,
    backgroundColor: 'rgba(212, 169, 118, 0.12)',
  },
  // Rectangular variant that rims a photo (soft-cornered, not a circle).
  ringBox: {
    borderRadius: 10,
  },
  // Wrapper for a pulsing copy of the target's glyph, centred on the anchor.
  pulseNode: {
    position: 'absolute',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    position: 'absolute',
    // Matches the Comment/Details sheet card exactly.
    backgroundColor: 'rgba(32, 26, 24, 0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    zIndex: 2,
  },
  text: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: colors.white,
    marginBottom: 16,
  },
  // No button follows in interactive mode, so the text needs no bottom gap.
  textInteractive: {
    marginBottom: 0,
  },
  // Matches the sheet's gold action button (Post / Save details).
  button: {
    alignSelf: 'flex-end',
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    backgroundColor: colors.goldWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
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
