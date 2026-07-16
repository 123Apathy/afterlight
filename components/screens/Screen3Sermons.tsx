import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import PressableScale from '../PressableScale';
import Typewriter from '../Typewriter';
import { colors, images } from '../../constants/theme';

type TributeItem = {
  day: string;
  month: string;
  title: string;
  time: string;
  cardStyle: 'white' | 'gold';
  faded?: boolean;
};

const TRIBUTES: TributeItem[] = [
  {
    day: '14',
    month: 'Dec',
    title: 'Robert Combrink | A Life Well Lived',
    time: 'Full tribute video',
    cardStyle: 'white',
  },
  {
    day: '21',
    month: 'Nov',
    title: 'Margaret Hayes | Celebration of Life',
    time: 'Full tribute video',
    cardStyle: 'gold',
  },
  {
    day: '02',
    month: 'Nov',
    title: 'The van der Merwe Family | In Loving Memory',
    time: 'Full tribute video',
    cardStyle: 'gold',
  },
  {
    day: '18',
    month: 'Oct',
    title: 'James Okafor | Remembering a Friend',
    time: '',
    cardStyle: 'gold',
    faded: true,
  },
];

export default function Screen3Sermons() {
  return (
    <View style={styles.screen}>
      <View style={styles.heroWrap}>
        <Image source={{ uri: images.gallery }} style={styles.hero} resizeMode="cover" />
        <View style={styles.heroOverlay} />
        <PressableScale style={styles.playButton} scaleTo={0.9}>
          <Animated.Text entering={ZoomIn.duration(320).delay(550)} style={styles.playIcon}>
            &#9654;
          </Animated.Text>
        </PressableScale>
      </View>

      <View style={styles.body}>
        <View style={styles.darkBand}>
          <Typewriter text="Recent Tributes" delay={400} speed={30} style={styles.sectionTitle} />
        </View>

        <View style={styles.eventsList}>
          {TRIBUTES.map((item, index) => (
            <Animated.View
              key={item.title}
              entering={FadeIn.duration(220).delay(400 + index * 50)}
            >
              <View style={[styles.eventRow, item.faded && styles.eventRowFaded]}>
                <PressableScale
                  style={[
                    styles.dateCard,
                    item.cardStyle === 'gold' ? styles.dateCardGold : styles.dateCardWhite,
                  ]}
                  scaleTo={0.94}
                >
                  <Text style={styles.dateDay}>{item.day}</Text>
                  <Text style={styles.dateMonth}>{item.month}</Text>
                </PressableScale>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{item.title}</Text>
                  {!!item.time && <Text style={styles.eventTime}>{item.time}</Text>}
                </View>
              </View>
            </Animated.View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  heroWrap: {
    position: 'absolute',
    top: 0,
    left: -20,
    width: 415,
    height: 345,
  },
  hero: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    position: 'absolute',
    top: 175,
    left: 375 / 2 - 65 / 2 + 20,
    width: 65,
    height: 65,
    borderRadius: 33,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 22,
    color: colors.ink,
    marginLeft: 3,
  },
  body: {
    position: 'absolute',
    top: 343,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  darkBand: {
    height: 220,
    backgroundColor: colors.dark,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 34,
    letterSpacing: -0.8,
    color: colors.white,
  },
  eventsList: {
    paddingHorizontal: 24,
    marginTop: 24,
    gap: 22,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  eventRowFaded: {
    opacity: 0.5,
  },
  dateCard: {
    width: 68,
    height: 90,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCardWhite: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  dateCardGold: {
    backgroundColor: colors.goldSoft,
  },
  dateDay: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 30,
    color: '#1a1a1a',
  },
  dateMonth: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 16,
    color: '#1a1a1a',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 19,
    lineHeight: 24,
    color: '#1a1a1a',
  },
  eventTime: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: '#999999',
    marginTop: 4,
  },
});
