import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import MenuOverlay from '../MenuOverlay';
import PressableScale from '../PressableScale';
import ScreenHeader from '../ScreenHeader';
import Typewriter from '../Typewriter';
import { colors, images } from '../../constants/theme';

export default function Screen1Testimonial() {
  const [menuOpen, setMenuOpen] = useState(false);
  const arrowShift = useSharedValue(0);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowShift.value }],
  }));

  return (
    <View style={styles.screen}>
      <ScreenHeader onMenuPress={() => setMenuOpen(true)} />

      <View style={styles.rotatedTextWrap}>
        <Text style={styles.rotatedName}>Sarah Combrink</Text>
        <Text style={styles.rotatedRole}>Daughter</Text>
      </View>

      <Image source={{ uri: images.portrait }} style={styles.portrait} resizeMode="cover" />

      <Text style={styles.quoteIcon}>&ldquo;</Text>

      <View style={styles.quoteTextWrap}>
        <Typewriter
          text="Every memory we gathered became something we'll treasure forever."
          delay={600}
          speed={18}
          style={styles.quoteText}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Robert Combrink</Text>
        <Text style={styles.cardDate}>Celebration of Life &middot; Sat, 14 Feb</Text>
        <PressableScale
          style={styles.learnMore}
          scaleTo={1}
          onPressIn={() => {
            arrowShift.value = withTiming(4, { duration: 150 });
          }}
          onPressOut={() => {
            arrowShift.value = withTiming(0, { duration: 150 });
          }}
        >
          <Text style={styles.learnMoreText}>View tribute</Text>
          <Animated.Text style={[styles.arrowIcon, arrowStyle]}>&rarr;</Animated.Text>
        </PressableScale>
        <Text style={styles.star}>&#10022;</Text>
      </View>

      <MenuOverlay visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  rotatedTextWrap: {
    position: 'absolute',
    left: -44,
    top: 115,
    transform: [{ rotate: '-90deg' }, { translateX: -60 }],
  },
  rotatedName: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    letterSpacing: 1.2,
    color: colors.textFaintest,
  },
  rotatedRole: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    letterSpacing: 1.2,
    color: colors.textFaintest,
  },
  portrait: {
    position: 'absolute',
    top: 120,
    left: 125,
    width: 240,
    height: 300,
    borderRadius: 16,
  },
  quoteIcon: {
    position: 'absolute',
    left: 19,
    top: 372,
    fontSize: 56,
    lineHeight: 56,
    fontFamily: 'Manrope_500Medium',
    color: colors.gold,
  },
  quoteTextWrap: {
    position: 'absolute',
    left: 19,
    top: 440,
    width: 336,
  },
  quoteText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 20,
    lineHeight: 27,
    color: colors.textFaint,
  },
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 245,
    backgroundColor: colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 36,
    paddingHorizontal: 24,
  },
  cardTitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 36,
    letterSpacing: -0.5,
    color: '#1a1a1a',
  },
  cardDate: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 17,
    color: '#888888',
    marginTop: 8,
  },
  learnMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    alignSelf: 'flex-start',
  },
  learnMoreText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 17,
    color: '#1a1a1a',
  },
  arrowIcon: {
    fontSize: 17,
    color: '#1a1a1a',
  },
  star: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    fontSize: 40,
    color: '#e4b778',
  },
});
