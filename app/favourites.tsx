import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GoldButton from '../components/GoldButton';
import PressableScale from '../components/PressableScale';
import { colors } from '../constants/theme';
import { DEMO, DEMO_PHOTOS } from '../constants/demo';
import { api, heartCount, photoThumbUrl, type Photo } from '../lib/api';
import { useActiveProject } from '../lib/useActiveProject';

// In-app "everyone's favourites": the photos the family loved, most-loved
// first, with who loved them and what they wrote — replaces kicking families
// out to the server-rendered report page (that page remains the print/PDF
// artifact for the operator).
export default function FavouritesScreen() {
  const router = useRouter();
  const { projectId, projectName } = useActiveProject();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (DEMO) {
      setPhotos(DEMO_PHOTOS);
      setLoaded(true);
      return;
    }
    if (!projectId) {
      setLoaded(true);
      return;
    }
    api
      .getPhotos(projectId)
      .then(setPhotos)
      .catch(() => setPhotos([]))
      .finally(() => setLoaded(true));
  }, [projectId]);

  const hearted = photos
    .filter((p) => heartCount(p) > 0)
    .sort((a, b) => heartCount(b) - heartCount(a));

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <Text style={styles.overline}>Everyone&rsquo;s favourites</Text>
          <Text style={styles.title}>{projectName || 'The moments'} — what the family loved.</Text>
          <LinearGradient
            colors={['rgba(196,154,108,0)', 'rgba(212,169,118,0.9)', 'rgba(196,154,108,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.streak}
          />

          {!loaded ? null : hearted.length === 0 ? (
            <Text style={styles.empty}>
              No favourites yet — go back and double-tap the photos that matter. They&rsquo;ll gather here.
            </Text>
          ) : (
            hearted.map((photo) => {
              const raters = photo.ratings.map((r) => r.rater);
              return (
                <View key={photo.id} style={styles.card}>
                  <Image
                    source={photo.localSource ?? { uri: photoThumbUrl(photo) }}
                    style={styles.cardImage}
                    resizeMode="cover"
                  />
                  <View style={styles.cardBody}>
                    <Text style={styles.cardHearts}>
                      ♥ {heartCount(photo)} · {raters.join(', ')}
                    </Text>
                    {photo.comments.map((c) => (
                      <Text key={c.id} style={styles.cardComment}>
                        <Text style={styles.cardCommentAuthor}>{c.author}</Text>  {c.text}
                      </Text>
                    ))}
                  </View>
                </View>
              );
            })
          )}

          <GoldButton label="Back to the photos" onPress={() => router.replace('/app')} style={styles.backButton} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  scroll: {
    paddingVertical: 56,
    paddingHorizontal: 20,
  },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    alignItems: 'center',
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
    fontSize: 28,
    letterSpacing: -0.3,
    lineHeight: 36,
    color: colors.white,
    textAlign: 'center',
  },
  streak: {
    width: 170,
    height: 1.5,
    borderRadius: 1,
    marginBottom: 8,
  },
  empty: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    lineHeight: 26,
    color: colors.textFainter,
    textAlign: 'center',
    maxWidth: 380,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.darkWarmLight,
    borderWidth: 1,
    borderColor: 'rgba(212, 169, 118, 0.14)',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.ink,
  },
  cardBody: {
    padding: 16,
    gap: 8,
  },
  cardHearts: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: colors.goldWarm,
  },
  cardComment: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: colors.textFaint,
  },
  cardCommentAuthor: {
    fontFamily: 'Poppins_500Medium',
    color: colors.white,
  },
  backButton: {
    marginTop: 16,
    minWidth: 240,
  },
});
