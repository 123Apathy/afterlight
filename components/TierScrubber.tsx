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

const TRACK_HEIGHT = 220;
const THUMB_SIZE = 40;
const STEP = TRACK_HEIGHT / (TIERS.length - 1);

type TierScrubberProps = {
  tierIndex: number; // 0 = S (top) .. 4 = D (bottom)
  onChange: (tierIndex: number) => void;
};

export default function TierScrubber({ tierIndex, onChange }: TierScrubberProps) {
  const y = useSharedValue(tierIndex * STEP);
  const dragging = useSharedValue(false);

  useEffect(() => {
    if (!dragging.value) {
      y.value = withSpring(tierIndex * STEP, { damping: 18 });
    }
  }, [tierIndex]);

  const commitIndex = (index: number) => {
    onChange(index);
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      dragging.value = true;
    })
    .onUpdate((event) => {
      y.value = Math.max(0, Math.min(TRACK_HEIGHT, event.y));
    })
    .onEnd(() => {
      const nearest = Math.round(y.value / STEP);
      y.value = withSpring(nearest * STEP, { damping: 18 });
      dragging.value = false;
      runOnJS(commitIndex)(nearest);
    });

  useAnimatedReaction(
    () => Math.round(y.value / STEP),
    (current, previous) => {
      if (current !== previous && dragging.value) {
        runOnJS(commitIndex)(current);
      }
    },
    []
  );

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value - THUMB_SIZE / 2 }],
  }));

  const currentTier = TIERS[Math.max(0, Math.min(TIERS.length - 1, tierIndex))];

  return (
    <View style={styles.wrap}>
      <View style={styles.labelWrap}>
        <Text style={[styles.tierLabel, { color: currentTier.color }]}>{currentTier.key}</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.track} testID="tier-scrubber-track">
          {TIERS.map((tier, index) => (
            <View key={tier.key} style={[styles.tick, { top: index * STEP - 1 }]}>
              <Text style={styles.tickLabel}>{tier.key}</Text>
            </View>
          ))}
          <Animated.View style={[styles.thumb, thumbStyle, { backgroundColor: currentTier.color }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 10,
  },
  labelWrap: {
    height: 32,
    justifyContent: 'center',
  },
  tierLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 24,
  },
  track: {
    width: 40,
    height: TRACK_HEIGHT,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'flex-start',
  },
  tick: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    alignItems: 'center',
  },
  tickLabel: {
    position: 'absolute',
    left: 48,
    top: -8,
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: colors.textFaintest,
    width: 20,
  },
  thumb: {
    position: 'absolute',
    left: -4,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.dark,
  },
});
