import 'react-native-gesture-handler';
import { useFonts } from '@expo-google-fonts/poppins';
import { Poppins_300Light, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_500Medium_Italic,
} from '@expo-google-fonts/playfair-display';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ToastHost from '../components/Toast';
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

  // iOS Safari zooms the whole page in when a sub-16px input gets focus and
  // never zooms back out, so after posting a comment the app was left cropped
  // into a zoomed viewport. All inputs are now 16px+ (the real fix); this cap
  // is the guard against any future sub-16 input. iOS ONLY: Safari ignores
  // maximum-scale for pinch gestures (accessibility keeps working) but honours
  // it for the focus auto-zoom, while Android Chrome would honour it by
  // disabling pinch zoom entirely, which we do not want.
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) {
    const meta = document.querySelector('meta[name="viewport"]');
    const content = meta?.getAttribute('content') || '';
    if (meta && !/maximum-scale/.test(content)) {
      meta.setAttribute('content', `${content}, maximum-scale=1`);
    }
  }
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
    /* Keyboard-only focus ring, app-wide (mouse/touch don't trigger
       :focus-visible). Same gold treatment the landing page uses. */
    :focus-visible {
      outline: 2px solid #D4A976;
      outline-offset: 3px;
      border-radius: 4px;
    }
  `;
  document.head.appendChild(style);
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_500Medium_Italic,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.dark }} />;
  }

  // Full-bleed at every viewport: the app IS the page on desktop too (the
  // earlier letterboxed "device card" treatment was reverted by request).
  // SafeAreaProvider added 2026-07-28. react-native-safe-area-context was a
  // dependency but was never mounted, so useSafeAreaInsets() reported zero
  // everywhere and nothing in the app knew about the notch or the home
  // indicator. The deck's control labels ended up 1px off the bottom of the
  // screen, which puts "Comment" and "Favourites" underneath the gesture bar on
  // any modern phone. Mounting the provider is what makes the insets real.
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.frame}>
          <Stack screenOptions={{ headerShown: false }} />
          <ToastHost />
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
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
