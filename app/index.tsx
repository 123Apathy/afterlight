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
import PressableScale from '../components/PressableScale';
import { colors, copy, images } from '../constants/theme';
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
  const { projectId, setProject } = useActiveProject();
  const [raterName, setRaterName] = useLocalStorage('afterlight.rater', '');
  const [nameDraft, setNameDraft] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);

  const refresh = async () => {
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

  const handleDoubleTap = (photo: Photo) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === photo.id && now - last.time < DOUBLE_TAP_MS) {
      lastTapRef.current = null;
      if (!isFavoritedBy(photo, raterName)) toggleFavorite(photo);
    } else {
      lastTapRef.current = { id: photo.id, time: now };
    }
  };

  if (!projectId) {
    return (
      <View style={styles.page}>
        <HorizonGlow />
        <View style={styles.headerOverlay} pointerEvents="box-none">
          <View style={styles.header}>
            <View style={styles.brand}>
              <Image source={images.logo} style={styles.logo} resizeMode="contain" />
              <Text style={styles.brandText}>Afterlight</Text>
            </View>
            <HamburgerButton onPress={() => setMenuOpen(true)} />
          </View>
        </View>
        <View style={styles.gate}>
          <View style={styles.heroMark}>
            <View style={[styles.glowRing, styles.glowRingOuter]} />
            <View style={[styles.glowRing, styles.glowRingMid]} />
            <View style={[styles.glowRing, styles.glowRingInner]} />
            <Image source={images.logo} style={styles.heroLogo} resizeMode="contain" />
          </View>
          <Text style={styles.gateTagline}>{copy.slogan}</Text>
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
          onDoubleTap={handleDoubleTap}
          reduceMotion={reduceMotion}
        />
      )}

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
          <Text style={styles.heartCountLabel}>Tap ♡ to keep a moment</Text>
          <Text style={styles.heartRaters}>the favourites gather here</Text>
        </View>
        <View style={styles.heartButtonContainer}>
          <Text style={[styles.heartIcon, styles.heartIconGhost]}>♡</Text>
        </View>
      </View>
    </View>
  );
}

// Cheap re-impl of the reference "blur-halo vignette": layered gradients +
// concentric rings instead of a filter blur, so it costs nothing on mobile.
function HorizonGlow() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#181310', '#261D17', '#171210']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['transparent', 'rgba(212, 169, 118, 0.07)', 'transparent']}
        locations={[0.25, 0.5, 0.75]}
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
  onDoubleTap: (photo: Photo) => void;
  reduceMotion: boolean;
};

function PhotoDeck({ photos, width, height, raterName, onToggleFavorite, onDoubleTap, reduceMotion }: PhotoDeckProps) {
  return (
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={StyleSheet.absoluteFill}>
      {photos.map((photo, index) => (
        <PhotoSlide
          key={photo.id}
          photo={photo}
          index={index}
          total={photos.length}
          width={width}
          height={height}
          raterName={raterName}
          onToggleFavorite={onToggleFavorite}
          onDoubleTap={onDoubleTap}
          reduceMotion={reduceMotion}
        />
      ))}
    </ScrollView>
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
  onDoubleTap: (photo: Photo) => void;
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
  onDoubleTap,
  reduceMotion,
}: PhotoSlideProps) {
  const favorited = isFavoritedBy(photo, raterName);
  const count = heartCount(photo);
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

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

  return (
    <Pressable onPress={() => onDoubleTap(photo)} style={{ width, height }}>
      <Image source={{ uri: photoUrl(photo) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent']} style={styles.topScrim} pointerEvents="none" />
      <LinearGradient
        colors={['transparent', 'rgba(16, 14, 12, 0.75)']}
        style={styles.bottomScrim}
        pointerEvents="none"
      />

      <View style={styles.counter}>
        <Text style={styles.counterText}>{String(index + 1).padStart(2, '0')}</Text>
        <Text style={styles.counterSeparator}>/</Text>
        <Text style={styles.counterText}>{String(total).padStart(2, '0')}</Text>
      </View>

      <View style={styles.heartRow}>
        <View style={styles.heartLabels}>
          <Text style={styles.heartCountLabel}>
            {count > 0 ? `${count} favourite${count === 1 ? '' : 's'}` : 'Tap ♡ to keep this one'}
          </Text>
          {count > 0 && (
            <Text style={styles.heartRaters} numberOfLines={1}>
              {photo.ratings.map((r) => r.rater).join(' · ')}
            </Text>
          )}
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
  loadingDot: {
    fontSize: 64,
    color: colors.goldWarm,
    lineHeight: 64,
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
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: colors.goldWarm,
  },
  heartIcon: {
    fontSize: 42,
    lineHeight: 46,
    color: 'rgba(255, 255, 255, 0.85)',
    zIndex: 2,
  },
  heartIconActive: {
    color: colors.goldWarm,
  },
});
