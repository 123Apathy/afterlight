import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BackdropVideo from './BackdropVideo';
import Atmosphere from './Atmosphere';

// The candlelit backdrop used by every gate: the muted candle loop, a vertical
// dark gradient that keeps the middle band readable, then film grain + rising
// embers. Lives here rather than inside app.tsx because /join needs the same
// atmosphere, and the arrival screen should not be lit differently from the
// screen it hands off to.
export default function HorizonGlow() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BackdropVideo />
      <LinearGradient
        colors={['rgba(20, 16, 14, 0.92)', 'rgba(24, 19, 16, 0.62)', 'rgba(20, 16, 14, 0.95)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Atmosphere />
    </View>
  );
}
