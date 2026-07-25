import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Atmosphere from './Atmosphere';
import { colors, images } from '../constants/theme';

// Comforting lines that rotate while something loads — the wait becomes a
// held breath rather than a spinner. Kept warm, present-tense, and dash-free.
// Each line is pre-split into two halves so the larger type always breaks in
// the same, readable place (top clause / bottom clause) instead of wrapping
// wherever the width happens to run out.
const LOADING_PHRASES: [string, string][] = [
  ['Take all the time', 'you need.'],
  ['Every memory', 'keeps them close.'],
  ['Grief is love', 'with a home here.'],
  ['You are not', 'alone in this.'],
  ['Their light', 'stays with us.'],
  ['Breathe.', 'There is no rush.'],
  ['Hold the good', 'moments close.'],
  ['We remember them,', 'together.'],
];

// Repeating unit that produces the 1,2,3,2,1,2,3,2,1... dot rhythm.
const DOT_PATTERN = [1, 2, 3, 2];

// A true radial gradient (fades to transparent at the edges), matching the
// one in app/app.tsx (kept as its own small copy here rather than shared —
// it's a tiny, stable primitive, same pattern as this codebase's other
// per-file icon components).
function RadialGlow({ color }: { color: string }) {
  if (Platform.OS === 'web') {
    return React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color} 0%, ${color}00 65%)`,
      },
    });
  }
  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999, backgroundColor: color }}
    />
  );
}

// The brand emblem (flame in its compass ring) breathing over a soft gold glow,
// with a slow carousel of comforting lines beneath it. As the glow swells the
// gold emblem crossfades to its charcoal version, so at the glow's apex it
// reads as a dark silhouette against the light, then returns to gold as the
// glow settles. A small dim label above names whatever is loading. The ringed
// mark makes the wait feel finished and cared-for, not a half-built placeholder.
// Shared across the app's loading states (main deck, favourites, film) so the
// wait always feels like the same considered product, not a bare spinner on
// some screens and a designed moment on others.
export default function LoadingState({
  reduceMotion,
  label = 'Loading your memorial',
}: {
  reduceMotion: boolean;
  label?: string;
}) {
  const breath = useSharedValue(0);
  const fade = useSharedValue(1);
  const [phrase, setPhrase] = useState(0);
  // Dot count cycles 1,2,3,2,1,2,3,2,... as an extra "still working" indicator.
  const [dotStep, setDotStep] = useState(0);
  const dotCount = reduceMotion ? 3 : DOT_PATTERN[dotStep];

  useEffect(() => {
    if (reduceMotion) return;
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setDotStep((d) => (d + 1) % DOT_PATTERN.length), 420);
    return () => clearInterval(id);
  }, [reduceMotion]);

  // Fade the current line out, swap it, fade the next one in.
  useEffect(() => {
    const id = setInterval(() => {
      if (reduceMotion) {
        setPhrase((p) => (p + 1) % LOADING_PHRASES.length);
        return;
      }
      fade.value = withTiming(0, { duration: 600, easing: Easing.in(Easing.quad) });
      setTimeout(() => {
        setPhrase((p) => (p + 1) % LOADING_PHRASES.length);
        fade.value = withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) });
      }, 640);
    }, 4200);
    return () => clearInterval(id);
  }, [reduceMotion]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + breath.value * 0.4,
    transform: [{ scale: 0.88 + breath.value * 0.24 }],
  }));
  // Gold shows when the glow is low; charcoal takes over as it peaks.
  const goldStyle = useAnimatedStyle(() => ({
    opacity: 1 - breath.value,
    transform: [{ scale: 0.98 + breath.value * 0.05 }],
  }));
  const charcoalStyle = useAnimatedStyle(() => ({
    opacity: breath.value,
    transform: [{ scale: 0.98 + breath.value * 0.05 }],
  }));
  const phraseStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <View style={styles.pageContent}>
      {/* Embers rising through the wait: the screen breathes, not spins. */}
      <Atmosphere />
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingLabel}>{label}</Text>
        <View style={styles.loadingEmblem}>
          <Animated.View style={[styles.loadingGlowWrap, glowStyle]} pointerEvents="none">
            <RadialGlow color={colors.goldWarm} />
          </Animated.View>
          <Animated.Image source={images.logoRing} style={[styles.loadingIcon, goldStyle]} resizeMode="contain" />
          <Animated.Image
            source={images.logoRingCharcoal}
            style={[styles.loadingIcon, styles.loadingIconAbs, charcoalStyle]}
            resizeMode="contain"
          />
        </View>
        <Animated.Text style={[styles.loadingPhrase, phraseStyle]}>
          {LOADING_PHRASES[phrase][0]}
          {'\n'}
          {LOADING_PHRASES[phrase][1]}
        </Animated.Text>
        {/* Three-dot rhythm: always three slots (so the row stays centred),
            with only `dotCount` of them lit. */}
        <View style={styles.loadingDots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.loadingDot, { opacity: i < dotCount ? 0.9 : 0.16 }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageContent: {
    flex: 1,
    backgroundColor: colors.dark,
    overflow: 'hidden',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  loadingLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(212, 169, 118, 0.6)',
    textAlign: 'center',
    // Extra gap so the label clears the top of the breathing glow underneath.
    marginBottom: 72,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 28,
    alignSelf: 'center',
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.goldWarm,
  },
  loadingEmblem: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    // Extra gap so the (now larger) phrase clears the bottom of the glow.
    marginBottom: 72,
  },
  loadingGlowWrap: {
    position: 'absolute',
    width: 220,
    height: 220,
  },
  loadingIcon: {
    width: 108,
    height: 108,
  },
  // The charcoal emblem stacks exactly over the gold one to crossfade.
  loadingIconAbs: {
    position: 'absolute',
  },
  loadingPhrase: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 40,
    lineHeight: 50,
    letterSpacing: -0.4,
    color: colors.white,
    textAlign: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
});
