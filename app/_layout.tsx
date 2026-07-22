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
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors, stageWidth } from '../constants/theme';

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
  const { width: winWidth, height: winHeight } = useWindowDimensions();
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

  // The app card scales with the viewport (see stageWidth). When the viewport
  // is wider than the card, backdrop shows around it -- that's "desktop", where
  // we round the card + add a rim so it reads as an intentional floating device
  // rather than a clipped column. When it fills the width (a phone) it's flush.
  const frameW = stageWidth(winWidth, winHeight);
  const framed = winWidth > frameW + 1;

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      {/* On desktop the app card sits on this warm brand field instead of dead
          black, so the mobile experience reads as intentionally framed rather
          than a broken layout. On a real phone the card fills the screen and
          this is never seen. */}
      <LinearGradient
        colors={['#0b0908', '#1b1512', '#0b0908']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backdrop}
        pointerEvents="none"
      />
      <View style={[styles.frame, { maxWidth: frameW }, framed && styles.frameFramed]}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0b0908',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  frame: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.dark,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
  // Desktop only (backdrop visible around the card): round it and add a faint
  // rim so it reads as a deliberate floating device.
  frameFramed: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
});
