import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import HamburgerButton from '../components/HamburgerButton';
import MenuOverlay from '../components/MenuOverlay';
import CommentSheet from '../components/CommentSheet';
import PressableScale from '../components/PressableScale';
import { colors, copy, images } from '../constants/theme';
import { DEMO, DEMO_PHOTOS } from '../constants/demo';
import { api, heartCount, isFavoritedBy, photoUrl, type Photo } from '../lib/api';
import { useActiveProject } from '../lib/useActiveProject';
import { useLocalStorage } from '../lib/useLocalStorage';

const DOUBLE_TAP_MS = 280;
const MOTION_DURATION = 240;
const ENTRANCE_DURATION = 360;
const STAGGER_DELAY = 45;

export default function SwipeScreen() {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { projectId, setProject, known } = useActiveProject();
  const [raterName, setRaterName] = useLocalStorage('afterlight.rater', '');
  const [nameDraft, setNameDraft] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentPhotoId, setCommentPhotoId] = useState<string | null>(null);

  const refresh = async () => {
    if (DEMO) {
      // Seed once; keep the reviewer's in-memory favourites/comments across
      // menu opens instead of resetting them.
      setPhotos((prev) => (prev.length ? prev : DEMO_PHOTOS));
      setLoading(false);
      return;
    }
    if (!projectId) return;
    try {
      const data = await api.getPhotos(projectId);
      setPhotos(data);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [projectId]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const created = await api.createProject(newProjectName.trim());
      setProject(created);
      setNewProjectName('');
    } catch {
      if (typeof window !== 'undefined') {
        window.alert("Couldn't create the project. Check your connection and try again.");
      }
    } finally {
      setCreatingProject(false);
    }
  };

  const toggleFavorite = async (photo: Photo) => {
    const alreadyFavorited = isFavoritedBy(photo, raterName);
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id !== photo.id) return p;
        const nextRatings = alreadyFavorited
          ? p.ratings.filter((r) => r.rater.toLowerCase() !== raterName.toLowerCase())
          : [
              ...p.ratings,
              { id: 'optimistic', photoId: p.id, rater: raterName, score: 1, createdAt: new Date().toISOString() },
            ];
        return { ...p, ratings: nextRatings, ratingCount: nextRatings.length };
      })
    );
    if (DEMO) return; // in-memory only, no backend
    try {
      if (alreadyFavorited) {
        await api.unfavoritePhoto(photo.id, raterName);
      } else {
        await api.favoritePhoto(photo.id, raterName);
      }
    } catch {
      if (typeof window !== 'undefined') {
        window.alert("That didn't save — check your connection and try again.");
      }
      refresh();
    }
  };

  const addComment = async (photo: Photo, text: string) => {
    const optimistic = {
      id: `optimistic-${photo.id}-${Date.now()}`,
      photoId: photo.id,
      author: raterName,
      text,
      createdAt: new Date().toISOString(),
    };
    setPhotos((prev) =>
      prev.map((p) => (p.id === photo.id ? { ...p, comments: [...p.comments, optimistic] } : p))
    );
    if (DEMO) return; // in-memory only, no backend
    try {
      await api.addComment(photo.id, raterName, text);
    } catch {
      if (typeof window !== 'undefined') {
        window.alert("That comment didn't save — check your connection and try again.");
      }
      refresh();
    }
  };

  if (!projectId && !DEMO) {
    return (
      <View style={styles.page}>
        <HorizonGlow />
        <View style={styles.headerOverlay} pointerEvents="box-none">
          <View style={styles.header}>
            <View style={styles.brand}>
              <Image source={images.logo} style={styles.logo} resizeMode="contain" />
              <Text style={styles.brandText}>Afterlight</Text>
            </View>
          </View>
        </View>
        <View style={styles.gate}>
          <Image source={images.lockup} style={styles.lockup} resizeMode="contain" />
          <Text style={styles.gateTitle}>{copy.landing.title}</Text>
          <Text style={styles.gateSubtitle}>
            {copy.landing.subtitle}
          </Text>
          <TextInput
            value={newProjectName}
            onChangeText={setNewProjectName}
            placeholder="Person's name or occasion…"
            placeholderTextColor={colors.textFaintest}
            style={styles.gateInput}
            onSubmitEditing={handleCreateProject}
          />
          <PressableScale style={styles.gateButton} onPress={handleCreateProject} scaleTo={0.97}>
            <Text style={styles.gateButtonText}>{creatingProject ? 'Creating...' : 'Begin'}</Text>
          </PressableScale>

          {known.length > 0 && (
            <View style={styles.knownBlock}>
              <Text style={styles.knownLabel}>Or open one you&rsquo;re already part of</Text>
              {known.map((k) => (
                <PressableScale
                  key={k.id}
                  style={styles.knownRow}
                  onPress={() => setProject(k)}
                  scaleTo={0.98}
                >
                  <Text style={styles.knownName}>{k.name}</Text>
                  <Text style={styles.knownChevron}>›</Text>
                </PressableScale>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  }

  if (!raterName) {
    return (
      <View style={styles.page}>
        <HorizonGlow />
        <View style={styles.headerOverlay} pointerEvents="box-none">
          <View style={styles.header}>
            <View style={styles.brand}>
              <Image source={images.logo} style={styles.logo} resizeMode="contain" />
              <Text style={styles.brandText}>Afterlight</Text>
            </View>
          </View>
        </View>
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>Who&rsquo;s here?</Text>
          <Text style={styles.gateSubtitle}>
            Your name will appear with your favorites so we can see whose moments resonated most.
          </Text>
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            placeholder="Your name"
            placeholderTextColor={colors.textFaintest}
            style={styles.gateInput}
            onSubmitEditing={() => setRaterName(nameDraft.trim())}
          />
          <PressableScale
            style={styles.gateButton}
            onPress={() => nameDraft.trim() && setRaterName(nameDraft.trim())}
            scaleTo={0.97}
          >
            <Text style={styles.gateButtonText}>Enter</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {loading ? (
        <LoadingState reduceMotion={reduceMotion} />
      ) : loadError ? (
        <ErrorState
          onRetry={() => {
            setLoading(true);
            refresh();
          }}
        />
      ) : photos.length === 0 ? (
        <EmptyState onUpload={() => setMenuOpen(true)} />
      ) : (
        <PhotoDeck
          photos={photos}
          width={width}
          height={height}
          raterName={raterName}
          onToggleFavorite={toggleFavorite}
          onOpenComments={(photo) => setCommentPhotoId(photo.id)}
          reduceMotion={reduceMotion}
        />
      )}

      <CommentSheet
        photo={photos.find((p) => p.id === commentPhotoId) ?? null}
        onClose={() => setCommentPhotoId(null)}
        onSubmit={addComment}
      />

      <View style={styles.headerOverlay} pointerEvents="box-none">
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image source={images.logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandText}>Afterlight</Text>
          </View>
          <HamburgerButton onPress={() => setMenuOpen(true)} />
        </View>
      </View>

      <MenuOverlay
        visible={menuOpen}
        onClose={() => {
          setMenuOpen(false);
          refresh();
        }}
      />
    </View>
  );
}

function LoadingState({ reduceMotion }: { reduceMotion: boolean }) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withSequence(
      withTiming(1, { duration: 800, easing: Easing.bezier(0.25, 0.46, 0.45, 0.94) }),
      withTiming(0.5, { duration: 800, easing: Easing.bezier(0.25, 0.46, 0.45, 0.94) })
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.pageContent}>
      <View style={styles.emptyState}>
        <View style={styles.emptyCard}>
          <Animated.Text style={[styles.loadingDot, style]}>•</Animated.Text>
          <Text style={styles.emptySubtitle}>Opening the space…</Text>
        </View>
      </View>
    </View>
  );
}

// The empty state is a preview of the real swipe screen — same chrome
// (counter, scrims, heart row) with the first-photo invitation where the
// photo will be. The screen never looks unfinished, just unfilled.
function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <View style={styles.pageContent}>
      <HorizonGlow />
      <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent']} style={styles.topScrim} pointerEvents="none" />
      <LinearGradient
        colors={['transparent', 'rgba(16, 14, 12, 0.75)']}
        style={styles.bottomScrim}
        pointerEvents="none"
      />

      <View style={styles.counter}>
        <Text style={styles.counterText}>00</Text>
        <Text style={styles.counterSeparator}>/</Text>
        <Text style={styles.counterText}>00</Text>
      </View>

      <View style={styles.emptyState}>
        <View style={styles.heroMark}>
          <View style={[styles.glowRing, styles.glowRingOuter]} />
          <View style={[styles.glowRing, styles.glowRingMid]} />
          <View style={[styles.glowRing, styles.glowRingInner]} />
          <Image source={images.logo} style={styles.heroLogo} resizeMode="contain" />
        </View>
        <Text style={styles.emptyTitle}>The first photo goes here</Text>
        <Text style={styles.emptySubtitle}>
          Add the photos you have — everyone you invite swipes through them and keeps their favourites.
        </Text>
        <PressableScale style={styles.emptyButton} onPress={onUpload} scaleTo={0.97}>
          <Text style={styles.emptyButtonText}>Upload photos</Text>
        </PressableScale>
      </View>

      <View style={styles.heartRow} pointerEvents="none">
        <View>
          <Text style={styles.heartCountLabel}>Tap ♡ to favourite</Text>
          <Text style={styles.heartRaters}>favourites and comments gather here</Text>
        </View>
        <View style={styles.heartButtonContainer}>
          <Text style={[styles.heartIcon, styles.heartIconGhost]}>♡</Text>
        </View>
      </View>
    </View>
  );
}

// Landing/gate backdrop: the real golden-hour photograph, dimmed under a warm
// dark scrim so it reads as depth behind the copy — not a bright sky fighting
// white text. Scrim is darkest top & bottom (text zones), lets the glow through
// the middle where the hero mark sits.
function HorizonGlow() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image source={images.landingSky} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(20, 16, 14, 0.92)', 'rgba(24, 19, 16, 0.62)', 'rgba(20, 16, 14, 0.95)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.pageContent}>
      <View style={styles.emptyState}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Something shifted</Text>
          <Text style={styles.emptySubtitle}>
            We couldn&rsquo;t load the photos. Check your connection and try again.
          </Text>
          <PressableScale style={styles.emptyButton} onPress={onRetry} scaleTo={0.97}>
            <Text style={styles.emptyButtonText}>Try again</Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

type PhotoDeckProps = {
  photos: Photo[];
  width: number;
  height: number;
  raterName: string;
  onToggleFavorite: (photo: Photo) => void;
  onOpenComments: (photo: Photo) => void;
  reduceMotion: boolean;
};

function PhotoDeck({
  photos,
  width,
  height,
  raterName,
  onToggleFavorite,
  onOpenComments,
  reduceMotion,
}: PhotoDeckProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(photos.length - 1, next));
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    setIndex(clamped);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={StyleSheet.absoluteFill}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {photos.map((photo, i) => (
          <PhotoSlide
            key={photo.id}
            photo={photo}
            index={i}
            total={photos.length}
            width={width}
            height={height}
            raterName={raterName}
            onToggleFavorite={onToggleFavorite}
            onOpenComments={onOpenComments}
            reduceMotion={reduceMotion}
          />
        ))}
      </ScrollView>

      <View style={styles.navRow} pointerEvents="box-none">
        <PressableScale
          onPress={() => goTo(index - 1)}
          scaleTo={0.9}
          hitSlop={10}
          style={[styles.navButton, index === 0 && styles.navButtonDisabled]}
        >
          <Text style={styles.navButtonText}>‹</Text>
        </PressableScale>
        <PressableScale
          onPress={() => goTo(index + 1)}
          scaleTo={0.9}
          hitSlop={10}
          style={[styles.navButton, index === photos.length - 1 && styles.navButtonDisabled]}
        >
          <Text style={styles.navButtonText}>›</Text>
        </PressableScale>
      </View>
    </View>
  );
}

