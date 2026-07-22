import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BackdropVideo from '../components/BackdropVideo';
import GoldButton from '../components/GoldButton';
import PressableScale from '../components/PressableScale';
import { colors } from '../constants/theme';
import { api, type Project } from '../lib/api';
import { useActiveProject } from '../lib/useActiveProject';

// The deliverable: the family's finished tribute film, watched in the same
// warm space it was made in. Reachable from the menu's "Watch the film" card,
// which only shows once the admin publishes a video for this memorial.
export default function FilmScreen() {
  const router = useRouter();
  const { projectId } = useActiveProject();
  const [project, setProject] = useState<Project | null>(null);
  const [loaded, setLoaded] = useState(false);

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

  const back = () => router.replace('/app');

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
      </View>

      <View style={styles.content}>
        <Text style={styles.overline}>Everlit · Memorial Films</Text>
        <Text style={styles.title}>
          {project ? `${project.name}’s film` : 'The film'}
        </Text>
        <LinearGradient
          colors={['rgba(196,154,108,0)', 'rgba(212,169,118,0.9)', 'rgba(196,154,108,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.streak}
        />

        {!loaded ? null : project?.videoUrl && Platform.OS === 'web' ? (
          <View style={styles.playerWrap}>
            {React.createElement('video', {
              src: project.videoUrl,
              controls: true,
              playsInline: true,
              style: { width: '100%', height: '100%', objectFit: 'contain', background: '#000', borderRadius: 12 },
            })}
          </View>
        ) : (
          <Text style={styles.pending}>
            {projectId
              ? 'The film is still being made. We’ll place it here, in this exact spot, the moment it’s ready.'
              : 'Open your memorial first, then come back here.'}
          </Text>
        )}

        <PressableScale onPress={back} style={styles.backLink} scaleTo={0.97}>
          <Text style={styles.backText}>Back to the photos</Text>
        </PressableScale>
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
  content: {
    flex: 1,
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
