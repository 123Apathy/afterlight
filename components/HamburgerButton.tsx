import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../constants/theme';
import PressableScale from './PressableScale';

type HamburgerButtonProps = {
  onPress: () => void;
  light?: boolean;
};

export default function HamburgerButton({ onPress, light = true }: HamburgerButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={12}
      style={styles.hamburger}
      scaleTo={0.85}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
    >
      <View style={[styles.line, { width: 22 }, !light && styles.lineDark]} />
      <View style={[styles.line, { width: 22 }, !light && styles.lineDark]} />
      <View style={[styles.line, { width: 13 }, !light && styles.lineDark]} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hamburger: {
    gap: 5,
    alignItems: 'flex-end',
    padding: 4,
  },
  line: {
    height: 1.5,
    backgroundColor: colors.white,
  },
  lineDark: {
    backgroundColor: colors.ink,
  },
});
