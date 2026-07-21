import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../constants/theme';
import PressableScale from './PressableScale';

type ViewModeButtonProps = {
  mode: 'deck' | 'grid';
  onPress: () => void;
};

// Shows what tapping it switches *to*: a 3x3 grid glyph while browsing the
// deck (tap to see everything at once), a stacked-card glyph while in the
// grid (tap to go back to swiping).
export default function ViewModeButton({ mode, onPress }: ViewModeButtonProps) {
  return (
    <PressableScale onPress={onPress} hitSlop={12} style={styles.button} scaleTo={0.85}>
      {mode === 'deck' ? (
        <View style={styles.grid}>
          {Array.from({ length: 9 }).map((_, i) => (
            <View key={i} style={styles.gridCell} />
          ))}
        </View>
      ) : (
        <View style={styles.stack}>
          <View style={[styles.stackCard, styles.stackCardBack]} />
          <View style={[styles.stackCard, styles.stackCardFront]}>
            <View style={styles.stackCardDot} />
          </View>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    width: 18,
    height: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  gridCell: {
    width: 4.67,
    height: 4.67,
    backgroundColor: colors.white,
  },
  stack: {
    width: 20,
    height: 20,
  },
  stackCard: {
    position: 'absolute',
    width: 13,
    height: 16,
    borderRadius: 2.5,
    borderWidth: 1.4,
    borderColor: colors.white,
    alignItems: 'flex-end',
    padding: 2,
  },
  stackCardBack: {
    left: 7,
    top: 0,
    opacity: 0.45,
  },
  stackCardFront: {
    left: 0,
    top: 4,
    backgroundColor: colors.dark,
  },
  stackCardDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.white,
  },
});
