import 'react-native-gesture-handler';
import { useFonts } from '@expo-google-fonts/poppins';
import { Poppins_300Light, Poppins_400Regular, Poppins_500Medium } from '@expo-google-fonts/poppins';
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_500Medium_Italic,
} from '@expo-google-fonts/playfair-display';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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
  document.title = 'Everlit';
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
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_500Medium_Italic,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.dark }} />;
  }

  // Full-bleed at every viewport: the app IS the page on desktop too (the
  // earlier letterboxed "device card" treatment was reverted by request).
  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.frame}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0b0908',
  },
  frame: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.dark,
    position: 'relative',
    overflow: 'hidden',
  },
});
