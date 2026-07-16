import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import MenuOverlay from '../MenuOverlay';
import PressableScale from '../PressableScale';
import ScreenHeader from '../ScreenHeader';
import Typewriter from '../Typewriter';
import { colors, images } from '../../constants/theme';

export default function Screen2Hero() {
  const [menuOpen, setMenuOpen] = useState(false);
  const lift = useSharedValue(0);

  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));

  return (
    <View style={styles.screen}>
      <Image source={{ uri: images.hero }} style={styles.hero} resizeMode="cover" />
      <View style={styles.heroOverlay} />

      <ScreenHeader onMenuPress={() => setMenuOpen(true)} />

      <Image source={{ uri: images.avatars }} style={styles.avatars} resizeMode="cover" />

      <View style={styles.headlineWrap}>
        <Typewriter
          text="A beautiful way to say goodbye"
          delay={500}
          speed={26}
          style={styles.headline}
        />
        <Typewriter
          text="Cinematic tribute videos, crafted with heart"
          delay={1900}
          speed={16}
          style={styles.subtext}
        />
      </View>

      <PressableScale
        style={[styles.cta, liftStyle]}
        scaleTo={0.97}
        onHoverIn={() => {
          lift.value = withTiming(-2, { duration: 150 });
        }}
        onHoverOut={() => {
          lift.value = withTiming(0, { duration: 150 });
        }}
      >
        <Text style={styles.ctaText}>Start a tribute</Text>
        <Text style={styles.ctaArrow}>&rarr;</Text>
      </PressableScale>

      <MenuOverlay visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 472,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 472,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  avatars: {
    position: 'absolute',
    left: 19,
    top: 442,
    width: 149,
    height: 53,
    borderRadius: 26,
  },
  headlineWrap: {
    position: 'absolute',
    top: 528,
    left: 19,
    right: 19,
  },
  headline: {
    fontFamily: 'Manrope_300Light',
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.5,
    color: colors.gold,
  },
  subtext: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 21,
    lineHeight: 27,
    color: colors.textFainter,
    marginTop: 20,
  },
  cta: {
    position: 'absolute',
    bottom: 32,
    left: 19,
    right: 19,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 21,
    color: colors.ink,
  },
  ctaArrow: {
    fontSize: 20,
    color: colors.ink,
  },
});
