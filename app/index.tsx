import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import BottomTabBar from '../components/BottomTabBar';
import HamburgerButton from '../components/HamburgerButton';
import MenuOverlay from '../components/MenuOverlay';
import PressableScale from '../components/PressableScale';
import Typewriter from '../components/Typewriter';
import { colors, images } from '../constants/theme';
import { api } from '../lib/api';
import { useActiveProject } from '../lib/useActiveProject';

export default function HomeScreen() {
  const [menuOpen, setMenuOpen] = useState(false);
  const arrowShift = useSharedValue(0);
  const { projectId, projectName, setProject } = useActiveProject();
  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowShift.value }],
  }));

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      const created = await api.createProject(newProjectName.trim());
      setProject(created);
      setNewProjectName('');
    } finally {
      setCreating(false);
    }
  };

  if (!projectId) {
    return (
      <View style={styles.page}>
        <View style={[styles.header, styles.headerStandalone]}>
          <View style={styles.brand}>
            <Image source={{ uri: images.logo }} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandText}>Afterlight</Text>
          </View>
          <HamburgerButton onPress={() => setMenuOpen(true)} />
        </View>
        <View style={styles.onboarding}>
          <Text style={styles.onboardingTitle}>Start a project</Text>
          <Text style={styles.onboardingSubtitle}>
            Create a project for the person you&rsquo;re honoring, or use an invite link someone
            shared with you.
          </Text>
          <TextInput
            value={newProjectName}
            onChangeText={setNewProjectName}
            placeholder="e.g. Brenda's tribute"
            placeholderTextColor={colors.textFaintest}
            style={styles.onboardingInput}
            onSubmitEditing={handleCreateProject}
          />
          <PressableScale style={styles.onboardingButton} onPress={handleCreateProject} scaleTo={0.97}>
            <Text style={styles.onboardingButtonText}>{creating ? 'Creating...' : 'Create project'}</Text>
          </PressableScale>
        </View>
        <MenuOverlay visible={menuOpen} onClose={() => setMenuOpen(false)} />
        <BottomTabBar />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image source={{ uri: images.logo }} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandText}>Afterlight</Text>
          </View>
          <HamburgerButton onPress={() => setMenuOpen(true)} />
        </View>

        <View style={styles.portraitRow}>
          <View style={styles.rotatedTextColumn}>
            <View style={styles.rotatedTextWrap}>
              <Text style={styles.rotatedName}>{projectName}</Text>
              <Text style={styles.rotatedRole}>Open project</Text>
            </View>
          </View>
          <Image source={{ uri: images.portrait }} style={styles.portrait} resizeMode="cover" />
        </View>

        <Text style={styles.quoteIcon}>&ldquo;</Text>
        <Typewriter
          text="Every memory we gathered became something we'll treasure forever."
          delay={400}
          speed={18}
          style={styles.quote}
        />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{projectName}</Text>
          <Text style={styles.cardSubtitle}>Gathering photos &amp; planning the service</Text>
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
            <Text style={styles.learnMoreText}>Rate photos</Text>
            <Animated.Text style={[styles.arrowIcon, arrowStyle]}>&rarr;</Animated.Text>
          </PressableScale>
          <Text style={styles.star}>&#10022;</Text>
        </View>
      </ScrollView>

      <MenuOverlay visible={menuOpen} onClose={() => setMenuOpen(false)} />
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
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerStandalone: {
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  onboarding: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },
  onboardingTitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 28,
    color: colors.white,
    textAlign: 'center',
  },
  onboardingSubtitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: colors.textFainter,
    textAlign: 'center',
    maxWidth: 320,
  },
  onboardingInput: {
    width: '100%',
    maxWidth: 320,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    color: colors.white,
    fontFamily: 'Manrope_400Regular',
    fontSize: 16,
    marginTop: 8,
  },
  onboardingButton: {
    width: '100%',
    maxWidth: 320,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingButtonText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: colors.ink,
  },
  portraitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rotatedTextColumn: {
    width: 24,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotatedTextWrap: {
    width: 140,
    alignItems: 'center',
    transform: [{ rotate: '-90deg' }],
  },
  rotatedName: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    letterSpacing: 1.2,
    color: colors.textFaintest,
  },
  rotatedRole: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    letterSpacing: 1.2,
    color: colors.textFaintest,
  },
  portrait: {
    flex: 1,
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
    paddingBottom: 24,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  cardTitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 26,
    letterSpacing: -0.5,
    color: '#1a1a1a',
  },
  cardSubtitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: '#888888',
    marginTop: 4,
  },
  learnMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
    alignSelf: 'flex-start',
  },
  learnMoreText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    color: '#1a1a1a',
  },
  arrowIcon: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  star: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    fontSize: 32,
    color: colors.gold,
  },
});