type PhotoSlideProps = {
  photo: Photo;
  index: number;
  total: number;
  width: number;
  height: number;
  raterName: string;
  onToggleFavorite: (photo: Photo) => void;
  onOpenComments: (photo: Photo) => void;
  reduceMotion: boolean;
};

function PhotoSlide({
  photo,
  index,
  total,
  width,
  height,
  raterName,
  onToggleFavorite,
  onOpenComments,
  reduceMotion,
}: PhotoSlideProps) {
  const favorited = isFavoritedBy(photo, raterName);
  const count = heartCount(photo);
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const burst = useSharedValue(0);
  const lastTap = useRef(0);

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value,
    transform: [{ scale: 0.5 + burst.value * 0.7 }],
  }));

  const playBurst = () => {
    if (reduceMotion) return;
    burst.value = withSequence(
      withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 340, easing: Easing.in(Easing.cubic) })
    );
  };

  const handleHeartPress = () => {
    if (!reduceMotion) {
      scale.value = withSequence(withSpring(1.28, { damping: 5 }), withSpring(1, { damping: 8 }));
      glowOpacity.value = withSequence(
        withTiming(0.6, { duration: 120 }),
        withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) })
      );
    }
    onToggleFavorite(photo);
  };

  // Double-tap = favourite (never un-favourite), Instagram-style. The heart
  // burst always plays on a double-tap, even when it was already a favourite.
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      if (!favorited) onToggleFavorite(photo);
      playBurst();
    } else {
      lastTap.current = now;
    }
  };

  return (
    <Pressable onPress={handleTap} style={{ width, height }}>
      <Image
        source={photo.localSource ?? { uri: photoUrl(photo) }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent']} style={styles.topScrim} pointerEvents="none" />
      <LinearGradient
        colors={['transparent', 'rgba(16, 14, 12, 0.75)']}
        style={styles.bottomScrim}
        pointerEvents="none"
      />

      <Animated.Text style={[styles.burstHeart, burstStyle]} pointerEvents="none">
        ♥
      </Animated.Text>

      <View style={styles.counter}>
        <Text style={styles.counterText}>{String(index + 1).padStart(2, '0')}</Text>
        <Text style={styles.counterSeparator}>/</Text>
        <Text style={styles.counterText}>{String(total).padStart(2, '0')}</Text>
      </View>

      <View style={styles.heartRow}>
        <View style={styles.heartLabels}>
          {count > 0 ? (
            <View style={styles.likePill}>
              <Text style={styles.likePillHeart}>♥</Text>
              <Text style={styles.likePillCount}>{count}</Text>
            </View>
          ) : (
            <Text style={styles.heartCountLabel}>Tap ♡ to favourite</Text>
          )}
          <PressableScale onPress={() => onOpenComments(photo)} scaleTo={0.96} hitSlop={8}>
            <Text style={styles.commentLink}>
              {photo.comments.length > 0
                ? `${photo.comments.length} comment${photo.comments.length === 1 ? '' : 's'}`
                : 'Add a comment'}
            </Text>
          </PressableScale>
        </View>
        <View style={styles.heartButtonContainer}>
          <Animated.View style={[styles.glowPulse, glowStyle]} pointerEvents="none" />
          <PressableScale onPress={handleHeartPress} scaleTo={0.82} hitSlop={16}>
            <Animated.Text style={[styles.heartIcon, favorited && styles.heartIconActive, heartStyle]}>
              {favorited ? '♥' : '♡'}
            </Animated.Text>
          </PressableScale>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.dark,
    overflow: 'hidden', // clip the full-res backdrop image to the viewport
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 19,
    paddingBottom: 12,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 7,
  },
  brandText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    letterSpacing: 0.3,
    color: colors.white,
  },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 28,
    paddingBottom: 80,
  },
  gateTagline: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    fontStyle: 'italic',
    letterSpacing: 0.4,
    color: colors.goldWarm,
    textAlign: 'center',
  },
  gateTitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 34,
    letterSpacing: -0.6,
    lineHeight: 42,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  gateSubtitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    lineHeight: 26,
    color: colors.textFainter,
    textAlign: 'center',
    maxWidth: 360,
    marginVertical: 4,
  },
  gateInput: {
    width: '100%',
    maxWidth: 340,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(212, 169, 118, 0.2)',
    paddingHorizontal: 18,
    color: colors.white,
    fontFamily: 'Manrope_400Regular',
    fontSize: 16,
    marginTop: 12,
  },
  gateButton: {
    width: '100%',
    maxWidth: 340,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.goldWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateButtonText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    letterSpacing: 0.3,
    color: colors.ink,
  },
  knownBlock: {
    width: '100%',
    maxWidth: 340,
    marginTop: 24,
    gap: 10,
  },
  knownLabel: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: colors.textFaintest,
    textAlign: 'center',
    marginBottom: 4,
  },
  knownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: colors.darkWarmLight,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  knownName: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 17,
    color: colors.white,
  },
  knownChevron: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 26,
    color: colors.textFaintest,
  },
  loadingDot: {
    fontSize: 64,
    color: colors.goldWarm,
    lineHeight: 64,
  },
  lockup: {
    width: 280,
    height: 185,
    alignSelf: 'center',
    marginBottom: 8,
  },
  heroMark: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  glowRing: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: colors.goldWarm,
  },
  glowRingOuter: { width: 180, height: 180, opacity: 0.05 },
  glowRingMid: { width: 132, height: 132, opacity: 0.09 },
  glowRingInner: { width: 92, height: 92, opacity: 0.14 },
  heroLogo: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  heartLabels: {
    flex: 1,
    marginRight: 16,
  },
  heartIconGhost: {
    color: 'rgba(255, 255, 255, 0.35)',
  },
  pageContent: {
    flex: 1,
    backgroundColor: colors.dark,
    overflow: 'hidden',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  emptyCard: {
    backgroundColor: colors.darkWarmLight,
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 48,
    alignItems: 'center',
    gap: 16,
  },
  emptyTitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 26,
    letterSpacing: -0.3,
    color: colors.white,
    textAlign: 'center',
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    lineHeight: 24,
    color: colors.textFainter,
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyButton: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 26,
    backgroundColor: colors.goldWarm,
  },
  emptyButtonText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    letterSpacing: 0.2,
    color: colors.ink,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  counter: {
    position: 'absolute',
    top: 32,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  counterText: {
    fontFamily: 'Courier New',
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  counterSeparator: {
    fontFamily: 'Courier New',
    fontSize: 10,
    letterSpacing: 1,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  heartRow: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 36,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.35,
  },
  navButtonText: {
    fontSize: 26,
    lineHeight: 30,
    color: colors.white,
    marginTop: -2,
  },
  heartCountLabel: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.88)',
    lineHeight: 20,
  },
  heartRaters: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: colors.goldWarm,
    marginTop: 4,
  },
  likePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likePillHeart: {
    fontSize: 18,
    lineHeight: 22,
    color: colors.heart,
  },
  likePillCount: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.92)',
  },
  commentLink: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 6,
  },
  heartButtonContainer: {
    position: 'relative',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowPulse: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.heart,
  },
  heartIcon: {
    fontSize: 42,
    lineHeight: 46,
    color: 'rgba(255, 255, 255, 0.85)',
    zIndex: 2,
  },
  heartIconActive: {
    color: colors.heart,
  },
  burstHeart: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    fontSize: 120,
    lineHeight: 132,
    color: colors.heart,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowRadius: 24,
  },
});
