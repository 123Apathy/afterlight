import { useRouter } from 'expo-router';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import BottomTabBar from '../components/BottomTabBar';
import PressableScale from '../components/PressableScale';
import Typewriter from '../components/Typewriter';
import { colors, images } from '../constants/theme';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Image source={{ uri: images.logo }} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandText}>Afterlight</Text>
        </View>

        <Image source={{ uri: images.portrait }} style={styles.portrait} resizeMode="cover" />

        <Text style={styles.quoteIcon}>&ldquo;</Text>
        <Typewriter
          text="Every memory we gathered became something we'll treasure forever."
          delay={400}
          speed={18}
          style={styles.quote}
        />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Robert Combrink</Text>
          <Text style={styles.cardSubtitle}>Celebration of Life &middot; Sat, 14 Feb</Text>
        </View>

        <View style={styles.actions}>
          <PressableScale style={styles.actionCard} onPress={() => router.push('/rate')} scaleTo={0.97}>
            <Text style={styles.actionTitle}>Rate Photos</Text>
            <Text style={styles.actionSubtitle}>Pick the best photos together</Text>
            <Text style={styles.actionArrow}>&rarr;</Text>
          </PressableScale>

          <PressableScale style={styles.actionCard} onPress={() => router.push('/kanban')} scaleTo={0.97}>
            <Text style={styles.actionTitle}>Arrangements</Text>
            <Text style={styles.actionSubtitle}>Plan the service, step by step</Text>
            <Text style={styles.actionArrow}>&rarr;</Text>
          </PressableScale>
        </View>
      </ScrollView>

      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  brandText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 17,
    color: colors.white,
  },
  portrait: {
    width: '100%',
    height: 280,
    borderRadius: 16,
  },
  quoteIcon: {
    marginTop: 20,
    fontSize: 40,
    lineHeight: 40,
    fontFamily: 'Manrope_500Medium',
    color: colors.gold,
  },
  quote: {
    marginTop: 4,
    fontFamily: 'Manrope_400Regular',
    fontSize: 19,
    lineHeight: 26,
    color: colors.textFaint,
  },
  card: {
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cardTitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 24,
    color: colors.white,
  },
  cardSubtitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: colors.textFainter,
    marginTop: 4,
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  actionCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: colors.gold,
  },
  actionTitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 20,
    color: colors.ink,
  },
  actionSubtitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: colors.ink,
    opacity: 0.75,
    marginTop: 2,
  },
  actionArrow: {
    position: 'absolute',
    right: 20,
    top: 20,
    fontSize: 20,
    color: colors.ink,
  },
});
