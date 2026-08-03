import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Atmosphere from '../components/Atmosphere';
import BackdropVideo from '../components/BackdropVideo';
import LoadingState from '../components/LoadingState';
import PressableScale from '../components/PressableScale';
import { colors, images, type } from '../constants/theme';
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
  // The pending state's ringed emblem breathes like the loading screen's:
  // the film being made is the app quietly at work, and the ring is the mark
  // reserved for ceremony moments. Held still under reduced motion.
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [reduceMotion]);
  const emblemStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + breath.value * 0.25,
    transform: [{ scale: 1 + breath.value * 0.04 }],
  }));

  // The film opens from black, so without a poster the player sat as a dead
  // black rectangle until someone pressed play. The memorial's first photo is
  // its cover art (the same image the deck opens on), which is exactly what a
  // film case would wear. Full-size URL, not the thumb: the player renders up
  // to 960px wide. Best-effort — no photos, no poster, same as before.
  const [poster, setPoster] = useState<string | null>(null);
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
    api
      .getPhotos(projectId)
      .then((photos) => setPoster(photos[0]?.url ?? null))
      .catch(() => setPoster(null));
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

  // back() when we can, so returning from the film does not remount the app
  // and reset the deck to photo 1. Falls back to replace on a cold open.
  const back = () => (router.canGoBack() ? router.back() : router.replace('/app'));

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
              preload: 'metadata',
              poster: poster ?? undefined,
              style: { width: '100%', height: '100%', objectFit: 'contain', background: '#000', borderRadius: 12 },
            })}
          </Animated.View>
        ) : (
          <Animated.View style={[styles.pendingWrap, bodyStyle]}>
            {/* The ceremony ring, breathing: the wait IS the product working,
                so it borrows the loading screen's language instead of leaving
                a bare sentence alone in the dark. */}
            <Animated.Image
              source={images.logoRing}
              style={[styles.pendingEmblem, emblemStyle]}
              resizeMode="contain"
            />
            <Text style={styles.pending}>
              {projectId
                // Was a 43-word delivery clause naming a "due date" and a
                // "deadline" the product never collects or shows, and promising a
                // download on a screen with no download control. It read like a
                // courier contract on the screen that sells the whole thing.
                // No name here: the title directly above already says "<name>'s
                // film", and repeating it read as a stutter.
                ? 'It’s being made now. We’ll place it right here, and let you know the moment it’s ready.'
                : 'Open your memorial first, then come back here.'}
            </Text>
            {/* The custom song is the offer's crown jewel (the landing leads
                with it) and this screen never mentioned it. Only when a film
                is actually coming. */}
            {/* !! not just &&: an empty-string projectId would render as a
                bare text node, which react-native-web hard-errors on. */}
            {!!projectId && (
              <Text style={styles.pendingSong}>
                An original song, written from your memories, is being composed for it.
              </Text>
            )}
          </Animated.View>
        )}

        <Animated.View style={[styles.linksCol, bodyStyle]}>
          {/* After the film, back to the people: the favourites are what the
              film was cut from. Only once there is a film to have watched. */}
          {!!project?.videoUrl && (
            <PressableScale
              onPress={() => router.push('/favourites')}
              style={styles.favLink}
              scaleTo={0.97}
              accessibilityRole="button"
              accessibilityLabel="See everyone's favourites"
            >
              <Text style={styles.favLinkText}>See everyone&rsquo;s favourites</Text>
            </PressableScale>
          )}
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
    fontSize: type.overline,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.goldWarm,
  },
  title: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: type.display,
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
  pendingWrap: {
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  pendingEmblem: {
    width: 72,
    height: 72,
  },
  pending: {
    fontFamily: 'Poppins_400Regular',
    fontSize: type.body,
    lineHeight: 27,
    color: colors.textFaint,
    textAlign: 'center',
    maxWidth: 420,
  },
  pendingSong: {
    fontFamily: 'Poppins_400Regular',
    fontSize: type.body,
    lineHeight: 26,
    color: colors.textFainter,
    textAlign: 'center',
    maxWidth: 380,
  },
  linksCol: {
    alignItems: 'center',
    gap: 2,
    marginTop: 8,
  },
  favLink: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  favLinkText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: type.body,
    color: colors.goldWarm,
  },
  backLink: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backText: {
    fontFamily: 'Poppins_400Regular',
    // Scale migration: was a stray 15. The only exit on this screen, read by
    // elderly eyes in the dark — rounded up to the sentence floor, not down.
    fontSize: type.body,
    color: colors.textFainter,
    textDecorationLine: 'underline',
  },
});
