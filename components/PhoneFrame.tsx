import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ARTBOARD_HEIGHT, ARTBOARD_WIDTH } from '../constants/theme';

type PhoneFrameProps = {
  children: React.ReactNode;
  delay?: number;
};

export default function PhoneFrame({ children, delay = 0 }: PhoneFrameProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(600).delay(delay)}
      style={styles.shadowWrap}
    >
      <View style={styles.frame}>
        <View style={styles.artboard}>{children}</View>
        <View style={styles.notch} />
        <View style={styles.homeIndicator} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
  },
  frame: {
    width: ARTBOARD_WIDTH + 14,
    height: ARTBOARD_HEIGHT + 14,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#2a2a2a',
    backgroundColor: '#000',
    padding: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artboard: {
    width: ARTBOARD_WIDTH,
    height: ARTBOARD_HEIGHT,
    borderRadius: 44,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  notch: {
    position: 'absolute',
    top: 18,
    alignSelf: 'center',
    width: 126,
    height: 36,
    backgroundColor: '#000',
    borderRadius: 18,
  },
  homeIndicator: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
});
