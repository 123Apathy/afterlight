import React, { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
// NOTE: no pacing lines ("take your time", "no rush") — during a load it's the
// APP keeping the person waiting, so those read as tone-deaf. Every line here
// is either the app quietly at work or a comfort that stands on its own.
const LOADING_PHRASES: [string, string][] = [
  ['Gathering the moments', 'that mattered.'],
  ['Every memory', 'keeps them close.'],
  ['Their light', 'stays with us.'],
  ['You are not', 'alone in this.'],
  ['Grief is love', 'without a home.'],
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
    // Watches reduceMotion, like the two effects below it already do. The
    // breathing emblem kept breathing for anyone who turned motion off after
    // this mounted.
  }, [reduceMotion]);

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
      fade.value = withTiming(0, { duration: 700, easing: Easing.in(Easing.quad) });
      setTimeout(() => {
        setPhrase((p) => (p + 1) % LOADING_PHRASES.length);
        fade.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
      }, 740);
    }, 5200);
    return () => clearInterval(id);
  }, [reduceMotion]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + breath.value * 0.4,
    transform: [{ scale: 0.88 + breath.value * 0.24 }],
  }));
  // Gold shows when the glow is low; charcoal takes over as it peaks. Capped
  // at 0.8 so a sliver of gold always keeps the ring's edge readable against
  // the (now lighter) sky backdrop instead of smudging into the glow.
  const goldStyle = useAnimatedStyle(() => ({
    opacity: 1 - breath.value * 0.8,
    transform: [{ scale: 0.98 + breath.value * 0.05 }],
  }));
  const charcoalStyle = useAnimatedStyle(() => ({
    opacity: breath.value * 0.8,
    transform: [{ scale: 0.98 + breath.value * 0.05 }],
  }));
  // The line doesn't just blink: the outgoing line settles downward as it
  // fades, and the incoming one rises gently into place — a breath, not a swap.
  const phraseStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: (1 - fade.value) * 12 }],
  }));

  return (
    <View style={styles.pageContent}>
      {/* The afterglow sky, heavily dimmed: a still image (not video) on
          purpose, so the wait never competes with the actual loading work.
          The scrim keeps the emblem and phrase owning the contrast. */}
      <Image source={images.landingSky} style={styles.bgImage} resizeMode="cover" blurRadius={3} />
      <LinearGradient
        colors={['rgba(20, 16, 14, 0.92)', 'rgba(24, 19, 16, 0.78)', 'rgba(20, 16, 14, 0.95)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.bgScrim}
        pointerEvents="none"
      />
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
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  bgScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    color: 'rgba(212, 169, 118, 0.9)',
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
