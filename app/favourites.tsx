import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Atmosphere from '../components/Atmosphere';
import LoadingState from '../components/LoadingState';
import PressableScale from '../components/PressableScale';
import { colors, images, type } from '../constants/theme';
import { DEMO, DEMO_PHOTOS } from '../constants/demo';
import { api, heartCount, photoAltText, photoThumbUrl, type Photo } from '../lib/api';
import { glassBlur } from '../lib/glass';
import { useActiveProject } from '../lib/useActiveProject';

// In-app "everyone's favourites": the photos the family loved, most-loved
// first, with who loved them and what they wrote — replaces kicking families
// out to the server-rendered report page (that page remains the print/PDF
// artifact for the operator).
export default function FavouritesScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { projectId, projectName } = useActiveProject();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

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
      // A failed fetch used to fall into setPhotos([]), which renders the EMPTY
      // state: "No favourites yet." So a dropped connection told the family
      // their memorial was empty, and told a room watching a demo that the
      // product does not work. Failure and emptiness are different things and
      // must not look the same.
      .catch(() => setLoadError(true))
      .then((p) => { if (p) setPhotos(p); })
      .finally(() => setLoaded(true));
  }, [projectId]);

  const hearted = photos
    .filter((p) => heartCount(p) > 0)
    .sort((a, b) => heartCount(b) - heartCount(a));

  if (!loaded) {
    return <LoadingState reduceMotion={reduceMotion} label="Loading your favourites" />;
  }

  return (
    <View style={styles.page}>
      {/* The afterglow sky under a dark scrim, with embers drifting: the same
          atmosphere as the loading screen so the whole app breathes one air.
          A still image on purpose (long scrolling list, keep paint cheap);
          it sits outside the ScrollView so it never scrolls or blocks touches. */}
      <Image source={images.landingSky} style={styles.bgImage} resizeMode="cover" blurRadius={3} />
      <LinearGradient
        colors={['rgba(20, 16, 14, 0.9)', 'rgba(24, 19, 16, 0.82)', 'rgba(20, 16, 14, 0.96)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.bgImage}
        pointerEvents="none"
      />
      <Atmosphere />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <Text style={styles.overline}>Everyone&rsquo;s favourites</Text>
          <Text style={styles.title}>
            {projectName
              ? `What your family will always remember about ${projectName}`
              : 'What your family will always remember'}
          </Text>
          <LinearGradient
            colors={['rgba(196,154,108,0)', 'rgba(212,169,118,0.9)', 'rgba(196,154,108,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.streak}
          />

          {loadError ? (
            <View style={styles.emptyWrap}>
              <Image source={images.logoRing} style={styles.emptyEmblem} resizeMode="contain" />
              <Text style={styles.empty}>
                We couldn&rsquo;t reach the memorial just now, so these are not showing. Your
                family&rsquo;s favourites are safe. Check your connection and open this again.
              </Text>
            </View>
          ) : hearted.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Image source={images.logoRing} style={styles.emptyEmblem} resizeMode="contain" />
              {/* Leads with the labelled heart button, not the double-tap.
                  Pointing people at the gesture first sent them down the path
                  most likely to fail them. */}
              <Text style={styles.empty}>
                No favourites yet. Go back and tap the heart under any photo that matters to you (or
                double-tap the photo itself), and they&rsquo;ll gather here for the whole family to see.
              </Text>
            </View>
          ) : (
            hearted.map((photo) => {
              const raters = photo.ratings.map((r) => r.rater);
              return (
                <View key={photo.id} style={styles.card}>
                  <View style={styles.cardImageWrap}>
                    <Image
                      source={photo.localSource ?? { uri: photoThumbUrl(photo) }}
                      style={styles.cardImage}
                      resizeMode="cover"
                      accessibilityLabel={photoAltText(photo, projectName)}
                    />
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.heartRow}>
                      <Text style={styles.heartCountText}>
                        <Text style={styles.heartGlyph}>♥</Text> {heartCount(photo)}
                      </Text>
                      {raters.length > 0 && (
                        <Text style={styles.lovedBy} numberOfLines={1}>
                          Loved by {raters.join(', ')}
                        </Text>
                      )}
                    </View>
                    {photo.comments.length > 0 && (
                      <View style={styles.commentStack}>
                        {photo.comments.map((c) => (
                          <Text key={c.id} style={styles.cardComment}>
                            <Text style={styles.cardCommentAuthor}>{c.author}</Text>{'  '}
                            {c.text}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}

        </View>
      </ScrollView>

      {/* The pill floats over a scrolling list, so whatever happens to be at
          that height sits behind it. Without this scrim a card's "Loved by
          ..." line was simply chopped in half mid-sentence. The gradient lets
          content dissolve into the bottom edge on approach, which reads as
          deliberate instead of broken, and it gives the glass pill a
          consistently dark backing on any card. */}
      <LinearGradient
        colors={['rgba(20, 16, 14, 0)', 'rgba(20, 16, 14, 0.72)', 'rgba(20, 16, 14, 0.94)']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backScrim}
        pointerEvents="none"
      />

      {/* Floating back pill: with a long list (a real memorial has 100+
          photos) a bottom-of-scroll button left people feeling stuck. Always
          visible, glass so it never fully hides the card behind it. */}
      <View style={styles.backFloatWrap} pointerEvents="box-none">
        <PressableScale
          // back() when we can. replace() remounted the whole app: a second
          // full "Gathering the moments" loading screen, all 40 photos
          // refetched, and the deck dumped back to photo 1. Same pattern
          // already used in tribute.tsx:56.
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/app'))}
          scaleTo={0.96}
          style={[styles.backPill, glassBlur]}
          accessibilityRole="button"
          accessibilityLabel="Back to the photos"
        >
          <Text style={styles.backPillChevron}>‹</Text>
          <Text style={styles.backPillText}>Back to the photos</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  scroll: {
    paddingTop: 56,
    // Extra bottom room so the last card scrolls clear of the floating pill.
    paddingBottom: 120,
    paddingHorizontal: 20,
  },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 20,
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
    fontSize: 29,
    letterSpacing: -0.3,
    lineHeight: 38,
    color: colors.white,
    textAlign: 'center',
  },
  streak: {
    width: 170,
    height: 1.5,
    borderRadius: 1,
    marginBottom: 8,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  emptyWrap: {
    alignItems: 'center',
    gap: 18,
    paddingVertical: 24,
  },
  emptyEmblem: {
    width: 64,
    height: 64,
    opacity: 0.7,
  },
  empty: {
    fontFamily: 'Poppins_400Regular',
    fontSize: type.body,
    lineHeight: 26,
    color: colors.textFainter,
    textAlign: 'center',
    maxWidth: 380,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(32, 26, 24, 0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  cardImageWrap: {
    width: '100%',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    // Square rather than a fixed 340px tall: at phone width the two are
    // near-identical (a full-bleed card is ~343 wide), but the card grows to
    // maxWidth 640 on a tablet or desktop, where a locked 340 turned every
    // photograph into a ~1.9:1 letterbox and cropped the top of people's heads.
    aspectRatio: 1,
    backgroundColor: colors.ink,
  },
  cardBody: {
    padding: 18,
    gap: 10,
  },
  heartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  // Plain and quiet: a bigger red heart, white count, no chrome around it.
  heartGlyph: {
    fontSize: 22,
    lineHeight: 24,
    color: colors.heart,
  },
  heartCountText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    color: colors.white,
  },
  lovedBy: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: colors.textFaint,
    flexShrink: 1,
  },
  commentStack: {
    gap: 6,
    paddingTop: 2,
  },
  cardComment: {
    fontFamily: 'Poppins_400Regular',
    fontSize: type.body,
    lineHeight: 24,
    color: colors.textFaint,
  },
  cardCommentAuthor: {
    fontFamily: 'Poppins_500Medium',
    color: colors.white,
  },
  backScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 132,
  },
  backFloatWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: 'rgba(32, 26, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  backPillChevron: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 22,
    lineHeight: 24,
    color: colors.goldWarm,
    marginTop: -2,
  },
  backPillText: {
    fontFamily: 'Poppins_500Medium',
    // This pill is the ONLY way off this screen: no header, no wordmark, no
    // menu. It was smaller than the buttons it competes with.
    fontSize: type.action,
    color: colors.white,
  },
});
