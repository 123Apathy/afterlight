import 'react-native-gesture-handler';
import {
  Manrope_300Light,
  Manrope_400Regular,
  Manrope_500Medium,
  useFonts,
} from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '../constants/theme';

// Windows/Linux Chromium ignores -webkit-font-smoothing and renders text with
// ClearType-style RGB subpixel AA, which shows as color fringing once a
// screenshot of it gets rescaled or recompressed (as happens when sharing).
// opacity < 1 forces Chromium to drop LCD subpixel AA for grayscale AA, which
// has no color channels to fringe. Chromium doesn't re-rasterize already
// -painted static text on an opacity-only change, so this must run at module
// scope (before React's first commit) rather than in a useEffect, or every
// element that never repaints again keeps its original fringed rasterization.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    [class^="css-text"], [class*=" css-text"] {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      opacity: 0.999;
      will-change: transform;
      transform: translateZ(0);
    }
  `;
  document.head.appendChild(style);
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_300Light,
    Manrope_400Regular,
    Manrope_500Medium,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.pageBg }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
