import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import HamburgerButton from '../components/HamburgerButton';
import ViewModeButton from '../components/ViewModeButton';
import MenuOverlay from '../components/MenuOverlay';
import CommentSheet from '../components/CommentSheet';
import DetailsSheet from '../components/DetailsSheet';
import CoachMark from '../components/CoachMark';
import PhotoGrid from '../components/PhotoGrid';
import PressableScale from '../components/PressableScale';
import GoldButton from '../components/GoldButton';
import BackdropVideo from '../components/BackdropVideo';
import { colors, copy, images, stageWidth, CONTROLS_BAND_MAX } from '../constants/theme';
import { DEMO, DEMO_PHOTOS } from '../constants/demo';

// Dev-only: append ?loading=1 to the URL to hold the loading screen on screen
// (so its design can be iterated). Never true in a normal session.
const FORCE_LOADING =
  typeof window !== 'undefined' && /[?&]loading=1/.test(window.location.search);
import { API_BASE, api, heartCount, isFavoritedBy, photoThumbUrl, photoUrl, setInviteCode, type Photo, type Project } from '../lib/api';
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
  // Same centered-band math the controls row uses, so the tour can point at
  // the heart button's real on-screen x (band == width on phones).
  const bandApp = Math.min(width, CONTROLS_BAND_MAX);
  const bandLeftApp = (width - bandApp) / 2;
  const reduceMotion = useReducedMotion();
  const { projectId, setProject, known } = useActiveProject();
  const [raterName, setRaterName] = useLocalStorage('everlit.rater', '');
  const [nameDraft, setNameDraft] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  // Set only right after THIS session creates a new project (never on a
  // returning visit or a join-link open) -- prompts the creator, once, to
  // pick the photo people will see first: typically the one displayed at
  // the service, near the casket.
  const [pickingCover, setPickingCover] = useState<Project | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentPhotoId, setCommentPhotoId] = useState<string | null>(null);
  const [detailsPhotoId, setDetailsPhotoId] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  // First-run guided tour, one pass the first time the deck opens. A mix of
  // "read + tap Next" slides (counter, menu, favourites, comments, details)
  // and interactive steps the user drives by tapping the real element:
  //   grid     -> tap the grid button (advances when viewMode becomes 'grid')
  //   gridInfo -> tap any photo    (advances when viewMode returns to 'deck')
  //   arrows   -> tap next          (finishes when the photo index changes)
  // One persisted flag marks the whole tour done.
  type TourStep =
    | null
    | 'counter'
    | 'menu'
    | 'grid'
    | 'gridInfo'
    | 'favourites'
    | 'comments'
    | 'details'
    | 'arrows'
    | 'arrowsPrev';
  const [tourStep, setTourStep] = useState<TourStep>(null);
  const [tourDone, setTourDone] = useLocalStorage('everlit.tour.done', false);
  // The photo index when the final 'arrows' step began, so we can tell when the
  // user has actually moved to the next photo and end the tour.
  const arrowsStartIndex = useRef<number | null>(null);
  // Photos that have already had a comment posted / details saved this session.
  // The sheet auto-closes only the FIRST time either action happens for a
  // photo; after that it stays open so people can keep adding without it
  // shutting each time.
  const postedPhotos = useRef<Set<string>>(new Set());
  const savedPhotos = useRef<Set<string>>(new Set());
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

  // Staggered entrance for the gate screens (fade + slight rise, three beats:
  // overline/mark → title/streak → body/input). Re-runs when the visible gate
  // changes so the name gate gets its own entrance, not the welcome gate's
  // leftovers.
  const enterA = useSharedValue(0);
  const enterB = useSharedValue(0);
  const enterC = useSharedValue(0);
  const gateKey = !projectId && !DEMO ? 'welcome' : !raterName ? 'name' : 'app';
  useEffect(() => {
    if (gateKey === 'app') return;
    const rise = (v: SharedValue<number>, delay: number) => {
      v.value = 0;
      v.value = reduceMotion ? 1 : withDelay(delay, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    };
    rise(enterA, 0);
    rise(enterB, 90);
    rise(enterC, 180);
  }, [gateKey]);
  const enterStyleA = useAnimatedStyle(() => ({
    opacity: enterA.value,
    transform: [{ translateY: (1 - enterA.value) * 14 }],
  }));
  const enterStyleB = useAnimatedStyle(() => ({
    opacity: enterB.value,
    transform: [{ translateY: (1 - enterB.value) * 14 }],
  }));
  const enterStyleC = useAnimatedStyle(() => ({
    opacity: enterC.value,
    transform: [{ translateY: (1 - enterC.value) * 14 }],
  }));

  const refresh = async () => {
    // Dev only: ?loading=1 pins the loading screen so we can design it.
    if (FORCE_LOADING) return;
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
      setPickingCover(created);
    } catch {
      if (typeof window !== 'undefined') {
        window.alert("Couldn't create the project. Check your connection and try again.");
      }
    } finally {
      setCreatingProject(false);
    }
  };

  const handlePickCoverPhoto = async () => {
    if (!pickingCover) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets.length) return;
    setUploadingCover(true);
    try {
      const asset = result.assets[0];
      const [uploaded] = await api.uploadPhotos(pickingCover.id, [
        { uri: asset.uri, name: asset.fileName || `cover-${Date.now()}.jpg`, type: asset.mimeType || 'image/jpeg' },
      ]);
      await api.setCoverPhoto(pickingCover.id, uploaded.id);
      setPickingCover(null);
    } catch {
      if (typeof window !== 'undefined') {
        window.alert("That photo didn't upload — check your connection and try again.");
      }
    } finally {
      setUploadingCover(false);
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
    postedPhotos.current.add(photo.id);
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

  const saveDetails = async (photo: Photo, details: { photoDate: string; location: string }) => {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photo.id ? { ...p, photoDate: details.photoDate || null, location: details.location || null } : p
      )
    );
    savedPhotos.current.add(photo.id);
    if (DEMO) return; // in-memory only, no backend
    try {
      await api.updatePhotoDetails(photo.id, details);
    } catch {
      if (typeof window !== 'undefined') {
        window.alert("Those details didn't save — check your connection and try again.");
      }
      refresh();
    }
  };

  // Start the tour the first time the deck is on screen (past every gate,
  // photos loaded, nothing else open). Ref-guarded with no cancelling cleanup
  // so an unrelated re-render can't clear the pending timer before it fires.
  const deckReady =
    !loading && !loadError && photos.length > 0 && viewMode === 'deck' && !!raterName;
  const introStartedRef = useRef(false);
  useEffect(() => {
    if (deckReady && !tourDone && !introStartedRef.current && !menuOpen && !commentPhotoId && !detailsPhotoId) {
      introStartedRef.current = true;
      setTimeout(() => setTourStep('counter'), 650);
    }
  }, [deckReady, tourDone, menuOpen, commentPhotoId, detailsPhotoId]);

  // Interactive steps advance when the user performs the action, not on a Next
  // tap: open the grid, come back from it, and finally move to the next photo.
  useEffect(() => {
    if (tourStep === 'grid' && viewMode === 'grid') setTourStep('gridInfo');
  }, [tourStep, viewMode]);
  useEffect(() => {
    if (tourStep === 'gridInfo' && viewMode === 'deck') setTourStep('favourites');
  }, [tourStep, viewMode]);
  useEffect(() => {
    // 'arrows' asks them to go forward (tap next); once the index moves we go
    // to 'arrowsPrev' which asks them to go back; the second move ends the tour.
    if (tourStep === 'arrows') {
      if (arrowsStartIndex.current === null) {
        arrowsStartIndex.current = liveIndex;
      } else if (liveIndex !== arrowsStartIndex.current) {
        arrowsStartIndex.current = liveIndex;
        setTourStep('arrowsPrev');
      }
      return;
    }
    if (tourStep === 'arrowsPrev') {
      if (arrowsStartIndex.current === null) {
        arrowsStartIndex.current = liveIndex;
      } else if (liveIndex !== arrowsStartIndex.current) {
        arrowsStartIndex.current = null;
        setTourDone(true);
        setTourStep(null);
      }
      return;
    }
    arrowsStartIndex.current = null;
  }, [tourStep, liveIndex]);

  // The "read + tap Next" slides. Debounced so a stray double-tap (older users
  // especially) can't skip a step. The interactive steps in between (grid,
  // gridInfo, arrows) advance from the effects above, not here.
  const lastAdvanceRef = useRef(0);
  const advanceTour = () => {
    const now = Date.now();
    if (now - lastAdvanceRef.current < 600) return;
    lastAdvanceRef.current = now;
    setTourStep((s) => {
      if (s === 'counter') return 'menu';
      if (s === 'menu') return 'grid';
      if (s === 'favourites') return 'comments';
      if (s === 'comments') return 'details';
      if (s === 'details') return 'arrows';
      return s;
    });
  };

  const closeComments = () => {
    setCommentPhotoId(null);
  };

  // The header wordmark + flame grow and drift to centre as the deck lands on
  // the final "thank you" slide (index === photos.length), filling the space
  // between the header bar and the thank-you text, then shrink back into the
  // top-left corner when you swipe back to a photo. A timing move so it reads
  // as one smooth glide, not a snap.
  const onEndSlide = photos.length > 0 && viewMode === 'deck' && liveIndex >= photos.length;
  const brandGrow = useSharedValue(0);
  useEffect(() => {
    brandGrow.value = withTiming(onEndSlide ? 1 : 0, {
      duration: reduceMotion ? 0 : 520,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [onEndSlide, reduceMotion]);
  // On the closing slide the lockup splits: the flame glides to the middle of
  // the slide, grows a touch, and gains its double compass ring (crossfade to
  // logoRing); the "Everlit" wordmark stays up top but slides left into the
  // space the flame vacated and enlarges just enough to fill it. Reverses on
  // the way back.
  const flameFlyStyle = useAnimatedStyle(() => {
    const p = brandGrow.value;
    return {
      transform: [
        { translateX: p * (width / 2 - 40) },
        { translateY: p * (height * 0.26 - 34) },
        { scale: 1 + p * 0.5 },
      ],
    };
  });
  const flamePlainStyle = useAnimatedStyle(() => ({ opacity: 1 - brandGrow.value }));
  const flameRingStyle = useAnimatedStyle(() => ({ opacity: brandGrow.value }));
  // Wordmark: slides its left edge back to where the flame started (x=19) and
  // enlarges to span from there to where the counter number ends (~width/2+33).
  // transformOrigin 'left top' (set in styles.wordmarkOrigin) keeps the top
  // edge pinned, so growth goes rightward and downward, never up the page.
  const WORD_LEFT0 = 69; // resting left edge of "Everlit"
  const WORD_W0 = 74; // resting rendered width of "Everlit" at 24px
  const wordmarkStyle = useAnimatedStyle(() => {
    const p = brandGrow.value;
    // Sits centred in the left half of the page (between the left edge and the
    // vertical middle line), at half the earlier hero size. transformOrigin
    // 'left top' keeps the top pinned, so it grows down, not up.
    const targetWidth = width / 4 + 7;
    const scaleEnd = targetWidth / WORD_W0;
    const leftEdge = width / 8 - 3.5; // centres targetWidth on width/4
    return {
      transform: [
        { translateX: p * (leftEdge - WORD_LEFT0) },
        { scale: 1 + p * (scaleEnd - 1) },
      ],
    };
  });

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
          <View style={styles.gateInner}>
            <Animated.View style={[styles.gateSegment, enterStyleA]}>
              <Image source={images.lockup} style={styles.lockup} resizeMode="contain" />
            </Animated.View>
            <Animated.View style={[styles.gateSegment, enterStyleB]}>
              <Text style={styles.gateTitle}>{copy.landing.title}</Text>
              <StreakDivider />
            </Animated.View>
            <Animated.View style={[styles.gateSegment, enterStyleC]}>
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
              <Text style={styles.gateTerms}>
                By beginning, you agree to our{' '}
                <Text
                  style={styles.gateTermsLink}
                  onPress={() => {
                    if (typeof window !== 'undefined') window.open('https://everlit.co.za/terms', '_blank');
                  }}
                >
                  Terms &amp; Conditions
                </Text>
                .
              </Text>

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
      </View>
    );
  }

  if (pickingCover) {
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
          <Animated.View style={[styles.gateSegment, enterStyleA]}>
            <Text style={styles.gateOverline}>Everlit · Memorial Films</Text>
          </Animated.View>
          <Animated.View style={[styles.gateSegment, enterStyleB]}>
            <Text style={styles.gateTitle}>Choose a photo of {pickingCover.name}</Text>
            <StreakDivider />
          </Animated.View>
          <Animated.View style={[styles.gateSegment, enterStyleC]}>
            <Text style={styles.gateSubtitle}>
              This is the photo people see first when you share the link — often the one displayed at the
              service, near the casket.
            </Text>
            <GoldButton
              label={uploadingCover ? 'Uploading…' : 'Choose a photo'}
              onPress={handlePickCoverPhoto}
              style={styles.gateButton}
            />
            <PressableScale onPress={() => setPickingCover(null)} style={styles.switchLink} scaleTo={0.98}>
              <Text style={styles.switchText}>Skip for now</Text>
            </PressableScale>
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
          <Animated.View style={[styles.gateSegment, enterStyleA]}>
            <Text style={styles.gateOverline}>Everlit · Memorial Films</Text>
          </Animated.View>
          <Animated.View style={[styles.gateSegment, enterStyleB]}>
            <Text style={styles.gateTitle}>Who&rsquo;s here?</Text>
            <StreakDivider />
          </Animated.View>
          <Animated.View style={[styles.gateSegment, enterStyleC]}>
            <Text style={styles.gateCondolence}>
              We&rsquo;re so sorry for your loss.
            </Text>
            <Text style={styles.gateSubtitle}>
              Thank you for being here to help remember them. Add your name and it appears with the
              photos you favourite, so the family can see whose moments resonated most.
            </Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.6)"
              style={styles.gateInput}
              onSubmitEditing={() => setRaterName(nameDraft.trim())}
            />
            <GoldButton
              label="Enter"
              onPress={() => nameDraft.trim() && setRaterName(nameDraft.trim())}
              style={styles.gateButton}
            />
            <Text style={styles.gateTerms}>
              By entering, you agree to our{' '}
              <Text
                style={styles.gateTermsLink}
                onPress={() => {
                  if (typeof window !== 'undefined') window.open('https://everlit.co.za/terms', '_blank');
                }}
              >
                Terms &amp; Conditions
              </Text>
              .
            </Text>
          </Animated.View>
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
          onOpenComments={(photo) => setCommentPhotoId(photo.id)}
        />
      ) : (
        <PhotoDeck
          key={`${deckIndex}-${resetSeq}`}
          photos={photos}
          width={width}
          height={height}
          raterName={raterName}
          initialIndex={deckIndex}
          navEnabled={!commentPhotoId && !detailsPhotoId}
          onToggleFavorite={toggleFavorite}
          onOpenComments={(photo) => setCommentPhotoId(photo.id)}
          onOpenDetails={(photo) => setDetailsPhotoId(photo.id)}
          onIndexChange={setLiveIndex}
          reduceMotion={reduceMotion}
          projectName={projectDetails?.name || 'their'}
        />
      )}

      <CommentSheet
        photo={photos.find((p) => p.id === commentPhotoId) ?? null}
        onClose={closeComments}
        onSubmit={addComment}
        onReact={reactToComment}
        raterName={raterName}
        autoCloseOnPost={!!commentPhotoId && !postedPhotos.current.has(commentPhotoId)}
      />

      <DetailsSheet
        photo={photos.find((p) => p.id === detailsPhotoId) ?? null}
        onClose={() => setDetailsPhotoId(null)}
        onSave={saveDetails}
        autoCloseOnSave={!!detailsPhotoId && !savedPhotos.current.has(detailsPhotoId)}
      />

      {/* Keep the button that opened a sheet BRIGHT above that sheet's dimming
          backdrop: a lit copy sits exactly over the (now-dimmed) real button.
          Rendered after the sheets so it paints above their backdrops, and
          pinned to the bottom control row -- clear of the floating card above
          it, so it never overlaps the sheet itself. */}
      {commentPhotoId && (
        <View style={styles.spotlightRow} pointerEvents="none">
          <View style={[styles.controlColumn, quarterCenterStyle(bandLeftApp + bandApp / 6)]}>
            <View style={[styles.glassCircle, glassSurface, glassBlur, styles.navButtonContrast]}>
              <CommentIcon active />
            </View>
            <Text style={styles.controlLabel}>Comment</Text>
          </View>
        </View>
      )}
      {detailsPhotoId && (
        <View style={styles.spotlightRow} pointerEvents="none">
          <View style={[styles.controlColumn, quarterCenterStyle(bandLeftApp + (bandApp * 5) / 6)]}>
            <View style={[styles.glassCircle, glassSurface, glassBlur, styles.navButtonContrast]}>
              <DetailsIcon />
            </View>
            <Text style={styles.controlLabel}>Details</Text>
          </View>
        </View>
      )}

      {/* First-run guided tour: read + tap Next slides interleaved with three
          interactive steps (grid, gridInfo, arrows) the user drives by tapping
          the real element. */}
      <CoachMark
        visible={tourStep === 'counter'}
        text="This shows how many photos there are and which one you're on. Swipe left or right to move through them."
        anchor={{ x: width / 2, y: 31 }}
        placement="below"
        box={{ left: width / 2 - 36, top: 16, width: 72, height: 30 }}
        buttonLabel="Next"
        onNext={advanceTour}
        screenWidth={width}
        screenHeight={height}
      />
      <CoachMark
        visible={tourStep === 'menu'}
        text="The menu is here. Open it to invite family with a share link, see everyone's favourites, or share your own memories."
        anchor={{ x: width - 34, y: 33 }}
        placement="below"
        ringSize={52}
        buttonLabel="Next"
        onNext={advanceTour}
        screenWidth={width}
        screenHeight={height}
      />
      <CoachMark
        visible={tourStep === 'grid'}
        text="Tap here to see every photo at once."
        anchor={{ x: width - 78, y: 33 }}
        placement="below"
        ringSize={52}
        interactive
        screenWidth={width}
        screenHeight={height}
      />
      <CoachMark
        visible={tourStep === 'gridInfo'}
        text="Here they all are together. Tap any photo to open it and start swiping."
        anchor={{ x: (width - 4) / 6, y: 84 + (width - 4) / 6 }}
        placement="below"
        box={{ left: 0, top: 84, width: (width - 4) / 3, height: (width - 4) / 3 }}
        interactive
        screenWidth={width}
        screenHeight={height}
      />
      <CoachMark
        visible={tourStep === 'favourites'}
        text="Tap the heart to favourite a photo you love. Your favourites help the family choose what goes into the film."
        anchor={{ x: bandLeftApp + bandApp / 2, y: height - 54 }}
        placement="above"
        pulseNode={<Text style={styles.tourPulseHeart}>♥</Text>}
        buttonLabel="Next"
        onNext={advanceTour}
        screenWidth={width}
        screenHeight={height}
      />
      <CoachMark
        visible={tourStep === 'comments'}
        text="Leave a memory here. Comments stay with the photo for the whole family to read."
        anchor={{ x: bandLeftApp + bandApp / 6, y: height - 54 }}
        placement="above"
        pulseNode={<CommentIcon active />}
        buttonLabel="Next"
        onNext={advanceTour}
        screenWidth={width}
        screenHeight={height}
      />
      <CoachMark
        visible={tourStep === 'details'}
        text="Know when or where a photo was taken? Add it here. Even just the year helps us put them in order."
        anchor={{ x: bandLeftApp + (bandApp * 5) / 6, y: height - 54 }}
        placement="above"
        pulseNode={<DetailsIcon />}
        buttonLabel="Next"
        onNext={advanceTour}
        screenWidth={width}
        screenHeight={height}
      />
      <CoachMark
        visible={tourStep === 'arrows'}
        text="Tap here to move to the next photo."
        anchor={{ x: bandLeftApp + (bandApp * 2) / 3, y: height - 132 }}
        placement="above"
        ringSize={88}
        interactive
        screenWidth={width}
        screenHeight={height}
      />
      <CoachMark
        visible={tourStep === 'arrowsPrev'}
        text="And tap here to go back. That's everything, enjoy remembering them together."
        anchor={{ x: bandLeftApp + bandApp / 3, y: height - 132 }}
        placement="above"
        ringSize={88}
        interactive
        screenWidth={width}
        screenHeight={height}
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
          {/* Wordmark: its own wrapper so it can slide left + grow slightly,
              independent of the flame. Starts at x=69 (flame 42 + gap 8 + the
              19 inset) so the resting lockup looks unchanged. */}
          <View style={[styles.centerContent, { position: 'absolute', left: 69, top: 0, bottom: 0 }]}>
            <PressableScale onPress={goHome} scaleTo={0.96} hitSlop={8}>
              <Animated.Text style={[styles.brandText, styles.wordmarkOrigin, wordmarkStyle]}>
                Everlit
              </Animated.Text>
            </PressableScale>
          </View>
          {/* Flame: separate wrapper that flies to the middle of the slide and
              crossfades to the ringed icon. Sits above the wordmark's z so the
              ring never clips behind the text as it grows. */}
          <Animated.View
            style={[styles.centerContent, { position: 'absolute', left: 19, top: 0, bottom: 0, zIndex: 1 }, flameFlyStyle]}
            pointerEvents="box-none"
          >
            <PressableScale onPress={goHome} scaleTo={0.96} hitSlop={8} style={styles.flameBox}>
              <Animated.Image source={images.logoGold} style={[styles.logo, flamePlainStyle]} resizeMode="contain" />
              <Animated.Image source={images.logoRing} style={[styles.flameRing, flameRingStyle]} resizeMode="contain" />
            </PressableScale>
          </Animated.View>
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

