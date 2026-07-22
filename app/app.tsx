import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import HamburgerButton from '../components/HamburgerButton';
import ViewModeButton from '../components/ViewModeButton';
import MenuOverlay from '../components/MenuOverlay';
import CommentSheet from '../components/CommentSheet';
import PhotoGrid from '../components/PhotoGrid';
import PressableScale from '../components/PressableScale';
import GoldButton from '../components/GoldButton';
import BackdropVideo from '../components/BackdropVideo';
import { colors, copy, images, stageWidth } from '../constants/theme';
import { DEMO, DEMO_PHOTOS } from '../constants/demo';
import { API_BASE, api, heartCount, isFavoritedBy, photoUrl, setInviteCode, type Photo, type Project } from '../lib/api';
import { useActiveProject } from '../lib/useActiveProject';
import { useLocalStorage } from '../lib/useLocalStorage';
import { glassBlur, glassSurface } from '../lib/glass';

const DOUBLE_TAP_MS = 280;
const MOTION_DURATION = 240;
const ENTRANCE_DURATION = 360;
const STAGGER_DELAY = 45;

export default function SwipeScreen() {
  const { width: winWidth, height } = useWindowDimensions();
  // Photos size to the app card (which grows with the viewport on desktop),
  // not the whole window -- kept in lockstep with the frame in app/_layout.
  const width = stageWidth(winWidth, height);
  const reduceMotion = useReducedMotion();
  const { projectId, setProject, known } = useActiveProject();
  const [raterName, setRaterName] = useLocalStorage('everlit.rater', '');
  const [nameDraft, setNameDraft] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentPhotoId, setCommentPhotoId] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [viewMode, setViewMode] = useState<'deck' | 'grid'>('deck');
  const [deckIndex, setDeckIndex] = useState(0);
  // Mirrors PhotoDeck's live swipe position for the header counter. Kept
  // separate from deckIndex, which is also used as PhotoDeck's remount key
  // (jumping from the grid) -- feeding live swipes into that would remount
  // the deck on every single swipe.
  const [liveIndex, setLiveIndex] = useState(0);
  // Bumped on every "go home" tap so PhotoDeck always remounts (and so
  // re-scrolls to photo 1) even when deckIndex is already 0 -- a same-value
  // setState wouldn't otherwise change PhotoDeck's key.
  const [resetSeq, setResetSeq] = useState(0);
  const [projectDetails, setProjectDetails] = useState<Project | null>(null);

  // Gentle one-time entrance for the welcome screen (fade + slight rise).
  const enter = useSharedValue(0);
  useEffect(() => {
    enter.value = reduceMotion ? 1 : withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, []);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 14 }],
  }));

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

  useEffect(() => {
    if (!projectId) {
      setProjectDetails(null);
      return;
    }
    api
      .getProject(projectId)
      .then((details) => {
        setProjectDetails(details);
        // Server-fresh invite code backfills older remembered projects that
        // were stored before inviteCode was kept client-side (write auth).
        setInviteCode(details.inviteCode);
      })
      .catch(() => setProjectDetails(null));
  }, [projectId]);

  // Everlit wordmark in the header goes to the landing/home page. On native
  // (no landing page) it falls back to returning to the top of the photos --
  // the closest thing to "home" there.
  const goHome = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = '/';
      return;
    }
    setViewMode('deck');
    setDeckIndex(0);
    setResetSeq((s) => s + 1);
  };

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
      reactions: [],
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

  // Tap-to-toggle, matching how favoriting works: add the reaction
  // optimistically, or drop it if the rater already reacted with this
  // emoji. Scoped to whichever photo the comment belongs to so we don't
  // have to search every photo's comment list.
  const reactToComment = async (photo: Photo, commentId: string, emoji: string) => {
    const comment = photo.comments.find((c) => c.id === commentId);
    if (!comment) return;
    const already = comment.reactions.some(
      (r) => r.emoji === emoji && r.rater.toLowerCase() === raterName.toLowerCase()
    );
    const nextReactions = already
      ? comment.reactions.filter((r) => !(r.emoji === emoji && r.rater.toLowerCase() === raterName.toLowerCase()))
      : [
          ...comment.reactions,
          { id: 'optimistic', commentId, rater: raterName, emoji, createdAt: new Date().toISOString() },
        ];
    setPhotos((prev) =>
      prev.map((p) =>
        p.id !== photo.id
          ? p
          : { ...p, comments: p.comments.map((c) => (c.id === commentId ? { ...c, reactions: nextReactions } : c)) }
      )
    );
    if (DEMO) return; // in-memory only, no backend
    try {
      await api.toggleCommentReaction(commentId, raterName, emoji);
    } catch {
      if (typeof window !== 'undefined') {
        window.alert("That reaction didn't save — check your connection and try again.");
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
            <PressableScale onPress={goHome} scaleTo={0.96} hitSlop={8} style={styles.brand}>
              <Image source={images.logoGold} style={styles.logo} resizeMode="contain" />
              <Text style={styles.brandText}>Everlit</Text>
            </PressableScale>
          </View>
        </View>
        <View style={styles.gate}>
          <Animated.View style={[styles.gateInner, enterStyle]}>
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
              style={[styles.gateInput, inputFocused && styles.gateInputFocused]}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onSubmitEditing={handleCreateProject}
            />
            <GoldButton
              label={creatingProject ? 'Creating…' : 'Begin'}
              onPress={handleCreateProject}
              style={styles.gateButton}
            />

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
          </Animated.View>
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
            <PressableScale onPress={goHome} scaleTo={0.96} hitSlop={8} style={styles.brand}>
              <Image source={images.logoGold} style={styles.logo} resizeMode="contain" />
              <Text style={styles.brandText}>Everlit</Text>
            </PressableScale>
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
          <GoldButton
            label="Enter"
            onPress={() => nameDraft.trim() && setRaterName(nameDraft.trim())}
            style={styles.gateButton}
          />
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
      ) : viewMode === 'grid' ? (
        <PhotoGrid
          photos={photos}
          width={width}
          onSelect={(i) => {
            setDeckIndex(i);
            setViewMode('deck');
          }}
        />
      ) : (
        <PhotoDeck
          key={`${deckIndex}-${resetSeq}`}
          photos={photos}
          width={width}
          height={height}
          raterName={raterName}
          initialIndex={deckIndex}
          navEnabled={!commentPhotoId}
          onToggleFavorite={toggleFavorite}
          onOpenComments={(photo) => setCommentPhotoId(photo.id)}
          onIndexChange={setLiveIndex}
          reduceMotion={reduceMotion}
          projectName={projectDetails?.name || 'their'}
          reportUrl={projectDetails ? `${API_BASE}/api/report/${projectDetails.inviteCode}` : null}
        />
      )}

      <CommentSheet
        photo={photos.find((p) => p.id === commentPhotoId) ?? null}
        onClose={() => setCommentPhotoId(null)}
        onSubmit={addComment}
        onReact={reactToComment}
        raterName={raterName}
      />

      <View style={styles.headerOverlay} pointerEvents="box-none">
        <LinearGradient
          colors={['rgba(20, 16, 14, 0.7)', 'rgba(20, 16, 14, 0.45)', 'rgba(20, 16, 14, 0)']}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.header}>
          {/* The logo lockup sits flush left, mirroring how headerActions
              sits flush right -- equal visual weight on each side rather
              than pulling the logo toward center. The counter still centers
              on the middle divider (1/2 width). */}
          {/* Positioning lives on a plain wrapper, not the PressableScale
              itself -- PressableScale supplies its own press-scale
              `transform`, which silently overwrites (not merges with) a
              translateX passed straight into its style prop. */}
          <View style={[styles.centerContent, { position: 'absolute', left: 19, top: 0, bottom: 0 }]}>
            <PressableScale onPress={goHome} scaleTo={0.96} hitSlop={8} style={styles.brand}>
              <Image source={images.logoGold} style={styles.logo} resizeMode="contain" />
              <Text style={styles.brandText}>Everlit</Text>
            </PressableScale>
          </View>
          {viewMode === 'deck' && photos.length > 0 && liveIndex < photos.length && (
            <View style={[styles.headerCounter, quarterCenterStyle(width / 2)]}>
              <Text style={styles.counterText}>{String(liveIndex + 1).padStart(2, '0')}</Text>
              <Text style={styles.counterSeparator}>/</Text>
              <Text style={styles.counterText}>{String(photos.length).padStart(2, '0')}</Text>
            </View>
          )}
          <View style={[styles.headerActions, { marginLeft: 'auto' }]}>
            {photos.length > 0 && (
              <ViewModeButton
                mode={viewMode}
                onPress={() => setViewMode((m) => (m === 'deck' ? 'grid' : 'deck'))}
              />
            )}
            <HamburgerButton onPress={() => setMenuOpen(true)} />
          </View>
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
          Add the photos you have, everyone you invite swipes through them and keeps their favourites.
        </Text>
        <GoldButton label="Upload photos" onPress={onUpload} style={styles.emptyButton} pill textStyle={styles.emptyButtonText} />
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

