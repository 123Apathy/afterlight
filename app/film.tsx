import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Atmosphere from '../components/Atmosphere';
import BackdropVideo from '../components/BackdropVideo';
import LoadingState from '../components/LoadingState';
import PressableScale from '../components/PressableScale';
import { colors } from '../constants/theme';
import { api, type Project } from '../lib/api';
import { useActiveProject } from '../lib/useActiveProject';

// The deliverable: the family's finished tribute film, watched in the same
// warm space it was made in. Reachable from the menu's "Watch the film" card,
// which only shows once the admin publishes a video for this memorial.
export default function FilmScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { projectId } = useActiveProject();
  const [project, setProject] = useState<Project | null>(null);
  const [loaded, setLoaded] = useState(false);
  // The film is the deliverable, so arriving at it is a moment, not a page
  // load: the room dims, the title rises out of the dark, the gold streak
  // draws itself, then the player fades up. Skipped under reduced motion.
  const reveal = useSharedValue(0);

  useEffect(() => {
    if (!projectId) {
      setLoaded(true);
      return;
    }
    api
      .getProject(projectId)
      .then(setProject)
      .catch(() => setProject(null))
      .finally(() => setLoaded(true));
  }, [projectId]);

  useEffect(() => {
    if (!loaded) return;
    if (reduceMotion) {
      reveal.value = 1;
      return;
    }
    reveal.value = withDelay(120, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));
  }, [loaded, reduceMotion]);

  // Staged off one clock: each piece reads its own slice of the 0..1 reveal
  // so the sequence can never drift out of order.
  const stage = (from: number, to: number, rise = 18) =>
    useAnimatedStyle(() => {
      const t = Math.max(0, Math.min(1, (reveal.value - from) / (to - from)));
      return { opacity: t, transform: [{ translateY: (1 - t) * rise }] };
    });
  const overlineStyle = stage(0, 0.35);
  const titleStyle = stage(0.12, 0.6, 26);
  const streakStyle = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (reveal.value - 0.3) / 0.35));
    return { opacity: t, transform: [{ scaleX: t }] };
  });
  const bodyStyle = stage(0.5, 1, 14);
  // The room itself lifts: a heavy scrim that thins as the reveal completes.
  const curtainStyle = useAnimatedStyle(() => ({
    opacity: 0.85 * (1 - Math.max(0, Math.min(1, reveal.value / 0.75))),
  }));

  const back = () => router.replace('/app');

  if (!loaded) {
    return <LoadingState reduceMotion={reduceMotion} label="Loading your film" />;
  }

  return (
    <View style={styles.page}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BackdropVideo />
        <LinearGradient
          colors={['rgba(20, 16, 14, 0.95)', 'rgba(24, 19, 16, 0.8)', 'rgba(20, 16, 14, 0.97)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Atmosphere />
      </View>

      {/* The curtain: the room is dark when you arrive, then lifts. */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.curtain, curtainStyle]} pointerEvents="none" />

      <View style={styles.content}>
        <Animated.Text style={[styles.overline, overlineStyle]}>Everlit · Memorial Films</Animated.Text>
        <Animated.Text style={[styles.title, titleStyle]}>
          {project ? `${project.name}’s film` : 'The film'}
        </Animated.Text>
        <Animated.View style={streakStyle}>
          <LinearGradient
            colors={['rgba(196,154,108,0)', 'rgba(212,169,118,0.9)', 'rgba(196,154,108,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.streak}
          />
        </Animated.View>

        {project?.videoUrl && Platform.OS === 'web' ? (
          <Animated.View style={[styles.playerWrap, bodyStyle]}>
            {React.createElement('video', {
              src: project.videoUrl,
              controls: true,
              playsInline: true,
              style: { width: '100%', height: '100%', objectFit: 'contain', background: '#000', borderRadius: 12 },
            })}
          </Animated.View>
        ) : (
          <Animated.Text style={[styles.pending, bodyStyle]}>
            {projectId
              ? 'Your film will be ready to watch and download right here 24 hours before the due date, and within 48 hours of everyone’s choices being submitted or the deadline being reached, whichever comes first. We’ll place it in this exact spot the moment it’s ready.'
              : 'Open your memorial first, then come back here.'}
          </Animated.Text>
        )}

        <Animated.View style={bodyStyle}>
          <PressableScale
            onPress={back}
            style={styles.backLink}
            scaleTo={0.97}
            accessibilityRole="button"
            accessibilityLabel="Back to the photos"
          >
            <Text style={styles.backText}>Back to the photos</Text>
          </PressableScale>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.dark,
    overflow: 'hidden',
  },
  // Sits above the backdrop, below the content: the darkened room.
  curtain: {
    backgroundColor: 'rgb(10, 8, 7)',
    zIndex: 2,
  },
  content: {
    flex: 1,
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 18,
  },
  overline: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.goldWarm,
  },
  title: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 34,
    letterSpacing: -0.4,
    color: colors.white,
    textAlign: 'center',
  },
  streak: {
    width: 170,
    height: 1.5,
    borderRadius: 1,
  },
  playerWrap: {
    width: '100%',
    maxWidth: 960,
    aspectRatio: 16 / 9,
    marginTop: 10,
  },
  pending: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    lineHeight: 26,
    color: colors.textFainter,
    textAlign: 'center',
    maxWidth: 420,
    marginTop: 8,
  },
  backLink: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  backText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: colors.textFainter,
    textDecorationLine: 'underline',
  },
});