// The gold streak divider from the memorial films' own intro cards — ties the
// app's gate screens to the deliverable's visual language.
function StreakDivider() {
  return (
    <LinearGradient
      colors={['rgba(196,154,108,0)', 'rgba(212,169,118,0.9)', 'rgba(196,154,108,0)']}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.streak}
    />
  );
}

// Comforting lines that rotate while the memorial loads — the wait becomes a
// held breath rather than a spinner. Kept warm, present-tense, and dash-free.
const LOADING_PHRASES = [
  'Take all the time you need.',
  'Every memory you share keeps them close.',
  'Grief is love with nowhere to go. Let it rest here a while.',
  'You are not alone in this.',
  'Their light stays with us.',
  'Breathe. There is no rush at all.',
  'Hold gently to the moments that made you smile.',
  'This is a space for remembering, together.',
];

// Repeating unit that produces the 1,2,3,2,1,2,3,2,1... dot rhythm.
const DOT_PATTERN = [1, 2, 3, 2];

// The brand emblem (flame in its compass ring) breathing over a soft gold glow,
// with a slow carousel of comforting lines beneath it. As the glow swells the
// gold emblem crossfades to its charcoal version, so at the glow's apex it
// reads as a dark silhouette against the light, then returns to gold as the
// glow settles. A small dim label above names whatever is loading. The ringed
// mark makes the wait feel finished and cared-for, not a half-built placeholder.
function LoadingState({
  reduceMotion,
  label = 'Loading your memorial',
}: {
  reduceMotion: boolean;
  label?: string;
}) {
  const breath = useSharedValue(0);
  const fade = useSharedValue(1);
  const [phrase, setPhrase] = useState(0);
  // Dot count cycles 1,2,3,2,1,2,3,2,... as an extra "still working" indicator.
  const [dotStep, setDotStep] = useState(0);
  const dotCount = reduceMotion ? 3 : DOT_PATTERN[dotStep];

  useEffect(() => {
    if (reduceMotion) return;
    breath.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setDotStep((d) => (d + 1) % DOT_PATTERN.length), 420);
    return () => clearInterval(id);
  }, [reduceMotion]);

  // Fade the current line out, swap it, fade the next one in.
  useEffect(() => {
    const id = setInterval(() => {
      if (reduceMotion) {
        setPhrase((p) => (p + 1) % LOADING_PHRASES.length);
        return;
      }
      fade.value = withTiming(0, { duration: 600, easing: Easing.in(Easing.quad) });
      setTimeout(() => {
        setPhrase((p) => (p + 1) % LOADING_PHRASES.length);
        fade.value = withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) });
      }, 640);
    }, 4200);
    return () => clearInterval(id);
  }, [reduceMotion]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + breath.value * 0.4,
    transform: [{ scale: 0.88 + breath.value * 0.24 }],
  }));
  // Gold shows when the glow is low; charcoal takes over as it peaks.
  const goldStyle = useAnimatedStyle(() => ({
    opacity: 1 - breath.value,
    transform: [{ scale: 0.98 + breath.value * 0.05 }],
  }));
  const charcoalStyle = useAnimatedStyle(() => ({
    opacity: breath.value,
    transform: [{ scale: 0.98 + breath.value * 0.05 }],
  }));
  const phraseStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <View style={styles.pageContent}>
      <View style={styles.loadingWrap}>
        <Text style={styles.loadingLabel}>{label}</Text>
        <View style={styles.loadingEmblem}>
          <Animated.View style={[styles.loadingGlowWrap, glowStyle]} pointerEvents="none">
            <RadialGlow color={colors.goldWarm} />
          </Animated.View>
          <Animated.Image source={images.logoRing} style={[styles.loadingIcon, goldStyle]} resizeMode="contain" />
          <Animated.Image
            source={images.logoRingCharcoal}
            style={[styles.loadingIcon, styles.loadingIconAbs, charcoalStyle]}
            resizeMode="contain"
          />
        </View>
        <Animated.Text style={[styles.loadingPhrase, phraseStyle]}>
          {LOADING_PHRASES[phrase]}
        </Animated.Text>
        {/* Three-dot rhythm: always three slots (so the row stays centred),
            with only `dotCount` of them lit. */}
        <View style={styles.loadingDots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.loadingDot, { opacity: i < dotCount ? 0.9 : 0.16 }]} />
          ))}
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
  onOpenDetails: (photo: Photo) => void;
  onIndexChange?: (index: number) => void;
  reduceMotion: boolean;
  projectName: string;
};