// Landing/gate backdrop: the shared looping candle-flame video (see
// components/BackdropVideo), dimmed under a warm dark scrim so it reads as
// depth behind the copy — not a bright flame fighting white text. Scrim is
// darkest top & bottom (text zones), lets the glow through the middle where
// the hero mark sits.
function HorizonGlow() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BackdropVideo />
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
          <GoldButton label="Try again" onPress={onRetry} style={styles.emptyButton} pill textStyle={styles.emptyButtonText} />
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
  initialIndex?: number;
  navEnabled?: boolean;
  onToggleFavorite: (photo: Photo) => void;
  onOpenComments: (photo: Photo) => void;
  onIndexChange?: (index: number) => void;
  reduceMotion: boolean;
  projectName: string;
  reportUrl: string | null;
};

// Centers an element (whatever its own content width) exactly on a given
// pixel X, regardless of the element's own size -- the alignment-grid trick
// used by the header and the bottom controls row.
function quarterCenterStyle(x: number) {
  return {
    position: 'absolute' as const,
    left: x,
    top: 0,
    bottom: 0,
    transform: [{ translateX: '-50%' as any }],
  };
}

// Trackpad/mouse-wheel deltas fire many times over a single flick (momentum),
// not once. A short cooldown after each triggered advance turns "flick" into
// "move exactly one photo" instead of skipping several at once.
const WHEEL_COOLDOWN_MS = 450;
const WHEEL_THRESHOLD = 12;

