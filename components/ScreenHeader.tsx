import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, images } from '../constants/theme';
import PressableScale from './PressableScale';

type ScreenHeaderProps = {
  onMenuPress: () => void;
  light?: boolean;
};

export default function ScreenHeader({ onMenuPress }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Image source={{ uri: images.logo }} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brandText}>Afterlight</Text>
      </View>
      <PressableScale onPress={onMenuPress} hitSlop={12} style={styles.hamburger} scaleTo={0.85}>
        <View style={[styles.line, { width: 22 }]} />
        <View style={[styles.line, { width: 22 }]} />
        <View style={[styles.line, { width: 13 }]} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 19,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 46,
    height: 46,
  },
  brandText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 17,
    lineHeight: 20,
    color: colors.white,
  },
  hamburger: {
    gap: 5,
    alignItems: 'flex-end',
  },
  line: {
    height: 1.5,
    backgroundColor: colors.white,
  },
});
