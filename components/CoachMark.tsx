import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../constants/theme';
import PressableScale from './PressableScale';

type CoachMarkProps = {
  visible: boolean;
  // Short heading, one idea ("The heart"). Optional for pure-message cards.
  title?: string;
  text: string;
  // Screen-space point of the element being taught. Omit for pure-message
  // cards (welcome / done) which have no target.
  anchor?: { x: number; y: number };
  buttonLabel?: string;
  onNext?: () => void;
  // Every step offers a way out; skipping ends the whole tour.
  onSkip?: () => void;
  skipLabel?: string;
  // Interactive step: the user advances by tapping the real element the
  // highlight points at, not a Next button.
  interactive?: boolean;
  // Rectangular highlight (rims a photo) instead of the round ring.
  box?: { left: number; top: number; width: number; height: number };
  // A copy of the target's own glyph rendered at the anchor, swelling with the
  // pulse, so the element itself appears to breathe.
  pulseNode?: React.ReactNode;
  // "Step 2 of 6" progress; omit on welcome/done.
  stepIndex?: number;
  stepCount?: number;
  screenWidth: number;
  screenHeight: number;
  ringSize?: number;
};

// The card is ALWAYS centred on screen (one predictable place to look, sized
// and typeset for an 80-year-old) and a thin gold line points from the card to
// the element being talked about, which also pulses. Interactive steps keep
// the four-panel blocking scrim with a hole cut around the target so the only
// possible tap is the one being taught.
export default function CoachMark({
  visible,
  title,
  text,
  anchor,
  buttonLabel = 'Next',
  onNext,
  onSkip,
  skipLabel = 'Skip the tour',
  interactive = false,
  box,
  pulseNode,
  stepIndex,
  stepCount,
  screenWidth,
  screenHeight,
  ringSize = 66,
}: CoachMarkProps) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  // Measured card height so the pointer line starts at the card's real edge.
  const [cardSize, setCardSize] = React.useState({ w: 0, h: 0 });

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
  // Glyph copies swell only; opacity flicker reads as a glitch.
  const nodeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.18 }],
  }));

  if (!visible) return null;

  // --- blocking scrim (hole only for interactive steps with a target) ---
  const hole =
    box ||
    (anchor
      ? {
          left: anchor.x - ringSize / 2,
          top: anchor.y - ringSize / 2,
          width: ringSize,
          height: ringSize,
        }
      : null);

  // --- pointer line: centre of screen -> anchor, clipped to card + ring ---
  const cx = screenWidth / 2;
  const cy = screenHeight / 2;
  let line: { x: number; y: number; length: number; deg: number } | null = null;
  if (anchor && cardSize.h > 0) {
    const dx = anchor.x - cx;
    const dy = anchor.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      const ux = dx / dist;
      const uy = dy / dist;
      // Where the centre->anchor ray leaves the card rectangle.
      const tCard = Math.min(
        cardSize.w / 2 / Math.max(Math.abs(ux), 0.0001),
        cardSize.h / 2 / Math.max(Math.abs(uy), 0.0001)
      );
      const start = tCard + 12;
      const targetRadius = box
        ? Math.min(box.width, box.height) / 2 + 10
        : (pulseNode ? 46 : ringSize / 2) + 10;
      const length = dist - start - targetRadius;
      if (length > 14) {
        line = {
          x: cx + ux * start,
          y: cy + uy * start,
          length,
          deg: (Math.atan2(dy, dx) * 180) / Math.PI,
        };
      }
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {interactive && hole ? (
        <>
          <Pressable style={[styles.scrim, { bottom: undefined, height: Math.max(0, hole.top) }]} onPress={() => {}} />
          <Pressable style={[styles.scrim, { top: hole.top + hole.height }]} onPress={() => {}} />
          <Pressable style={[styles.scrim, { top: hole.top, bottom: undefined, height: hole.height, right: undefined, width: Math.max(0, hole.left) }]} onPress={() => {}} />
          <Pressable style={[styles.scrim, { top: hole.top, bottom: undefined, height: hole.height, left: hole.left + hole.width }]} onPress={() => {}} />
        </>
      ) : (
        <Pressable style={styles.scrim} onPress={() => {}} />
      )}

      {/* Pulsing highlight on the target. */}
      {anchor && pulseNode ? (
        <Animated.View
          style={[styles.pulseNode, { left: anchor.x - 40, top: anchor.y - 40 }, nodeStyle]}
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
      ) : anchor ? (
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
      ) : null}

      {/* The pointing line, from the card's edge toward the highlight. */}
      {line && (
        <View
          style={[
            styles.pointerLine,
            {
              left: line.x,
              top: line.y - 1,
              width: line.length,
              transform: [{ rotate: `${line.deg}deg` }],
            },
          ]}
          pointerEvents="none"
        />
      )}
      {line && anchor && (
        <View
          style={[styles.pointerDot, { left: anchor.x - 3, top: anchor.y - 3, opacity: 0 }]}
          pointerEvents="none"
        />
      )}

      {/* The card: always dead centre, one predictable place to look. */}
      <View style={styles.cardCentre} pointerEvents="box-none">
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(240)}
          style={[styles.card, { maxWidth: Math.min(360, screenWidth - 40) }]}
          onLayout={(e) =>
            setCardSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
          }
        >
          {stepIndex != null && stepCount != null && (
            <Text style={styles.progress}>
              Step {stepIndex} of {stepCount}
            </Text>
          )}
          {!!title && <Text style={styles.title}>{title}</Text>}
          <Text style={styles.text}>{text}</Text>
          {!interactive && !!onNext && (
            <PressableScale onPress={onNext} scaleTo={0.97} style={styles.button}>
              <Text style={styles.buttonText}>{buttonLabel}</Text>
            </PressableScale>
          )}
          {!!onSkip && (
            <PressableScale onPress={onSkip} scaleTo={0.98} style={styles.skip} hitSlop={8}>
              <Text style={styles.skipText}>{skipLabel}</Text>
            </PressableScale>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 8, 7, 0.45)',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: colors.goldWarm,
    backgroundColor: 'rgba(212, 169, 118, 0.12)',
  },
  ringBox: {
    borderRadius: 10,
  },
  pulseNode: {
    position: 'absolute',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointerLine: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(212, 169, 118, 0.7)',
    transformOrigin: 'left center',
  },
  pointerDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.goldWarm,
  },
  cardCentre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Nearly solid (not glass): this text must be effortlessly readable over any
  // photo for an 80-year-old, so the card owns its contrast outright.
  card: {
    width: '100%',
    backgroundColor: 'rgba(26, 21, 19, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 24,
    paddingHorizontal: 26,
    paddingTop: 22,
    paddingBottom: 14,
    zIndex: 2,
  },
  progress: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(212, 169, 118, 0.9)',
    textAlign: 'center',
    marginBottom: 10,
  },
  title: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 25,
    lineHeight: 32,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 10,
  },
  text: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 17,
    lineHeight: 27,
    color: 'rgba(255, 255, 255, 0.92)',
    textAlign: 'center',
    marginBottom: 18,
  },
  button: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.goldWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 17,
    color: '#1A1613',
  },
  skip: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  skipText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: colors.textFainter,
    textDecorationLine: 'underline',
  },
});
