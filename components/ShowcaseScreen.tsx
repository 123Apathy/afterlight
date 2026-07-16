import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import AppNav from './AppNav';
import PhoneFrame from './PhoneFrame';
import Screen1Testimonial from './screens/Screen1Testimonial';
import Screen2Hero from './screens/Screen2Hero';
import Screen3Sermons from './screens/Screen3Sermons';
import { ARTBOARD_HEIGHT, ARTBOARD_WIDTH, colors } from '../constants/theme';

const FRAME_WIDTH = ARTBOARD_WIDTH + 14;
const FRAME_HEIGHT = ARTBOARD_HEIGHT + 14;
const MOBILE_BREAKPOINT = 900;

export default function ShowcaseScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;

  const padding = isMobile ? 20 : 40;
  const gap = isMobile ? 32 : 48;
  const scale = isMobile ? Math.min(1, (width - padding * 2) / FRAME_WIDTH) : 1;

  const phones = [
    { key: 'testimonial', delay: 0, node: <Screen1Testimonial /> },
    { key: 'hero', delay: 150, node: <Screen2Hero /> },
    { key: 'sermons', delay: 300, node: <Screen3Sermons /> },
  ];

  return (
    <View style={styles.page}>
      <AppNav />
      <ScrollView
        horizontal={!isMobile}
        showsHorizontalScrollIndicator={!isMobile}
        showsVerticalScrollIndicator={isMobile}
        contentContainerStyle={[
          styles.content,
          isMobile ? styles.contentMobile : styles.contentDesktop,
          { padding, gap },
        ]}
      >
        {phones.map((phone) => (
          <View
            key={phone.key}
            style={
              isMobile
                ? { width: FRAME_WIDTH * scale, height: FRAME_HEIGHT * scale }
                : undefined
            }
          >
            <View
              style={
                isMobile
                  ? { transform: [{ scale }], transformOrigin: 'top left' }
                  : undefined
              }
            >
              <PhoneFrame delay={phone.delay}>{phone.node}</PhoneFrame>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  content: {
    alignItems: 'center',
  },
  contentDesktop: {
    flexDirection: 'row',
    justifyContent: 'center',
    minWidth: '100%',
  },
  contentMobile: {
    flexDirection: 'column',
  },
});
