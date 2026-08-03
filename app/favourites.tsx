import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Atmosphere from '../components/Atmosphere';
import LoadingState from '../components/LoadingState';
import PressableScale from '../components/PressableScale';
import { colors, images, type } from '../constants/theme';
import { DEMO, DEMO_PHOTOS } from '../constants/demo';
import { api, heartCount, photoAltText, photoThumbUrl, type Photo, type Project } from '../lib/api';
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
  // Only to know whether a tribute film exists yet: the footer invites the
  // family onward to it, but never advertises a film that isn't there
  // (honest posture — no dead destinations). Best-effort, null on failure.
  const [project, setProject] = useState<Project | null>(null);

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
    api
      .getProject(projectId)
      .then(setProject)
      .catch(() => setProject(null));
  }, [projectId]);

  const hearted = photos
    .filter((p) => heartCount(p) > 0)
    .sort((a, b) => heartCount(b) - heartCount(a));

  if (!loaded) {
    return <LoadingState reduceMotion={reduceMotion} label="Loading your favourites" />;
  }

  return (
    <View style={styles.page}>
      {/* The candle under a dark scrim, with embers drifting. Every other
          destination screen is lit by the candle (BackdropVideo); this one was
          lit by sky, the only screen in a different light. A still frame, not
          the video, on purpose (long scrolling list, keep paint cheap); it
          sits outside the ScrollView so it never scrolls or blocks touches. */}
      <Image source={images.candleStill} style={styles.bgImage} resizeMode="cover" blurRadius={3} />
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
            hearted.map((photo, i) => {
              const raters = photo.ratings.map((r) => r.rater);
              // The list is ranked by hearts but every card looked the same,
              // so the ranking was invisible. One quiet accent on #1 only,
              // and only when there is actually a competition to win.
              const mostLoved = i === 0 && hearted.length > 1;
              return (
                <Animated.View
                  key={photo.id}
                  // Same soft staggered arrival the grid tiles get; the first
                  // cards lead, the tail never waits (delay capped, and the
                  // cards below the fold enter as they're scrolled to anyway).
                  entering={reduceMotion ? undefined : FadeIn.duration(320).delay(Math.min(i, 6) * 70)}
                  style={[styles.card, mostLoved && styles.cardMostLoved]}
                >
                  <View style={styles.cardImageWrap}>
                    <Image
                      source={photo.localSource ?? { uri: photoThumbUrl(photo) }}
                      style={styles.cardImage}
                      resizeMode="cover"
                      accessibilityLabel={photoAltText(photo, projectName)}
                    />
                  </View>
                  <View style={styles.cardBody}>
                    {mostLoved && <Text style={styles.mostLovedLabel}>Most loved</Text>}
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
                        {/* The words first, the name as attribution after — a
                            remembered thing said about them, not a chat log
                            with author prefixes. */}
                        {photo.comments.map((c) => (
                          <Text key={c.id} style={styles.cardComment}>
                            {c.text}
                            <Text style={styles.cardCommentAuthor}>{'  — '}{c.author}</Text>
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                </Animated.View>
              );
            })
          )}

          {/* Sign-off, mirroring the grid's footer: the payoff screen used to
              just stop scrolling while the grid closed with a streak, the name
              and a count. The most emotional list in the app now ends on
              purpose. */}
          {hearted.length > 0 && (
            <View style={styles.footer}>
              <LinearGradient
                colors={['rgba(196,154,108,0)', 'rgba(212,169,118,0.9)', 'rgba(196,154,108,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.footerStreak}
              />
              <Text style={styles.footerBrand}>{projectName || 'Everlit'}</Text>
              <Text style={styles.footerLine}>The moments your family holds closest.</Text>
              <Text style={styles.footerMeta}>
                {hearted.length} {hearted.length === 1 ? 'memory' : 'memories'} loved
              </Text>
              {/* The payoff chain's next step: these favourites become the
                  film. Only offered once a film actually exists to watch. */}
              {!!project?.videoUrl && (
                <PressableScale
                  onPress={() => router.push('/film')}
                  scaleTo={0.97}
                  style={styles.filmLink}
                  accessibilityRole="button"
                  accessibilityLabel="Watch the tribute film"
                >
                  <Text style={styles.filmLinkText}>Watch the tribute film</Text>
                  <Text style={styles.filmLinkChevron}>›</Text>
                </PressableScale>
              )}
            </View>
          )}

        </View>
      </ScrollView>

      {/* Floating app header: this was the only content screen with no
          wordmark, so arriving here read like leaving the product. Same
          scrim + lockup language as the deck and the gates; the lockup is a
          second, always-visible way back. */}
      <View style={styles.headerOverlay} pointerEvents="box-none">
        <LinearGradient
          colors={['rgba(20, 16, 14, 0.9)', 'rgba(20, 16, 14, 0.6)', 'rgba(20, 16, 14, 0)']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.headerRow}>
          <PressableScale
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/app'))}
            scaleTo={0.96}
            hitSlop={8}
            style={styles.brand}
            accessibilityRole="button"
            accessibilityLabel="Back to the photos"
          >
            <Image source={images.logoGold} style={styles.brandFlame} resizeMode="contain" />
            <Text style={styles.brandText}>Everlit</Text>
          </PressableScale>
          {hearted.length > 0 && (
            <Text
              style={styles.headerCount}
              accessibilityLabel={`${hearted.length} favourite ${hearted.length === 1 ? 'photo' : 'photos'}`}
            >
              <Text style={styles.headerCountHeart}>♥</Text> {hearted.length}
            </Text>
          )}
        </View>
      </View>

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
    // Clears the 84px floating header (the deck and grid use the same figure).
    paddingTop: 104,
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
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 84,
    zIndex: 20,
  },
  headerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 19,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandFlame: {
    width: 42,
    height: 42,
  },
  brandText: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 21,
    letterSpacing: 0.2,
    color: colors.white,
  },
  // Glanceable meta (icon + digits), so type.label rather than body.
  headerCount: {
    fontFamily: 'Poppins_500Medium',
    fontSize: type.label,
    color: colors.white,
  },
  headerCountHeart: {
    fontSize: type.label,
    color: colors.heart,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 44,
    gap: 10,
  },
  footerStreak: {
    width: 170,
    height: 1.5,
    borderRadius: 1,
    marginBottom: 6,
  },
  footerBrand: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    letterSpacing: 0.3,
    color: colors.white,
  },
  footerLine: {
    fontFamily: 'Poppins_400Regular',
    fontSize: type.label,
    lineHeight: 22,
    color: colors.textFainter,
    textAlign: 'center',
  },
  footerMeta: {
    fontFamily: 'Poppins_400Regular',
    fontSize: type.overline,
    letterSpacing: 3,
    textTransform: 'uppercase',
    // Same AA-checked dim gold the grid footer settled on (~4.9:1).
    color: 'rgba(212, 169, 118, 0.78)',
  },
  // Same quiet gold-tinted control language as PhotoGrid's "Open comments" row.
  filmLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 20,
    marginTop: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 169, 118, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212, 169, 118, 0.3)',
  },
  filmLinkText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: type.label,
    color: colors.goldWarm,
  },
  filmLinkChevron: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    color: colors.goldWarm,
    marginTop: -2,
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
  // The #1 card swaps its white hairline for a gold one. Border only — no
  // glow, no scale; the ranking should be felt, not announced.
  cardMostLoved: {
    borderColor: 'rgba(212, 169, 118, 0.45)',
  },
  mostLovedLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: type.overline,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(212, 169, 118, 0.78)',
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
    fontSize: type.body,
    color: colors.white,
  },
  // WHO loved the photo is this screen's whole point; it was 13px meta.
  // Sentence floor, and a step brighter than the comment prose around it.
  lovedBy: {
    fontFamily: 'Poppins_400Regular',
    fontSize: type.body,
    color: 'rgba(255, 255, 255, 0.88)',
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
    fontSize: type.label,
    color: colors.goldWarm,
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
