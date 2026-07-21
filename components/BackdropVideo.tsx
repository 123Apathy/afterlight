import React from 'react';
import { Image, Platform, StyleSheet } from 'react-native';
import { images } from '../constants/theme';

type BackdropVideoProps = {
  // Vertical crop anchor, passed straight through to CSS object-position's
  // Y component. Lets a screen that wants the flame lower/higher in frame
  // (e.g. a page that fades to the video near the bottom) override the
  // default without every screen needing to know the source framing.
  focusY?: string;
};

// Looping candle-flame video backdrop (web only -- no expo-video dependency
// added just for a background loop). Falls back to the static golden-hour
// photo on native. Shared by every full-bleed dark screen (landing gate,
// tribute intake) so they can't drift out of sync with each other again.
export default function BackdropVideo({ focusY = 'center' }: BackdropVideoProps) {
  if (Platform.OS === 'web') {
    return React.createElement('video', {
      src: '/landing-loop.mp4',
      autoPlay: true,
      loop: true,
      muted: true,
      playsInline: true,
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        // Source footage frames the candle right-of-center; on narrow
        // (phone) crops a centered object-position clips it. Shifting
        // toward the video's right side pulls the candle further left
        // into view.
        objectPosition: `75% ${focusY}`,
      },
    });
  }
  return <Image source={images.landingSky} style={StyleSheet.absoluteFill} resizeMode="cover" />;
}