// A count that breathes in on change instead of popping — used for the heart
// and comment tallies under the controls row.
function SoftCount({ value, style }: { value: number; style: object }) {
  const o = useSharedValue(1);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      o.value = 0;
      o.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
    }
  }, [value]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.Text style={[style, s]}>{value}</Animated.Text>;
}

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
  onOpenDetails,
  onIndexChange,
  reduceMotion,
  projectName,
}: PhotoDeckProps) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(initialIndex * width);
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

  // Snap to the current photo on mount (e.g. opened from the grid) AND on any
  // width change. The resize case is load-bearing for the parallax styles: a
  // resized viewport changes every slide's page offset while the ScrollView
  // keeps its old pixel position, so scrollX - index*width goes nonzero at
  // rest and every slide renders permanently shifted + faded ("ghost screen
  // behind the real one"). Re-snapping both the scroll position and the
  // tracked offset zeroes the parallax again.
  useEffect(() => {
    const x = indexRef.current * width;
    scrollRef.current?.scrollTo({ x, animated: false });
    scrollX.value = x;
  }, [width]);

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

  // Web mouse/pen: the native paging ScrollView only pans via touch + wheel,
  // so on a desktop a click-drag "swipe" did nothing -- only the buttons
  // worked. Translate a horizontal mouse/pen drag into a real drag-scroll on
  // the same scroll node, snapping to the nearest photo on release. Touch is
  // left entirely to the native scroller (guarded by pointerType), so mobile
  // swiping is unchanged.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node: any = (scrollRef.current as any)?.getScrollableNode?.();
    if (!node) return;
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !navEnabledRef.current) return;
      dragging = true;
      startX = e.clientX;
      startScroll = node.scrollLeft;
      node.style.scrollSnapType = 'none';
      node.style.cursor = 'grabbing';
      node.style.userSelect = 'none';
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      node.scrollLeft = startScroll - (e.clientX - startX);
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      node.style.scrollSnapType = '';
      node.style.cursor = 'grab';
      node.style.userSelect = '';
      const target = Math.max(0, Math.min(lastIndex, Math.round(node.scrollLeft / width)));
      scrollRef.current?.scrollTo({ x: target * width, animated: true });
      setIndex(target);
    };
    node.style.cursor = 'grab';
    node.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      node.style.cursor = '';
      node.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [width, photos.length, lastIndex]);

  // Controls band: full width on phones, capped + centered on desktop.
  const band = Math.min(width, CONTROLS_BAND_MAX);
  const bandLeft = (width - band) / 2;

  // On the closing slide (the logo grows + centres), there is nowhere forward
  // to go: fade the Next arrow away and glide the Prev arrow to the middle so
  // "go back" is the single, obvious control. Reverses when you step back.
  const atEnd = index === lastIndex;
  const endArrows = useSharedValue(0);
  useEffect(() => {
    endArrows.value = withTiming(atEnd ? 1 : 0, {
      duration: reduceMotion ? 0 : 460,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [atEnd, reduceMotion]);
  const prevShiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: endArrows.value * (width / 2 - (bandLeft + band / 3)) }],
  }));
  const nextFadeStyle = useAnimatedStyle(() => ({ opacity: 1 - endArrows.value }));

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
        scrollEventThrottle={16}
        onScroll={(e) => {
          // Feeds the per-slide crossfade/parallax styles. Plain JS handler on
          // purpose (works identically on web); paging is untouched.
          scrollX.value = e.nativeEvent.contentOffset.x;
        }}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {photos.map((photo, i) =>
          // Windowed mounting: only the current slide and its neighbours carry
          // the two full-res Images + blur + animations; the rest are empty
          // spacers holding the scroll geometry. A 100-photo memorial no
          // longer decodes 200 full-res images up front.
          Math.abs(i - index) <= 2 ? (
            <PhotoSlide
              key={photo.id}
              photo={photo}
              index={i}
              scrollX={scrollX}
              width={width}
              height={height}
              raterName={raterName}
              onToggleFavorite={onToggleFavorite}
              reduceMotion={reduceMotion}
            />
          ) : (
            <View key={photo.id} style={{ width, height }} />
          )
        )}
        <EndOfDeckSlide
          width={width}
          height={height}
          projectName={projectName}
          photos={photos}
          reduceMotion={reduceMotion}
        />
      </ScrollView>

      {/* Prev/Next: their own row, nudged up above the labelled action
          buttons, spread wider toward the edges, and a touch bigger. Bare
          arrows on purpose -- direction reads instantly, and the three
          labelled buttons below are the primary action family. */}
      <View style={styles.navRowUp} pointerEvents="box-none">
        <View style={quarterCenterStyle(bandLeft + band / 3)}>
          <Animated.View style={prevShiftStyle}>
            <PressableScale
              onPress={() => goTo(index - 1)}
              scaleTo={0.9}
              hitSlop={10}
              style={[styles.navButtonBig, glassSurface, glassBlur, styles.navButtonLight, index === 0 && styles.navButtonDisabled]}
            >
              <NavChevron direction="left" />
            </PressableScale>
          </Animated.View>
        </View>
        <View style={quarterCenterStyle(bandLeft + (band * 2) / 3)} pointerEvents={atEnd ? 'none' : 'box-none'}>
          <Animated.View style={nextFadeStyle}>
            <PressableScale
              onPress={() => goTo(index + 1)}
              scaleTo={0.9}
              hitSlop={10}
              style={[styles.navButtonBig, glassSurface, glassBlur, styles.navButtonLight, index === lastIndex && styles.navButtonDisabled]}
            >
              <NavChevron direction="right" />
            </PressableScale>
          </Animated.View>
        </View>
      </View>

      {/* Three labelled glass buttons, evenly spread: Comment (left),
          Favourites (centre), Details (right). All read off `currentPhoto`. */}
      <View style={styles.controlsRow} pointerEvents="box-none">
        <View style={[styles.controlSlot, quarterCenterStyle(bandLeft + band / 6)]}>
          {currentPhoto && (
            <View style={styles.controlColumn}>
              <Animated.View style={[styles.commentGlow, commentGlowStyle]} pointerEvents="none">
                <RadialGlow color={colors.goldWarm} />
              </Animated.View>
              <PressableScale
                onPress={() => onOpenComments(currentPhoto)}
                scaleTo={0.96}
                hitSlop={12}
                style={commentPulseStyle}
              >
                <View style={[styles.glassCircle, glassSurface, glassBlur, styles.navButtonContrast]}>
                  <CommentIcon active={currentPhoto.comments.length > 0} />
                </View>
              </PressableScale>
              {currentPhoto.comments.length > 0 && (
                <View style={styles.controlBadge} pointerEvents="none">
                  <SoftCount value={currentPhoto.comments.length} style={styles.controlBadgeText} />
                </View>
              )}
              <Text style={styles.controlLabel}>Comment</Text>
            </View>
          )}
        </View>

        <View style={[styles.controlSlot, quarterCenterStyle(bandLeft + band / 2)]} pointerEvents="box-none">
          {currentPhoto && (
            <View style={styles.controlColumn}>
              <Animated.View style={[styles.glowPulse, glowStyle]} pointerEvents="none">
                <RadialGlow color={colors.heart} />
              </Animated.View>
              <PressableScale onPress={handleHeartPress} scaleTo={0.82} hitSlop={16}>
                <View style={[styles.glassCircle, styles.glassCircleFav, glassSurface, glassBlur, styles.navButtonContrast]}>
                  <Animated.Text style={[styles.heartIconGlass, favorited && styles.heartIconActive, heartStyle]}>
                    {favorited ? '♥' : '♡'}
                  </Animated.Text>
                </View>
              </PressableScale>
              {count > 0 && (
                <View style={styles.controlBadge} pointerEvents="none">
                  <SoftCount value={count} style={styles.controlBadgeText} />
                </View>
              )}
              <Text style={styles.controlLabel}>Favourites</Text>
            </View>
          )}
        </View>

        <View style={[styles.controlSlot, quarterCenterStyle(bandLeft + (band * 5) / 6)]} pointerEvents="box-none">
          {currentPhoto && (
            <View style={styles.controlColumn}>
              <PressableScale
                onPress={() => onOpenDetails(currentPhoto)}
                scaleTo={0.96}
                hitSlop={12}
              >
                <View style={[styles.glassCircle, glassSurface, glassBlur, styles.navButtonContrast]}>
                  <DetailsIcon />
                </View>
              </PressableScale>
              <Text style={styles.controlLabel}>Details</Text>
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
        width: 44,
        height: 40,
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

// "1998 · Cape Town" from whatever's filled in; null when the photo has
// neither, so the chip falls back to its "Add details" invitation.
function formatPhotoDetails(photo: Photo): string | null {
  const parts = [photo.photoDate, photo.location].map((s) => (s || '').trim()).filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

// Small info glyph for the details chip: a circle with an "i". Web-only inline
// SVG (same escape hatch as CommentIcon/NavChevron); native falls back to a
// bordered circle.
function DetailsIcon() {
  const color = 'rgba(255, 255, 255, 0.85)';
  if (Platform.OS === 'web') {
    return React.createElement(
      'svg',
      { width: 26, height: 26, viewBox: '0 0 20 20' },
      React.createElement('circle', { cx: 10, cy: 10, r: 8, stroke: color, strokeWidth: 1.5, fill: 'none' }),
      React.createElement('circle', { cx: 10, cy: 6.2, r: 1, fill: color }),
      React.createElement('path', { d: 'M10 9 L10 14', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' })
    );
  }
  return <View style={styles.detailsIconFallback} />;
}

type EndOfDeckSlideProps = {
  width: number;
  height: number;
  projectName: string;
  photos: Photo[];
  reduceMotion: boolean;
};

// One layer of the goodbye montage — fades itself in/out as `active` flips.
function MontageLayer({ uri, active }: { uri: string; active: boolean }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withTiming(active ? 0.3 : 0, { duration: 1600, easing: Easing.inOut(Easing.quad) });
  }, [active]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={6} />
    </Animated.View>
  );
}

function EndOfDeckSlide({ width, height, projectName, photos, reduceMotion }: EndOfDeckSlideProps) {
  const router = useRouter();
  // "Here's what you all chose": the most-hearted photos drift behind the
  // goodbye text — a quiet preview of the film this becomes.
  const hearted = photos
    .filter((p) => heartCount(p) > 0 && !p.localSource)
    .sort((a, b) => heartCount(b) - heartCount(a))
    .slice(0, 5);
  const [montageIdx, setMontageIdx] = useState(0);
  useEffect(() => {
    if (reduceMotion || hearted.length < 2) return;
    const t = setInterval(() => setMontageIdx((i) => (i + 1) % hearted.length), 4200);
    return () => clearInterval(t);
  }, [hearted.length, reduceMotion]);

  // Two-tone name treatment from the memorial films' outro cards: first word
  // carries the weight, the rest breathes.
  const nameParts = projectName.trim().split(/\s+/);
  const nameFirst = nameParts[0] || 'their';
  const nameRest = nameParts.slice(1).join(' ');

  // In-app favourites screen now — no external report bounce, works even
  // before projectDetails resolves (the old reportUrl null-check dead-ended
  // this button silently).
  const openFavourites = () => router.push('/favourites');

  return (
    <View style={[styles.endSlide, { width, height }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BackdropVideo />
        {hearted.map((p, i) => (
          <MontageLayer key={p.id} uri={photoThumbUrl(p)} active={i === montageIdx} />
        ))}
        <LinearGradient
          colors={['rgba(20, 16, 14, 0.92)', 'rgba(24, 19, 16, 0.62)', 'rgba(20, 16, 14, 0.95)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Text style={styles.endTitle}>
        Thank you for going through{' '}
        <Text style={styles.endNameFirst}>{nameFirst}</Text>
        {nameRest ? <Text style={styles.endNameRest}> {nameRest}</Text> : null}
        {/* No possessive on the "their" fallback: "their photos", not
            "their's photos". A real name keeps the 's ("Mary's photos"). */}
        {nameFirst === 'their' && !nameRest ? ' photos.' : '’s photos.'}
      </Text>
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
  index: number;
  scrollX: SharedValue<number>;
  width: number;
  height: number;
  raterName: string;
  onToggleFavorite: (photo: Photo) => void;
  reduceMotion: boolean;
};

// A single gold ember drifting up from the heart burst. Deterministic offsets
// (no randomness — HyperFrames-style discipline), staggered via `delay` as a
// fraction of the shared burst progress.
type EmberSpec = { dx: number; dy: number; size: number; delay: number };
const EMBER_SPECS: EmberSpec[] = [
  { dx: -26, dy: -64, size: 5, delay: 0 },
  { dx: -8, dy: -92, size: 4, delay: 0.08 },
  { dx: 12, dy: -74, size: 6, delay: 0.04 },
  { dx: 32, dy: -96, size: 4, delay: 0.12 },
  { dx: 2, dy: -56, size: 3.5, delay: 0.16 },
];

function Ember({ progress, spec }: { progress: SharedValue<number>; spec: EmberSpec }) {
  const style = useAnimatedStyle(() => {
    const lp = Math.min(1, Math.max(0, (progress.value - spec.delay) / (1 - spec.delay)));
    return {
      opacity: interpolate(lp, [0, 0.12, 1], [0, 1, 0]),
      transform: [
        { translateX: spec.dx * lp },
        { translateY: spec.dy * lp },
        { scale: 0.6 + lp * 0.5 },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ember, { width: spec.size, height: spec.size, borderRadius: spec.size / 2 }, style]}
    />
  );
}

// The photo itself, plus the double-tap-to-favourite gesture and its burst
// animation. Everything else that used to live here (counter, comment
// button, heart button) is now a fixed overlay in PhotoDeck instead, so it
// doesn't slide away with the photo mid-swipe -- see PhotoDeck.
function PhotoSlide({ photo, index, scrollX, width, height, raterName, onToggleFavorite, reduceMotion }: PhotoSlideProps) {
  const favorited = isFavoritedBy(photo, raterName);
  const burst = useSharedValue(0);
  const emberP = useSharedValue(0);
  const vignette = useSharedValue(0);
  const bgBreath = useSharedValue(0);
  const lastTap = useRef(0);

  // The blurred backdrop slowly breathes (the photo itself stays still and
  // reverent) — scene feels alive without the memory moving.
  useEffect(() => {
    if (reduceMotion) return;
    bgBreath.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduceMotion]);

  const bgStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1.02 + bgBreath.value * 0.045 }],
  }));

  // Crossfade between pages. Opacity ONLY, deliberately no translateX
  // parallax: the translate version desynced from layout on window resizes
  // (slides rendered permanently shifted — the "ghost screen" bug) and was
  // patched once already. Opacity has no geometry, so that whole failure
  // class is structurally impossible now; at swipe speed the fade carries
  // the page-turn feel on its own.
  const pageStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 1 };
    const p = (scrollX.value - index * width) / width;
    return {
      opacity: interpolate(p, [-1, -0.4, 0, 0.4, 1], [0.25, 1, 1, 1, 0.25]),
    };
  });

  const burstStyle = useAnimatedStyle(() => ({
    opacity: burst.value,
    transform: [{ scale: 0.5 + burst.value * 0.7 }],
  }));

  const vignetteStyle = useAnimatedStyle(() => ({ opacity: vignette.value }));

  const playBurst = () => {
    if (reduceMotion) return;
    burst.value = withSequence(
      withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 340, easing: Easing.in(Easing.cubic) })
    );
    emberP.value = 0;
    emberP.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) });
    vignette.value = withSequence(
      withTiming(0.35, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 700, easing: Easing.in(Easing.quad) })
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

  const source = photo.localSource ?? { uri: photoUrl(photo) };

  return (
    <Pressable onPress={handleTap} style={{ width, height, overflow: 'hidden' }}>
      <Animated.View style={[StyleSheet.absoluteFill, pageStyle]}>
        {/* Blurred, dimmed, slowly-breathing copy behind the framed print. */}
        <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
          <Image source={source} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={24} />
        </Animated.View>
        <View style={styles.fillDim} pointerEvents="none" />

        {/* The whole photo, fit to screen (no cropping / bleed) — the framed
            "print" treatment was tried and reverted: against this near-black
            backdrop the border read as a floating rectangle, not a print. */}
        <Image source={source} style={StyleSheet.absoluteFill} resizeMode="contain" />

        <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent']} style={styles.topScrim} pointerEvents="none" />
        <LinearGradient
          colors={['transparent', 'rgba(16, 14, 12, 0.75)']}
          style={styles.bottomScrim}
          pointerEvents="none"
        />

        {/* Warm pulse over the whole slide when a favourite lands. */}
        <Animated.View style={[styles.vignettePulse, vignetteStyle]} pointerEvents="none">
          <RadialGlow color={colors.goldWarm} />
        </Animated.View>

        <View style={styles.emberField} pointerEvents="none">
          {EMBER_SPECS.map((spec, i) => (
            <Ember key={i} progress={emberP} spec={spec} />
          ))}
        </View>

        <Animated.Text style={[styles.burstHeart, burstStyle]} pointerEvents="none">
          ♥
        </Animated.Text>
      </Animated.View>
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
    // paddingTop removed: the flush-left brand and centred counter are
    // absolutely positioned (they centre on the header's full box), while the
    // right-side icons are flex children -- a top padding centred only the
    // flex ones lower, so the three sat ~3px out of line. With no padding all
    // three centre on the same axis; the removed 6px is folded into translateY
    // below so the row's overall height is unchanged.
    paddingHorizontal: 19,
    transform: [{ translateY: -9 }],
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
    width: 42,
    height: 42,
    borderRadius: 9,
  },
  // Holds the plain flame and the (larger) ringed icon on a shared centre so
  // the crossfade lands the inner flame in the same spot.
  flameBox: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The ring icon's flame sits at ~40% of its height, so at 97px its inner
  // flame reads about the same size as the 42px plain flame it fades over.
  flameRing: {
    position: 'absolute',
    width: 97,
    height: 97,
    left: (42 - 97) / 2,
    top: (42 - 97) / 2,
  },
  brandText: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 24,
    letterSpacing: 0.2,
    color: colors.white,
  },
  // Grows the wordmark from its top-left corner so enlarging pushes it right
  // and down, never up the page.
  wordmarkOrigin: {
    transformOrigin: 'left top',
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
  gateSegment: {
    width: '100%',
    alignItems: 'center',
    gap: 18,
  },
  gateOverline: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.goldWarm,
    textAlign: 'center',
    marginBottom: 14,
  },
  streak: {
    width: 170,
    height: 1.5,
    borderRadius: 1,
    alignSelf: 'center',
    marginTop: -6,
    marginBottom: 6,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 44,
  },
  loadingLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: 'rgba(212, 169, 118, 0.6)',
    textAlign: 'center',
    // Extra gap so the label clears the top of the breathing glow underneath.
    marginBottom: 72,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 28,
    alignSelf: 'center',
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.goldWarm,
  },
  loadingEmblem: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  loadingGlowWrap: {
    position: 'absolute',
    width: 220,
    height: 220,
  },
  loadingIcon: {
    width: 108,
    height: 108,
  },
  // The charcoal emblem stacks exactly over the gold one to crossfade.
  loadingIconAbs: {
    position: 'absolute',
  },
  loadingPhrase: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 20,
    lineHeight: 32,
    color: colors.white,
    textAlign: 'center',
    maxWidth: 300,
    alignSelf: 'center',
  },
  vignettePulse: {
    position: 'absolute',
    top: '-15%',
    bottom: '-15%',
    left: '-15%',
    right: '-15%',
  },
  emberField: {
    position: 'absolute',
    top: '38%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  ember: {
    position: 'absolute',
    top: 30,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  endNameFirst: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: colors.white,
  },
  endNameRest: {
    fontFamily: 'Poppins_300Light',
    fontSize: 24,
    letterSpacing: 2,
    color: colors.textFaint,
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
    color: colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
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
  gateCondolence: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 19,
    lineHeight: 26,
    color: colors.goldWarm,
    textAlign: 'center',
    marginBottom: 10,
  },
  gateSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    lineHeight: 26,
    color: colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
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
  // Subtle, respectful consent line under the gate's primary button.
  gateTerms: {
    marginTop: 16,
    maxWidth: 320,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
    fontSize: 11.5,
    lineHeight: 17,
    color: 'rgba(255, 255, 255, 0.42)',
  },
  gateTermsLink: {
    color: colors.goldWarm,
    textDecorationLine: 'underline',
  },
  gateButtonText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    letterSpacing: 0.3,
    color: colors.ink,
  },
  switchLink: {
    marginTop: 4,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: colors.textFainter,
    textDecorationLine: 'underline',
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
    // Bumped up from 12 for older eyes, but not so large it dominates.
    fontSize: 17,
    letterSpacing: 1,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  counterSeparator: {
    fontFamily: 'Courier New',
    fontSize: 13,
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
    bottom: 26,
    // Tall enough to hold the largest labelled button (Favourites, 56) so all
    // three circles centre on the same line regardless of their own size.
    height: 56,
  },
  // Generic positioned slot for each labelled control (comment/favourites/
  // details) -- centres its column on the x passed via quarterCenterStyle.
  controlSlot: {
    justifyContent: 'center',
  },
  // Bottom-anchored layer for the lit "spotlight" copy of an open sheet's
  // trigger button; same geometry as controlsRow so the copy lands exactly
  // over the real button.
  spotlightRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 26,
    height: 56,
  },
  // Prev/Next row. Its TOP edge stays where the 62px version sat (top =
  // screen - (bottom + height) = screen - 172); the buttons grew 30% larger
  // downward, so bottom dropped from 110 to 92 while 92 + 80 == 172 holds the
  // top steady.
  navRowUp: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 92,
    height: 80,
  },
  // Biggest touch target of all (older users navigate constantly). 30% larger
  // than before (62 -> 80). Keeps the lighter navButtonLight fill so it still
  // recedes a touch versus Favourites, but its border now matches the bottom
  // three (see navButtonLight).
  navButtonBig: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fill AND border now match the bottom three buttons exactly (same as
  // navButtonContrast) per request.
  navButtonLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.36)',
  },
  // Details chip sits just above the controls row, left-aligned.
  detailsChipWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 92,
    flexDirection: 'row',
  },
  detailsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: '78%',
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
  },
  detailsChipText: {
    flexShrink: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  detailsIconFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.6,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  // Non-blocking tour banner shown over the comment sheet (so it never blocks
  // the input) during the first-favourite comment prompt.
  // Pink heart glyph that swells during the favourites tour step.
  tourPulseHeart: {
    fontSize: 42,
    lineHeight: 46,
    color: colors.heart,
  },
  tourBanner: {
    position: 'absolute',
    top: 92,
    left: 16,
    right: 16,
    zIndex: 60,
    backgroundColor: 'rgba(28, 22, 20, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(212, 169, 118, 0.4)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  tourBannerText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.white,
  },
  // Shared column for the comment + heart controls: a fixed-height box that
  // vertically centers the glass button so its center lines up with the nav
  // arrows' centers (same trick the old count used), while the label and
  // count badge float via absolute positioning and don't shift that center.
  controlColumn: {
    position: 'relative',
    // Matches controlsRow so every circle centres on one line; the label
    // hangs below via its own absolute offset.
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Frosted glass circle for the comment + details icons (secondary actions),
  // same treatment as the nav arrows so the controls read as one family.
  glassCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Favourites is the emotional primary -- bigger than its siblings (and the
  // only red one) so it's the clear focal action, applied over glassCircle.
  glassCircleFav: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  // Heart glyph sized to sit inside the 56px favourites circle.
  heartIconGlass: {
    fontSize: 34,
    lineHeight: 38,
    color: 'rgba(255, 255, 255, 0.85)',
    zIndex: 2,
  },
  controlLabel: {
    position: 'absolute',
    top: 60,
    left: -16,
    right: -16,
    textAlign: 'center',
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    letterSpacing: 0.3,
    color: 'rgba(255, 255, 255, 0.82)',
  },
  // Count moved off the "below the icon" slot (the label lives there now) to
  // a small badge on the button's top-right corner.
  controlBadge: {
    position: 'absolute',
    top: -3,
    right: -5,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(20, 16, 14, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(255, 255, 255, 0.95)',
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
    width: 26,
    height: 26,
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
