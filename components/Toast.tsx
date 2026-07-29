import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { colors, type } from '../constants/theme';

// One quiet in-theme notice at a time, bottom-centre, replacing the native
// window.alert boxes that jarred against the candlelit screens. Module-level
// setter so any code can call showToast() without threading props (same
// registry trick as useLocalStorage). ToastHost is mounted once in the root
// layout; showToast is a no-op until then.
let push: ((message: string) => void) | null = null;

export function showToast(message: string) {
  if (push) push(message);
}

// 7000, not 4200: a toast is often two lines of 14px copy carrying a real
// failure, and this product's readers are mostly elderly. It stays tappable to
// dismiss early.
const TOAST_MS = 7000;

export default function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    push = setMessage;
    return () => {
      push = null;
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;
  return (
    <Animated.View
      // Every other animated component in the tree honours reduced motion;
      // this one never did. Reduced keeps the fade but drops the slide.
      entering={reduceMotion ? FadeIn.duration(220) : FadeInDown.duration(220)}
      exiting={FadeOut.duration(180)}
      style={styles.wrap}
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
    >
      <Pressable
        onPress={() => setMessage(null)}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`Close this message: ${message}`}
      >
        <Text style={styles.text}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 32,
    alignItems: 'center',
    zIndex: 200,
  },
  card: {
    maxWidth: 420,
    backgroundColor: 'rgba(28, 22, 20, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(212, 169, 118, 0.4)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  text: {
    fontFamily: 'Poppins_400Regular',
    fontSize: type.body,
    lineHeight: 24,
    color: colors.white,
    textAlign: 'center',
  },
});
