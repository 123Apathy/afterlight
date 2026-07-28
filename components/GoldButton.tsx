import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, type } from '../constants/theme';
import PressableScale from './PressableScale';

type GoldButtonProps = {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  pill?: boolean;
  // Keyboard focusability, on by default. The end-of-deck slide passes false
  // while it is offscreen so Tab cannot land on an invisible button.
  focusable?: boolean;
};

// The primary action, everywhere. A soft top-to-bottom gold gradient with a
// warm shadow reads more refined than a flat bright fill.
export default function GoldButton({ label, onPress, style, textStyle, pill, focusable = true }: GoldButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      style={[styles.wrap, pill && styles.pill, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
      // tabIndex, not focusable: react-native-web's Pressable keeps its
      // rendered tabindex at 0 regardless of focusable={false}.
      tabIndex={focusable ? 0 : -1}
      aria-hidden={!focusable}
    >
      <LinearGradient
        colors={[colors.goldWarm, colors.goldDeep]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none">
        <Text style={[styles.label, textStyle]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 54,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.goldDeep,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  pill: {
    borderRadius: 999,
  },
  label: {
    fontFamily: 'Poppins_500Medium',
    // 15 -> 17. This is the product's primary button ("Come in", "Begin",
    // "Finish"), the one obvious action on almost every gate, and it was below
    // the reading floor. Buttons size to their content, so growing the label
    // grows the target too, which is the right direction for these readers.
    fontSize: type.action,
    letterSpacing: 0.4,
    color: colors.ink,
  },
});
