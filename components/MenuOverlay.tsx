import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, images } from '../constants/theme';
import PressableScale from './PressableScale';

const LINKS = ['Home', 'About', 'Gallery', 'Tributes', 'Contact'];

type MenuOverlayProps = {
  visible: boolean;
  onClose: () => void;
};

export default function MenuOverlay({ visible, onClose }: MenuOverlayProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    const duration = reduceMotion ? 0 : visible ? 220 : 180;
    progress.value = withTiming(visible ? 1 : 0, {
      duration,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [visible, reduceMotion]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
    pointerEvents: visible ? 'auto' : 'none',
  }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={{ uri: images.logo }} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandText}>Afterlight</Text>
        </View>
        <PressableScale onPress={onClose} hitSlop={12} style={styles.closeButton}>
          <View style={[styles.closeLine, { transform: [{ rotate: '45deg' }] }]} />
          <View style={[styles.closeLine, { transform: [{ rotate: '-45deg' }] }]} />
        </PressableScale>
      </View>

      <View style={styles.links}>
        {visible &&
          LINKS.map((link, index) => (
            <Animated.View key={link} entering={FadeIn.duration(200).delay(index * 40)}>
              <Text style={styles.link}>{link}</Text>
            </Animated.View>
          ))}
      </View>

      <PressableScale style={styles.cta} scaleTo={0.97}>
        <Text style={styles.ctaText}>Start a tribute</Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.dark,
    zIndex: 100,
    paddingTop: 48,
    paddingHorizontal: 19,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 46,
    height: 46,
  },
  brandText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 17,
    lineHeight: 20,
    color: colors.white,
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLine: {
    position: 'absolute',
    width: 20,
    height: 1.5,
    backgroundColor: colors.white,
  },
  links: {
    marginTop: 72,
    gap: 22,
  },
  link: {
    fontFamily: 'Manrope_300Light',
    fontSize: 36,
    letterSpacing: -0.8,
    color: colors.white,
  },
  cta: {
    position: 'absolute',
    bottom: 36,
    left: 19,
    right: 19,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 21,
    color: '#1a1a1a',
  },
});
