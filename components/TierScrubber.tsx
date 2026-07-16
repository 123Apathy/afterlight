import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors } from '../constants/theme';
import { TIERS } from '../constants/tiers';

const TRACK_HEIGHT = 52;
const THUMB_SIZE = 44;

type TierScrubberProps = {
  tierIndex: number; // 0 = S (left, best) .. 4 = D (right, skip)
  onChange: (tierIndex: number) => void;
  width: number;
};

export default function TierScrubber({ tierIndex, onChange, width }: TierScrubberProps) {
  const trackWidth = width;
  const step = trackWidth / (TIERS.length - 1);
  const x = useSharedValue(tierIndex * step);
  const dragging = useSharedValue(false);

  useEffect(() => {
    if (!dragging.value) {
      x.value = withSpring(tierIndex * step, { damping: 18 });
    }
  }, [tierIndex, trackWidth]);

  const commitIndex = (index: number) => {
    onChange(index);
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      dragging.value = true;
    })
    .onUpdate((event) => {
      x.value = Math.max(0, Math.min(trackWidth, event.x));
    })
    .onEnd(() => {
      const nearest = Math.round(x.value / step);
      x.value = withSpring(nearest * step, { damping: 18 });
      dragging.value = false;
      runOnJS(commitIndex)(nearest);
    });

  useAnimatedReaction(
    () => Math.round(x.value / step),
    (current, previous) => {
      if (current !== previous && dragging.value) {
        runOnJS(commitIndex)(current);
      }
    },
    [step]
  );

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - THUMB_SIZE / 2 }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(THUMB_SIZE / 2, x.value + THUMB_SIZE / 2),
  }));

  const currentTier = TIERS[Math.max(0, Math.min(TIERS.length - 1, tierIndex))];

  return (
    <View style={[styles.wrap, { width: trackWidth }]}>
      <View style={styles.tickRow}>
        {TIERS.map((tier, index) => (
          <Text
            key={tier.key}
            style={[styles.tickLabel, index === tierIndex && { color: tier.color, fontFamily: 'Manrope_500Medium' }]}
          >
            {tier.key}
          </Text>
        ))}
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.track} testID="tier-scrubber-track">
          <Animated.View style={[styles.fill, fillStyle, { backgroundColor: currentTier.color }]} />
          <Animated.View style={[styles.thumb, thumbStyle]}>
            <Text style={styles.thumbLabel}>{currentTier.key}</Text>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  tickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  tickLabel: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: colors.textFaintest,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
    opacity: 0.22,
  },
  thumb: {
    position: 'absolute',
    top: (TRACK_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  thumbLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: colors.ink,
  },
});
