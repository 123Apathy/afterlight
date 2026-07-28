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
  // Returns to the previous step (numbered steps only).
  onBack?: () => void;
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
  // Optional tick box (used on the welcome card: "Do not show this again").
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  onToggleCheckbox?: () => void;
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
  onBack,
  interactive = false,
  box,
  pulseNode,
  stepIndex,
  stepCount,
  checkboxLabel,
  checkboxChecked = false,
  onToggleCheckbox,
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
    <View
      // zIndex above the app header (which is 20). Without it the Everlit
      // flame, the photo counter and the hamburger all painted and stayed
      // CLICKABLE on top of a scrim that is meant to be modal, and the flame
      // navigates away to the marketing site. One stray click mid-tour and you
      // are off the app entirely with the tour half finished.
      style={[StyleSheet.absoluteFill, { zIndex: 50 }]}
      pointerEvents="box-none"
      // Only the fully-blocking steps (no hole cut for a real element) are a
      // genuine modal: everything a screen reader needs is inside this card.
      // Interactive steps must NOT trap navigation here, because the thing
      // to actually tap lives outside this view entirely.
      accessibilityViewIsModal={!interactive}
    >
      {interactive && hole ? (
        <>
          {/* These four panels only block touch around the cut-out hole; they
              do nothing when pressed, so they are marked out of the
              accessibility tree rather than given a role and label that
              would describe an action that doesn't exist. */}
          <Pressable accessibilityRole="none" style={[styles.scrim, { bottom: undefined, height: Math.max(0, hole.top) }]} onPress={() => {}} />
          <Pressable accessibilityRole="none" style={[styles.scrim, { top: hole.top + hole.height }]} onPress={() => {}} />
          <Pressable accessibilityRole="none" style={[styles.scrim, { top: hole.top, bottom: undefined, height: hole.height, right: undefined, width: Math.max(0, hole.left) }]} onPress={() => {}} />
          <Pressable accessibilityRole="none" style={[styles.scrim, { top: hole.top, bottom: undefined, height: hole.height, left: hole.left + hole.width }]} onPress={() => {}} />
          {/* The four panels leave a SQUARE gap, but a round target should sit
              in a round spotlight: this clipped overlay re-darkens just the
              square's corners (shadow painted outside a circle, clipped to the
              hole so it can't stack extra darkness on the panels). Touches
              still pass through the whole square. Only for ring targets; a
              box target (a photo tile) is genuinely rectangular. */}
          {!box && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: hole.left,
                top: hole.top,
                width: hole.width,
                height: hole.height,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: hole.width,
                  height: hole.height,
                  borderRadius: hole.width / 2,
                  boxShadow: '0 0 0 200px rgba(10, 8, 7, 0.7)',
                }}
              />
            </View>
          )}
        </>
      ) : (
        <Pressable accessibilityRole="none" style={styles.scrim} onPress={() => {}} />
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
            <Text style={styles.progress} accessibilityLabel={`Step ${stepIndex} of ${stepCount}`}>
              Step {stepIndex} of {stepCount}
            </Text>
          )}
          {!!title && (
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          )}
          <Text style={styles.text}>{text}</Text>
          {!interactive && !!onNext && (
            <PressableScale
              onPress={onNext}
              scaleTo={0.97}
              style={styles.button}
              accessibilityRole="button"
              accessibilityLabel={buttonLabel}
            >
              <Text style={styles.buttonText}>{buttonLabel}</Text>
            </PressableScale>
          )}
          {interactive && (
            // Sits where the Next button would: every card visibly answers
            // "how do I continue", but here the answer is doing the real thing.
            <Text style={styles.tryHint}>Try it now to continue</Text>
          )}
          {!!checkboxLabel && !!onToggleCheckbox ? (
            // Welcome layout: Skip on the left, the tick on the right.
            <View style={styles.footerRow}>
              {!!onSkip && (
                <PressableScale
                  onPress={onSkip}
                  scaleTo={0.98}
                  style={styles.skip}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={skipLabel}
                >
                  <Text style={styles.skipText}>{skipLabel}</Text>
                </PressableScale>
              )}
              <PressableScale
                onPress={onToggleCheckbox}
                scaleTo={0.98}
                style={styles.checkRow}
                hitSlop={6}
                accessibilityRole="checkbox"
                accessibilityLabel={checkboxLabel}
                accessibilityState={{ checked: checkboxChecked }}
              >
                <View style={[styles.checkBox, checkboxChecked && styles.checkBoxChecked]}>
                  {checkboxChecked && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={styles.checkLabel}>{checkboxLabel}</Text>
              </PressableScale>
            </View>
          ) : !!onSkip || !!onBack ? (
            // Step layout: quiet corner pair, Back bottom-left, Skip bottom-right.
            <View style={styles.footerRow}>
              {onBack ? (
                <PressableScale
                  onPress={onBack}
                  scaleTo={0.98}
                  style={styles.corner}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Go back to the previous step"
                >
                  <Text style={styles.cornerText}>‹ Back</Text>
                </PressableScale>
              ) : (
                <View />
              )}
              {onSkip ? (
                <PressableScale
                  onPress={onSkip}
                  scaleTo={0.98}
                  style={styles.corner}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={skipLabel}
                >
                  <Text style={[styles.cornerText, styles.cornerTextUnderline]}>{skipLabel}</Text>
                </PressableScale>
              ) : (
                <View />
              )}
            </View>
          ) : null}
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
    // Deep enough that the card and its glow clearly lead the screen.
    backgroundColor: 'rgba(10, 8, 7, 0.7)',
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
  // Nearly solid with just a whisper of the photo behind it, warm-rimmed and
  // carrying a faint candlelight glow; the text still owns its contrast.
  card: {
    width: '100%',
    backgroundColor: 'rgba(26, 21, 19, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(212, 169, 118, 0.35)',
    borderRadius: 24,
    paddingHorizontal: 26,
    paddingTop: 22,
    paddingBottom: 14,
    zIndex: 2,
    boxShadow: '0 0 28px rgba(212, 169, 118, 0.2), 0 0 80px rgba(212, 169, 118, 0.1)',
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
  // Footer under the primary button: Skip on the left, the tick on the right.
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
  },
  footerRowCentered: {
    justifyContent: 'center',
  },
  // Big-tap tick row (elderly thumbs): the whole row toggles, not just the box.
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(212, 169, 118, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxChecked: {
    backgroundColor: colors.goldWarm,
    borderColor: colors.goldWarm,
  },
  checkMark: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 17,
    color: '#1A1613',
  },
  checkLabel: {
    fontFamily: 'Poppins_400Regular',
    // Sized so Skip + this row share one line even on a 375px phone card.
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  button: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.goldWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The interactive-step stand-in for the Next button.
  tryHint: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13.5,
    letterSpacing: 0.4,
    color: 'rgba(212, 169, 118, 0.95)',
    textAlign: 'center',
    marginBottom: 4,
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
  // Small corner controls on numbered steps (Back left, Skip right): quiet,
  // out of the reading path, but still a comfortable 40px tap height.
  corner: {
    height: 40,
    justifyContent: 'center',
  },
  cornerText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  cornerTextUnderline: {
    textDecorationLine: 'underline',
  },
});