function PhotoDeck({
  photos,
  width,
  height,
  raterName,
  initialIndex = 0,
  navEnabled = true,
  onToggleFavorite,
  onOpenComments,
  onIndexChange,
  reduceMotion,
  projectName,
  reportUrl,
}: PhotoDeckProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(initialIndex);
  const indexRef = useRef(index);
  const navEnabledRef = useRef(navEnabled);
  // One virtual slide appended after the last photo: the "thank you, go see
  // everyone's favourites" handoff.
  const lastIndex = photos.length;
  const currentPhoto = index < lastIndex ? photos[index] : null;

  useEffect(() => {
    indexRef.current = index;
    onIndexChange?.(index);
  }, [index]);

  useEffect(() => {
    navEnabledRef.current = navEnabled;
  }, [navEnabled]);

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(lastIndex, next));
    scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    setIndex(clamped);
  };

  // Snap to the requested photo once on mount (e.g. opened from the grid),
  // without animating from photo 1.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: initialIndex * width, animated: false });
  }, []);

  // Desktop/laptop input has no native paging for a horizontal deck — a
  // vertical wheel/trackpad scroll otherwise does nothing. Translate it into
  // "advance exactly one photo" so scrolling feels natural on a laptop.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    let cooling = false;
    const handleWheel = (e: WheelEvent) => {
      if (!navEnabledRef.current) return;
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return; // let horizontal gestures pass through
      if (Math.abs(e.deltaY) < WHEEL_THRESHOLD) return;
      if (cooling) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      cooling = true;
      goTo(indexRef.current + (e.deltaY > 0 ? 1 : -1));
      setTimeout(() => {
        cooling = false;
      }, WHEEL_COOLDOWN_MS);
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [width, photos.length]);

  const favorited = currentPhoto ? isFavoritedBy(currentPhoto, raterName) : false;
  const count = currentPhoto ? heartCount(currentPhoto) : 0;
  const heartScale = useSharedValue(1);
  const heartGlow = useSharedValue(0);

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: heartGlow.value }));

  // Nudges toward the comment button right after a favourite -- two quick
  // wobbles + a glow, echoing the heart's own burst so it reads as "and
  // maybe say why?" rather than an unrelated animation.
  const commentPulse = useSharedValue(0);
  const commentGlow = useSharedValue(0);
  const commentPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + commentPulse.value * 0.07 }],
  }));
  const commentGlowStyle = useAnimatedStyle(() => ({ opacity: commentGlow.value * 0.9 }));

  const handleHeartPress = () => {
    if (!currentPhoto) return;
    const newlyFavorited = !favorited;
    if (!reduceMotion) {
      heartScale.value = withSequence(withSpring(1.28, { damping: 5 }), withSpring(1, { damping: 8 }));
      heartGlow.value = withSequence(
        withTiming(0.6, { duration: 120 }),
        withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) })
      );
      if (newlyFavorited) {
        // Two smooth breaths (up-down twice), not four separate hops -- a
        // single repeating in/out tween reads as one continuous pulse
        // instead of a mechanical stepped blink.
        commentPulse.value = withRepeat(withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) }), 4, true);
        commentGlow.value = withRepeat(withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) }), 4, true);
      }
    }
    onToggleFavorite(currentPhoto);
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
            width={width}
            height={height}
            raterName={raterName}
            onToggleFavorite={onToggleFavorite}
            reduceMotion={reduceMotion}
          />
        ))}
        <EndOfDeckSlide width={width} height={height} projectName={projectName} reportUrl={reportUrl} />
      </ScrollView>

      {/* Fixed overlay: unlike the photos themselves, none of this scrolls
          away mid-swipe -- it all reads off `currentPhoto`/`index` instead
          of living inside each per-slide component. A single flex row (not
          three independently-absolute-positioned pieces) so a long comment
          count can never overlap the centered nav buttons. */}
      {/* Same alignment grid as the header: comment pill centers on the 1st
          divider (1/4 width), the midpoint between the two arrows centers
          on the 2nd (1/2), the heart centers on the 3rd (3/4). */}
      <View style={styles.controlsRow} pointerEvents="box-none">
        <View style={[styles.commentPillWrap, quarterCenterStyle(width / 4)]}>
          {currentPhoto && (
            <View style={styles.commentPillInner}>
              <Animated.View style={[styles.commentGlow, commentGlowStyle]} pointerEvents="none">
                <RadialGlow color={colors.goldWarm} />
              </Animated.View>
              <PressableScale
                onPress={() => onOpenComments(currentPhoto)}
                scaleTo={0.96}
                hitSlop={12}
                style={commentPulseStyle}
              >
                <CommentIcon active={currentPhoto.comments.length > 0} />
              </PressableScale>
              {currentPhoto.comments.length > 0 && (
                <Text style={styles.commentCount}>{currentPhoto.comments.length}</Text>
              )}
            </View>
          )}
        </View>

        <View style={[styles.navRow, quarterCenterStyle(width / 2)]} pointerEvents="box-none">
          <PressableScale
            onPress={() => goTo(index - 1)}
            scaleTo={0.9}
            hitSlop={10}
            style={[styles.navButton, glassSurface, glassBlur, styles.navButtonContrast, index === 0 && styles.navButtonDisabled]}
          >
            <NavChevron direction="left" />
          </PressableScale>
          <PressableScale
            onPress={() => goTo(index + 1)}
            scaleTo={0.9}
            hitSlop={10}
            style={[styles.navButton, glassSurface, glassBlur, styles.navButtonContrast, index === lastIndex && styles.navButtonDisabled]}
          >
            <NavChevron direction="right" />
          </PressableScale>
        </View>

        <View style={[styles.heartFixed, quarterCenterStyle((width * 3) / 4)]} pointerEvents="box-none">
          {currentPhoto && (
            <View style={styles.heartFixedInner}>
              <Animated.View style={[styles.glowPulse, glowStyle]} pointerEvents="none">
                <RadialGlow color={colors.heart} />
              </Animated.View>
              <PressableScale onPress={handleHeartPress} scaleTo={0.82} hitSlop={16}>
                <Animated.Text style={[styles.heartIcon, favorited && styles.heartIconActive, heartStyle]}>
                  {favorited ? '♥' : '♡'}
                </Animated.Text>
              </PressableScale>
              {count > 0 ? (
                <Text style={styles.heartFixedCount}>{count}</Text>
              ) : (
                index === 0 &&
                !favorited && (
                  <Text style={styles.heartHint}>
                    tap to{'\n'}favourite
                  </Text>
                )
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// A thin, single-stroke curved swoosh in the brand gold -- fine line work
// only, no filled shapes, matching the delicate engraved-line style of the
// logo suite and the wreath artwork (a filled shape read as a solid "ball"
// at this size, which fought that aesthetic). A couple of faint hairline
// wisps trail behind it, a restrained nod to the fletching-into-arrowhead
// reference. Web-only inline SVG (same technique as BackdropVideo); native
// falls back to the plain geometric corner.
function NavChevron({ direction }: { direction: 'left' | 'right' }) {
  if (Platform.OS === 'web') {
    const mirror = direction === 'left';
    return React.createElement(
      'svg',
      {
        width: 22,
        height: 20,
        viewBox: '0 0 28 24',
        style: mirror ? { transform: 'scaleX(-1)' } : undefined,
      },
      React.createElement('path', {
        d: 'M9 6 C 14 9, 19 11, 24 12 C 19 13, 14 15, 9 18',
        stroke: colors.goldWarm,
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        fill: 'none',
      }),
      React.createElement('path', {
        d: 'M2 9.5 L7.5 10.8',
        stroke: colors.goldWarm,
        strokeWidth: 1.1,
        strokeLinecap: 'round',
        opacity: 0.45,
      }),
      React.createElement('path', {
        d: 'M2 14.5 L7.5 13.2',
        stroke: colors.goldWarm,
        strokeWidth: 1.1,
        strokeLinecap: 'round',
        opacity: 0.45,
      })
    );
  }
  return <View style={[styles.chevron, direction === 'left' ? styles.chevronLeft : styles.chevronRight]} />;
}

// A true radial gradient (fades to transparent at the edges) instead of a
// flat-colour filled circle, which had a hard, visible edge rather than
// softly fading toward the sides. RN's style system has no radial-gradient
// support, so this is a raw web element (web-only, same escape-hatch
// pattern as BackdropVideo/NavChevron); native falls back to the old flat
// disc. Renders inside an Animated.View that handles the opacity animation,
// so the fade-in/out motion is untouched -- only the shape changed.
function RadialGlow({ color }: { color: string }) {
  if (Platform.OS === 'web') {
    return React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color} 0%, ${color}00 65%)`,
      },
    });
  }
  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999, backgroundColor: color }}
    />
  );
}

// A speech-bubble outline, same thin-line treatment as the heart glyph and
// the same active-state pattern: white by default, turning colour (green,
// echoing the heart's red) once the photo actually has a comment on it --
// bare text ("Comment") didn't read as an icon at a glance and got lost
// against busy photos. Every major photo/video app (Instagram, TikTok)
// pairs an icon with its count here, never a text label, for exactly that
// legibility reason.
function CommentIcon({ active }: { active: boolean }) {
  const color = active ? colors.comment : 'rgba(255, 255, 255, 0.85)';
  if (Platform.OS === 'web') {
    return React.createElement(
      'svg',
      { width: 28, height: 24, viewBox: '0 0 30 26' },
      React.createElement('rect', {
        x: 3,
        y: 3,
        width: 24,
        height: 15,
        rx: 7.5,
        stroke: color,
        strokeWidth: 2.2,
        fill: 'none',
      }),
      React.createElement('path', {
        d: 'M9 18 L7 24 L14 18',
        stroke: color,
        strokeWidth: 2.2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        fill: 'none',
      })
    );
  }
  return <View style={[styles.commentIconFallback, active && { borderColor: colors.comment }]} />;
}

type EndOfDeckSlideProps = {
  width: number;
  height: number;
  projectName: string;
  reportUrl: string | null;
};

function EndOfDeckSlide({ width, height, projectName, reportUrl }: EndOfDeckSlideProps) {
  const openFavourites = () => {
    if (!reportUrl) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(reportUrl, '_blank');
    }
  };

  return (
    <View style={[styles.endSlide, { width, height }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BackdropVideo />
        <LinearGradient
          colors={['rgba(20, 16, 14, 0.92)', 'rgba(24, 19, 16, 0.62)', 'rgba(20, 16, 14, 0.95)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Text style={styles.endTitle}>Thank you for going through {projectName}&rsquo;s photos.</Text>
      <Text style={styles.endSubtitle}>
        Now you can see what everyone else loved. Tap below to look through the favourites, and the
        memories, your whole family shared.
      </Text>
      <GoldButton label="See Everybody's Favourites" onPress={openFavourites} style={styles.endButton} />
    </View>
  );
}

type PhotoSlideProps = {
  photo: Photo;
  width: number;
  height: number;
  raterName: string;
  onToggleFavorite: (photo: Photo) => void;
  reduceMotion: boolean;
};

// The photo itself, plus the double-tap-to-favourite gesture and its burst
// animation. Everything else that used to live here (counter, comment
// button, heart button) is now a fixed overlay in PhotoDeck instead, so it
// doesn't slide away with the photo mid-swipe -- see PhotoDeck.
function PhotoSlide({ photo, width, height, raterName, onToggleFavorite, reduceMotion }: PhotoSlideProps) {
  const favorited = isFavoritedBy(photo, raterName);
  const burst = useSharedValue(0);
  const lastTap = useRef(0);

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
      {/* Blurred, dimmed copy fills the letterbox area behind the fitted photo. */}
      <Image
        source={photo.localSource ?? { uri: photoUrl(photo) }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        blurRadius={24}
      />
      <View style={styles.fillDim} pointerEvents="none" />
      {/* The whole photo, fit to screen (no cropping / bleed). */}
      <Image
        source={photo.localSource ?? { uri: photoUrl(photo) }}
        style={StyleSheet.absoluteFill}
        resizeMode="contain"
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
    height: 84,
    zIndex: 20,
  },
  header: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingHorizontal: 19,
    // Nudges the row up so its distance from the bar's top edge matches its
    // distance from the bar's right edge -- purely a paint-time shift, the
    // fade (a sibling layer) keeps its own height untouched.
    transform: [{ translateY: -15 }],
  },
  headerCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  centerContent: {
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 7,
  },
  brandText: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    letterSpacing: 0.2,
    color: colors.white,
  },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 80,
  },
  gateInner: {
    width: '100%',
    alignItems: 'center',
    gap: 18,
  },
  gateTagline: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    fontStyle: 'italic',
    letterSpacing: 0.4,
    color: colors.goldWarm,
    textAlign: 'center',
  },
  endSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: colors.ink,
    overflow: 'hidden',
  },
  endTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 30,
    letterSpacing: -0.4,
    lineHeight: 38,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 16,
  },
  endSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    lineHeight: 26,
    color: colors.textFainter,
    textAlign: 'center',
    maxWidth: 360,
    marginBottom: 32,
  },
  endButton: {
    minWidth: 260,
  },
  gateTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 36,
    letterSpacing: -0.4,
    lineHeight: 44,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  gateSubtitle: {
    fontFamily: 'Poppins_400Regular',
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
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    marginTop: 12,
  },
  gateInputFocused: {
    borderColor: colors.goldWarm,
    backgroundColor: 'rgba(212, 169, 118, 0.1)',
  },
  gateButton: {
    width: '100%',
    maxWidth: 340,
    height: 52,
  },
  gateButtonText: {
    fontFamily: 'Poppins_500Medium',
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
    fontFamily: 'Poppins_400Regular',
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
    fontFamily: 'Poppins_500Medium',
    fontSize: 17,
    color: colors.white,
  },
  knownChevron: {
    fontFamily: 'Poppins_400Regular',
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
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 28,
    letterSpacing: -0.2,
    color: colors.white,
    textAlign: 'center',
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    lineHeight: 24,
    color: colors.textFainter,
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyButton: {
    marginTop: 16,
    paddingHorizontal: 30,
  },
  emptyButtonText: {
    fontSize: 15,
    letterSpacing: 0.2,
  },
  fillDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 14, 12, 0.55)',
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
  controlsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 34,
    height: 56,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexShrink: 0,
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Applied after glassSurface (which the array-merge would otherwise let
  // win outright, since later entries override earlier ones for the same
  // key) -- a touch more fill and a thicker border just for the nav
  // buttons, without changing glassSurface itself everywhere else it's used.
  navButtonContrast: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.36)',
  },
  navButtonDisabled: {
    opacity: 0.35,
  },
  heartCountLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.88)',
    lineHeight: 20,
  },
  heartRaters: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: colors.goldWarm,
    marginTop: 4,
  },
  commentPillWrap: {
    justifyContent: 'center',
  },
  // No pill/background -- text-as-label plus a count underneath, matching
  // the heart button's own icon-then-count-below shape instead of standing
  // out as a different kind of control. Fixed height (just the label's own
  // line) so the count appearing/disappearing never shifts the row, same
  // fix as heartFixedInner/heartFixedCount below.
  // Same fixed height as heartFixedInner (46, the heart glyph's own box) so
  // the two counts land at an identical Y regardless of the icon inside
  // being a big glyph or a smaller drawn icon -- matching heights was the
  // actual fix, not the offset numbers underneath them.
  commentPillInner: {
    position: 'relative',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentIconFallback: {
    width: 24,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 2.2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  // Same filled-circle burst as the heart's glowPulse (not a blurred shadow
  // around the icon's box, which just read as a pill-shaped outline at this
  // size) -- centered behind the icon via commentPillInner's own centering.
  commentGlow: {
    position: 'absolute',
    width: 48,
    height: 48,
  },
  commentCount: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  heartButtonContainer: {
    position: 'relative',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartFixed: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fixed height = just the heart glyph's own box. The count/hint below it
  // are absolutely positioned (see heartFixedCount/heartHint) so they never
  // add to this height -- otherwise a photo with a count would make this
  // column taller than one without, and centering the row on its tallest
  // child would shift the nav arrows and comment pill up and down between
  // photos.
  heartFixedInner: {
    alignItems: 'center',
    height: 46,
    justifyContent: 'center',
  },
  heartFixedCount: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  heartHint: {
    position: 'absolute',
    top: 40,
    left: -14,
    right: -14,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 0.2,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  glowPulse: {
    position: 'absolute',
    width: 56,
    height: 56,
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
  chevron: {
    width: 13,
    height: 13,
  },
  chevronLeft: {
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: colors.white,
    transform: [{ rotate: '-45deg' }],
    marginLeft: 3,
  },
  chevronRight: {
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.white,
    transform: [{ rotate: '-45deg' }],
    marginRight: 3,
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
