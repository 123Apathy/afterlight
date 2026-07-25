import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { colors } from '../constants/theme';

// One quiet in-theme notice at a time, bottom-centre, replacing the native
// window.alert boxes that jarred against the candlelit screens. Module-level
// setter so any code can call showToast() without threading props (same
// registry trick as useLocalStorage). ToastHost is mounted once in the root
// layout; showToast is a no-op until then.
let push: ((message: string) => void) | null = null;

export function showToast(message: string) {
  if (push) push(message);
}

const TOAST_MS = 4200;

export default function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);

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
      entering={FadeInDown.duration(220)}
      exiting={FadeOut.duration(180)}
      style={styles.wrap}
      pointerEvents="box-none"
    >
      <Pressable onPress={() => setMessage(null)} style={styles.card}>
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
    fontSize: 14,
    lineHeight: 21,
    color: colors.white,
    textAlign: 'center',
  },
});
