import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation,
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
import PhotoScrubber from '../components/PhotoScrubber';
import LoadingState from '../components/LoadingState';
import CommentSheet from '../components/CommentSheet';
import CoachMark from '../components/CoachMark';
import PhotoGrid from '../components/PhotoGrid';
import PressableScale from '../components/PressableScale';
import GoldButton from '../components/GoldButton';
import BackdropVideo from '../components/BackdropVideo';
import HorizonGlow from '../components/HorizonGlow';
import { showToast } from '../components/Toast';
import { absoluteFill, colors, copy, images, stageWidth, CONTROLS_BAND_MAX } from '../constants/theme';
import { DEMO, DEMO_PHOTOS } from '../constants/demo';

// Dev-only: append ?loading=1 to the URL to hold the loading screen on screen
// (so its design can be iterated). Never true in a normal session.
const FORCE_LOADING =
  typeof window !== 'undefined' && /[?&]loading=1/.test(window.location.search);
import { api, heartCount, isFavoritedBy, photoAltText, photoThumbUrl, photoUrl, setInviteCode, type Photo, type Project } from '../lib/api';
import { useActiveProject } from '../lib/useActiveProject';
import { useLocalStorage } from '../lib/useLocalStorage';
import { glassBlur, glassSurface } from '../lib/glass';

// 500, not 280. 280ms is a designer-speed interval: Windows' own default
// double-click window is 500ms and older adults routinely exceed even that,
// and this product's readers are mostly elderly. The old failure was silent
// too, so a missed double-tap read as "the app is broken" or "I did it wrong".
const DOUBLE_TAP_MS = 500;

export default function SwipeScreen() {
  const { width: winWidth, height } = useWindowDimensions();
  // Photos size to the app card (which grows with the viewport on desktop),
  // not the whole window -- kept in lockstep with the frame in app/_layout.
  const width = stageWidth(winWidth, height);
  // Same centered-band math the controls row uses, so the tour can point at
  // the heart button's real on-screen x (band == width on phones).
  const bandApp = Math.min(width, CONTROLS_BAND_MAX);
  const bandLeftApp = (width - bandApp) / 2;
  // Mirror of PhotoGrid's own column math so the tour's first-tile highlight
  // is correct at every width (the old 3-column assumption broke on desktop).
  const gridColsApp = width >= 1400 ? 6 : width >= 1000 ? 5 : width >= 700 ? 4 : 3;
  const gridCellApp = (width - 2 * (gridColsApp - 1)) / gridColsApp;
  const reduceMotion = useReducedMotion();
  const { projectId, setProject, known, activeEntry, rememberMember } = useActiveProject();
  const [raterName, setRaterName] = useLocalStorage('everlit.rater', '');
  // Durable identity for the active memorial (minted server-side when the
  // person enters their name). Writes carry it; the name stays the display.
  const memberId = activeEntry?.memberId;
  const [nameDraft, setNameDraft] = useState('');
  // Gentle hint when Enter is tapped with no name (mirrors tribute's fix).
  const [nameGateHint, setNameGateHint] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  // Optional "where should we send the film?" answer, stored on the owner.
  const [newProjectContact, setNewProjectContact] = useState('');
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
  // The header counter opens a draggable 3D scrubber over the deck (web only).
  const [scrubberOpen, setScrubberOpen] = useState(false);
  const [commentPhotoId, setCommentPhotoId] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  // First-run guided tour, one pass the first time the deck opens. Ordered
  // around what a first-time family member actually needs: how to MOVE first,
  // then the heart, then the rest. Welcome and done are pure-message cards;
  // grid, gridInfo and arrows are interactive (the user taps the real element):
  //   arrows   -> tap next          (advances when the photo index changes)
  //   grid     -> tap the grid button (advances when viewMode becomes 'grid')
  //   gridInfo -> tap any photo     (advances when viewMode returns to 'deck')
  // Skipping from any step ends the whole tour. One persisted flag marks it done.
  type TourStep =
    | null
    | 'welcome'
    | 'arrows'
    | 'favourites'
    | 'comments'
    | 'grid'
    | 'gridInfo'
    | 'menu'
    | 'done';
  const [tourStep, setTourStep] = useState<TourStep>(null);
  // Welcome card's "Do not show this again" tick. Unticked + Skip = the tour
  // simply closes and offers itself again next visit; ticked = never again.
  // Completing (or skipping mid-tour) always counts as done.
  const [dontShowTour, setDontShowTour] = useState(false);
  // Stored as '' / 'true' -- localStorage only holds strings, and existing
  // devices already have the coerced string "true" from the old boolean call.
  const [tourDone, setTourDone] = useLocalStorage('everlit.tour.done', '');
  // The photo index when the final 'arrows' step began, so we can tell when the
  // user has actually moved to the next photo and end the tour.
  const arrowsStartIndex = useRef<number | null>(null);
  // Photos that have already had a comment posted / details saved this session.
  // The sheet auto-closes only the FIRST time either action happens for a
  // photo; after that it stays open so people can keep adding without it
  // shutting each time.
  const postedPhotos = useRef<Set<string>>(new Set());
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

  // Passing the "Who's here?" gate: the name is the experience, the durable
  // member behind it is the identity. Entering never blocks on the network --
  // if minting the member fails, the name alone still works exactly as it
  // always did, and the next successful write re-attaches quietly.
  const enterMemorial = () => {
    const name = nameDraft.trim();
    if (!name) {
      setNameGateHint(true);
      return;
    }
    setRaterName(name);
    api
      .enterProject(projectId, name, activeEntry?.ownerClaimToken)
      .then((member) => {
        rememberMember(projectId, name, member);
        // The owner claim can hand back the creator's earlier display name
        // (same person re-entering from another device).
        if (member.displayName && member.displayName !== name) setRaterName(member.displayName);
      })
      .catch(() => {});
  };

  const handleCreateProject = async () => {
    // creatingProject guard: a double-tap on Begin fired two createProject
    // calls and made two memorials before the first response landed.
    if (creatingProject || !newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const created = await api.createProject(newProjectName.trim(), newProjectContact.trim() || undefined);
      setProject(created);
      setNewProjectName('');
      setNewProjectContact('');
      setPickingCover(created);
    } catch {
      showToast("Couldn't create the memorial. Check your connection and try again.");
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
      showToast("That photo didn't upload. Check your connection and try again.");
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
        await api.favoritePhoto(photo.id, raterName, memberId);
      }
    } catch {
      showToast("That didn't save. Check your connection and try again.");
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
      await api.addComment(photo.id, raterName, text, memberId);
    } catch {
      showToast("That comment didn't save. Check your connection and try again.");
      refresh();
    }
  };

  const saveDetails = async (photo: Photo, details: { photoDate: string; location: string }) => {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photo.id ? { ...p, photoDate: details.photoDate || null, location: details.location || null } : p
      )
    );
    if (DEMO) return; // in-memory only, no backend
    try {
      await api.updatePhotoDetails(photo.id, details);
    } catch {
      showToast("Those details didn't save. Check your connection and try again.");
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
    if (deckReady && !tourDone && !introStartedRef.current && !menuOpen && !commentPhotoId) {
      introStartedRef.current = true;
      setTimeout(() => setTourStep('welcome'), 650);
    }
  }, [deckReady, tourDone, menuOpen, commentPhotoId]);

  // Interactive steps advance when the user performs the action, not on a Next
  // tap: open the grid, come back from it, and finally move to the next photo.
  useEffect(() => {
    if (tourStep === 'grid' && viewMode === 'grid') setTourStep('gridInfo');
  }, [tourStep, viewMode]);
  useEffect(() => {
    if (tourStep === 'gridInfo' && viewMode === 'deck') setTourStep('menu');
  }, [tourStep, viewMode]);
  useEffect(() => {
    // 'arrows' asks them to tap next; the moment the photo index moves, the
    // core gesture is learned and the tour moves on to the heart.
    if (tourStep === 'arrows') {
      if (arrowsStartIndex.current === null) {
        arrowsStartIndex.current = liveIndex;
      } else if (liveIndex !== arrowsStartIndex.current) {
        arrowsStartIndex.current = null;
        setTourStep('favourites');
      }
      return;
    }
    arrowsStartIndex.current = null;
  }, [tourStep, liveIndex]);

  // One shared guard for EVERY tour control (Next, Back, Skip, Begin). Two
  // jobs: absorbs stray double-taps from older users, and blocks web
  // tap-through, where the click that presses a control on one card ALSO
  // activates whatever control the next card mounts at the same coordinates
  // (observed live: Back on step 1 -> welcome mounts -> the same click hit
  // welcome's "Skip for now" and silently closed the tour).
  const lastAdvanceRef = useRef(0);
  const tourGuard = () => {
    const now = Date.now();
    if (now - lastAdvanceRef.current < 600) return false;
    lastAdvanceRef.current = now;
    return true;
  };

  // Ends the tour from anywhere: the Skip link on every card, and the final
  // Begin button, both land here.
  const finishTour = () => {
    if (!tourGuard()) return;
    arrowsStartIndex.current = null;
    setTourDone('true');
    setTourStep(null);
  };

  // Guarded step jump for the Back links.
  const goTourStep = (step: TourStep) => {
    if (!tourGuard()) return;
    setTourStep(step);
  };

  // The "read + tap Next" slides. The interactive steps in between (arrows,
  // grid, gridInfo) advance from the effects above, not here.
  const advanceTour = () => {
    if (!tourGuard()) return;
    setTourStep((s) => {
      if (s === 'welcome') return 'arrows';
      if (s === 'favourites') return 'comments';
      if (s === 'comments') return 'grid';
      if (s === 'menu') return 'done';
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
        // Lands the ring centred in the gap between the header and the title.
        { translateY: p * (height * 0.214 - 33) },
        { scale: 1 + p * 0.13 },
      ],
    };
  });
  const flamePlainStyle = useAnimatedStyle(() => ({ opacity: 1 - brandGrow.value }));
  const flameRingStyle = useAnimatedStyle(() => ({ opacity: brandGrow.value }));
  // Wordmark: rather than transform-scaling the header text up (which the GPU
  // bitmap-scales, softening it), we crossfade. The small 24px header wordmark
  // fades out while a second copy, rendered crisply at its final size and
  // centred in the left half of the page, fades in. Both ends stay sharp.
  // One wordmark that physically slides + scales from the small top-left
  // lockup to the big centred size (no cross-dissolve, so it reads as movement).
  // Its base font is the big size and it is only ever scaled DOWN, so it never
  // bitmap-softens. transformOrigin 'left center' (set in the style) pins its
  // left edge and vertical centre while it grows.
  const endWordSize = 36; // crisp base size
  const WORD_SMALL = 21; // resting header size
  const WORD_LEFT0 = 80; // resting left edge (flame 42 + gap 8 + inset 19... +11 spacing)
  const wordScale0 = WORD_SMALL / endWordSize;
  const wordBigWidth = (74 * endWordSize) / 24; // "Everlit" width at 36px
  const movingWordStyle = useAnimatedStyle(() => {
    const p = brandGrow.value;
    const txEnd = width / 2 - WORD_LEFT0 - wordBigWidth / 2; // centre it at the end
    return {
      transform: [
        { translateX: p * txEnd },
        { scale: wordScale0 + p * (1 - wordScale0) },
      ],
    };
  });
  // Share CTA waits until the flame has left the top-left corner (and, in
  // reverse, clears out before the flame returns).
  const shareStyle = useAnimatedStyle(() => ({
    opacity: interpolate(brandGrow.value, [0.5, 0.95], [0, 1], Extrapolation.CLAMP),
  }));
  // Scale the 125px pill down as the page narrows so its right edge always
  // clears the centred wordmark's left edge (width/2 - ~56.5), anchored at its
  // left so it stays tucked in the corner.
  const shareScale = Math.min(1, Math.max(0.55, (width / 2 - 78.5) / 125));
  // Counter lingers a touch longer, then is gone just before the wordmark
  // arrives; on the way back it only returns once the wordmark has fully gone.
  const counterStyle = useAnimatedStyle(() => ({
    opacity: interpolate(brandGrow.value, [0.1, 0.36], [1, 0], Extrapolation.CLAMP),
  }));

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
      await api.toggleCommentReaction(commentId, raterName, emoji, memberId);
    } catch {
      showToast("That reaction didn't save. Check your connection and try again.");
      refresh();
    }
  };

  if (!projectId && !DEMO) {
    return (
      <View style={styles.page}>
        <HorizonGlow />
        <View style={styles.headerOverlay} pointerEvents="box-none">
          <View style={styles.header}>
            <PressableScale
              onPress={goHome}
              scaleTo={0.96}
              hitSlop={8}
              style={styles.brand}
              accessibilityRole="button"
              accessibilityLabel="Back to the Everlit home page"
            >
              <Image source={images.logoGold} style={styles.logo} resizeMode="contain" />
              <Text style={styles.brandText}>Everlit</Text>
            </PressableScale>
          </View>
        </View>
        {/* ScrollView, not View: this is the one gate whose column (with the
            tall lockup) outgrows short phone screens -- centred when it fits,
            scrolls when it does not, instead of clipping the terms line and
            riding the lockup's flame up into the header. */}
        <ScrollView
          style={styles.gateScroll}
          contentContainerStyle={styles.gate}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
                accessibilityLabel="The name of the person being remembered"
                placeholder="Their name…"
                placeholderTextColor={colors.textFaintest}
                style={[styles.gateInput, inputFocused && styles.gateInputFocused]}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onSubmitEditing={handleCreateProject}
              />
              {/* Not a sign-up field: an optional way to reach the creator.
                  Deliberately says nothing about the film or payment -- that
                  conversation happens person-to-person on WhatsApp. */}
              <TextInput
                value={newProjectContact}
                onChangeText={setNewProjectContact}
                accessibilityLabel="Your WhatsApp number or email, so we can stay in touch, optional"
                placeholder="Your WhatsApp number or email (optional)"
                placeholderTextColor={colors.textFaintest}
                style={styles.gateInput}
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
        </ScrollView>
      </View>
    );
  }

  if (pickingCover) {
    return (
      <View style={styles.page}>
        <HorizonGlow />
        <View style={styles.headerOverlay} pointerEvents="box-none">
          <View style={styles.header}>
            <PressableScale
              onPress={goHome}
              scaleTo={0.96}
              hitSlop={8}
              style={styles.brand}
              accessibilityRole="button"
              accessibilityLabel="Back to the Everlit home page"
            >
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
              This is the first photo people will see when you share the link with your family, so it is
              worth choosing one that feels like them.
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
            <PressableScale
              onPress={goHome}
              scaleTo={0.96}
              hitSlop={8}
              style={styles.brand}
              accessibilityRole="button"
              accessibilityLabel="Back to the Everlit home page"
            >
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
              Thank you for being here to help remember them. Add your name so your favourites carry a
              little of you with them, a quiet way of saying this moment mattered to you too.
            </Text>
            <TextInput
              value={nameDraft}
              onChangeText={(text) => {
                setNameDraft(text);
                if (nameGateHint) setNameGateHint(false);
              }}
              accessibilityLabel="Your name"
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.6)"
              style={styles.gateInput}
              onSubmitEditing={enterMemorial}
            />
            {/* "Come in", not "Enter": completes the doorway the screen opens
                with ("Who's here?"), and "Enter" reads like a keyboard key. */}
            <GoldButton
              label="Come in"
              onPress={enterMemorial}
              style={styles.gateButton}
            />
            {nameGateHint && (
              <Text style={styles.gateNameHint}>
                Add your name first, so your favourites carry a little of you with them.
              </Text>
            )}
            {/* "Who can see this?" is the loudest unspoken question for someone
                about to put photographs of a relative into a link a nephew sent
                on WhatsApp, and nothing in the app answered it. Silence on a
                privacy question reads as risk, not as neutral. */}
            <Text style={styles.gatePrivacy}>
              This memorial is private. Only people with the family&rsquo;s link can see it.
            </Text>
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
          projectName={projectDetails?.name || ''}
        />
      ) : (
        <PhotoDeck
          key={`${deckIndex}-${resetSeq}`}
          photos={photos}
          width={width}
          height={height}
          raterName={raterName}
          initialIndex={deckIndex}
          navEnabled={!commentPhotoId && !scrubberOpen}
          onToggleFavorite={toggleFavorite}
          onOpenComments={(photo) => setCommentPhotoId(photo.id)}
          onIndexChange={setLiveIndex}
          reduceMotion={reduceMotion}
          projectName={projectDetails?.name || ''}
        />
      )}

      <CommentSheet
        photo={photos.find((p) => p.id === commentPhotoId) ?? null}
        onClose={closeComments}
        onSubmit={addComment}
        onReact={reactToComment}
        onSaveDetails={saveDetails}
        raterName={raterName}
        autoCloseOnPost={!!commentPhotoId && !postedPhotos.current.has(commentPhotoId)}
      />


      {/* Keep the button that opened a sheet BRIGHT above that sheet's dimming
          backdrop: a lit copy sits exactly over the (now-dimmed) real button.
          Rendered after the sheets so it paints above their backdrops, and
          pinned to the bottom control row -- clear of the floating card above
          it, so it never overlaps the sheet itself. */}
      {commentPhotoId && (
        <View style={styles.spotlightRow} pointerEvents="none">
          <View style={[styles.controlColumn, quarterCenterStyle(bandLeftApp + bandApp / 8)]}>
            <View style={[styles.glassCircle, glassSurface, glassBlur, styles.navButtonContrast]}>
              <CommentIcon active />
            </View>
            <Text style={styles.controlLabel}>Comment</Text>
          </View>
        </View>
      )}

      {/* First-run guided tour. Every card sits dead centre with a gold line
          pointing at the element it's teaching. Ordered around real first
          needs (move, then heart, then the rest); skippable from every step. */}
      <CoachMark
        visible={tourStep === 'welcome'}
        title="Welcome"
        text="This space holds the photos and memories of someone dearly loved. Let us show you how it works. It takes less than a minute."
        buttonLabel="Show me around"
        onNext={advanceTour}
        onSkip={() => {
          if (dontShowTour) {
            finishTour();
          } else {
            // Soft skip: closes now, offers itself again next visit.
            if (tourGuard()) setTourStep(null);
          }
        }}
        skipLabel="Skip for now"
        checkboxLabel="Do not show this again"
        checkboxChecked={dontShowTour}
        onToggleCheckbox={() => setDontShowTour((v) => !v)}
        screenWidth={width}
        screenHeight={height}
      />
      <CoachMark
        visible={tourStep === 'arrows'}
        title="Moving between photos"
        text="Tap the bright arrow to see the next photo."
        anchor={{ x: bandLeftApp + (bandApp * 5) / 8, y: height - 54 }}
        ringSize={96}
        interactive
        stepIndex={1}
        stepCount={5}
        onSkip={finishTour}
        onBack={() => goTourStep('welcome')}
        screenWidth={width}
        screenHeight={height}
      />
      <CoachMark
        visible={tourStep === 'favourites'}
        title="The heart"
        text="When a photo touches you, tap the heart. The whole family will see which moments matter."
        anchor={{ x: bandLeftApp + (bandApp * 7) / 8, y: height - 54 }}
        pulseNode={<Text style={styles.tourPulseHeart}>♥</Text>}
        buttonLabel="Next"
        onNext={advanceTour}
        onSkip={finishTour}
        onBack={() => goTourStep('arrows')}
        stepIndex={2}
        stepCount={5}
        screenWidth={width}
        screenHeight={height}
      />
      <CoachMark
        visible={tourStep === 'comments'}
        title="Sharing a memory"
        text="Tap the speech bubble to write a memory about this photo, and to say when and where it was taken. Even just the year helps."
        anchor={{ x: bandLeftApp + bandApp / 8, y: height - 54 }}
        pulseNode={<CommentIcon active />}
        buttonLabel="Next"
        onNext={advanceTour}
        onSkip={finishTour}
        onBack={() => goTourStep('favourites')}
        stepIndex={3}
        stepCount={5}
        screenWidth={width}
        screenHeight={height}
      />
      <CoachMark
        visible={tourStep === 'grid'}
        title="All the photos at once"
        text="Tap this button in the corner to see every photo together."
        anchor={{ x: width - 78, y: 33 }}
        ringSize={52}
        interactive
        stepIndex={4}
        stepCount={5}
        onSkip={finishTour}
        onBack={() => goTourStep('comments')}
        screenWidth={width}
        screenHeight={height}
      />
      <CoachMark
        visible={tourStep === 'gridInfo'}
        title="Back to one photo"
        text="Tap any photo to open it large again."
        anchor={{ x: gridCellApp / 2, y: 84 + gridCellApp / 2 }}
        box={{ left: 0, top: 84, width: gridCellApp, height: gridCellApp }}
        interactive
        stepIndex={4}
        stepCount={5}
        onSkip={finishTour}
        screenWidth={width}
        screenHeight={height}
      />
      <CoachMark
        visible={tourStep === 'menu'}
        title="The menu"
        text="Everything else is in here: invite your family, see the favourites, and share your memories."
        anchor={{ x: width - 34, y: 33 }}
        ringSize={52}
        buttonLabel="Next"
        onNext={advanceTour}
        onSkip={finishTour}
        onBack={() => goTourStep('grid')}
        stepIndex={5}
        stepCount={5}
        screenWidth={width}
        screenHeight={height}
      />
      <CoachMark
        visible={tourStep === 'done'}
        title="That is everything"
        text="Take all the time you need. This space is yours."
        buttonLabel="Begin"
        onNext={finishTour}
        onBack={() => goTourStep('menu')}
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
          {/* One wordmark: slides + scales from the small top-left lockup to the
              big centred size. Base font is the big size, only ever scaled down,
              so it stays crisp; transformOrigin pins the left edge + vertical
              centre while it grows. */}
          <Animated.View
            style={[
              { position: 'absolute', left: WORD_LEFT0, top: 18, transformOrigin: 'left center' },
              movingWordStyle,
            ]}
            pointerEvents="box-none"
          >
            <PressableScale
              onPress={goHome}
              scaleTo={0.96}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Back to the Everlit home page"
            >
              <Text style={[styles.brandText, { fontSize: endWordSize, lineHeight: endWordSize * 1.34 }]}>
                Everlit
              </Text>
            </PressableScale>
          </Animated.View>
          {/* Share-with-family CTA, fading in top-left. Vertically centred on
              the icon line; its left inset (18) equals the gap from its top rim
              to the top edge, so the pill is symmetrically tucked in the
              corner. */}
          <Animated.View
            style={[{ position: 'absolute', left: 18, top: 0, bottom: 0, justifyContent: 'center' }, shareStyle]}
            pointerEvents={onEndSlide ? 'auto' : 'none'}
          >
            <View style={{ transform: [{ scale: shareScale }], transformOrigin: 'left center' }}>
              <PressableScale
                onPress={() => setMenuOpen(true)}
                scaleTo={0.95}
                style={styles.shareCta}
                accessibilityRole="button"
                tabIndex={onEndSlide ? 0 : -1}
                aria-hidden={!onEndSlide}
              >
                <Text style={styles.shareCtaText}>Share with family</Text>
              </PressableScale>
            </View>
          </Animated.View>
          {/* Flame: separate wrapper that flies to the middle of the slide and
              crossfades to the ringed icon. Sits above the wordmark's z so the
              ring never clips behind the text as it grows. */}
          <Animated.View
            style={[styles.centerContent, { position: 'absolute', left: 19, top: 0, bottom: 0, zIndex: 1 }, flameFlyStyle]}
            pointerEvents="box-none"
          >
            <PressableScale
              onPress={goHome}
              scaleTo={0.96}
              hitSlop={8}
              style={styles.flameBox}
              accessibilityRole="button"
              accessibilityLabel="Back to the Everlit home page"
            >
              <Animated.Image source={images.logoGold} style={[styles.logo, flamePlainStyle]} resizeMode="contain" />
              <Animated.Image source={images.logoRing} style={[styles.flameRing, flameRingStyle]} resizeMode="contain" />
            </PressableScale>
          </Animated.View>
          {viewMode === 'deck' && photos.length > 0 && (
            // Kept mounted through the end-slide transition so it can fade
            // (not pop) out and back. The displayed index is clamped so it never
            // flashes "07 / 06" while fading out on the closing slide.
            // Pressable (web): opens the drag-to-photo scrubber.
            <Animated.View
              style={[styles.headerCounter, quarterCenterStyle(width / 2), counterStyle]}
              pointerEvents={Platform.OS === 'web' ? 'box-none' : 'none'}
            >
              <PressableScale
                onPress={() => {
                  if (Platform.OS === 'web') setScrubberOpen(true);
                }}
                scaleTo={0.94}
                hitSlop={12}
                style={styles.counterPress}
                accessibilityRole="button"
                accessibilityLabel="Jump to a photo"
              >
                <Text style={styles.counterText}>
                  {String(Math.min(liveIndex, photos.length - 1) + 1).padStart(2, '0')}
                </Text>
                <Text style={styles.counterSeparator}>/</Text>
                <Text style={styles.counterText}>{String(photos.length).padStart(2, '0')}</Text>
              </PressableScale>
            </Animated.View>
          )}
          <View style={[styles.headerActions, { marginLeft: 'auto' }]}>
            {photos.length > 0 && (
              <ViewModeButton
                mode={viewMode}
                onPress={() => setViewMode((m) => (m === 'deck' ? 'grid' : 'deck'))}
              />
            )}
            {/* No menu while loading: nothing in it works yet, and the loading
                screen is meant to be a held breath, not a navigation moment. */}
            {!loading && <HamburgerButton onPress={() => setMenuOpen(true)} />}
          </View>
        </View>
      </View>

      {scrubberOpen && (
        <PhotoScrubber
          photos={photos}
          index={Math.min(liveIndex, Math.max(0, photos.length - 1))}
          onPick={(i) => {
            setScrubberOpen(false);
            // Same jump mechanism the grid uses: remount the deck at i. The
            // resetSeq bump forces the remount even when deckIndex is
            // unchanged (deckIndex only tracks grid/scrubber picks, so after
            // plain swiping it can equal i while the deck sits elsewhere).
            setDeckIndex(i);
            setResetSeq((s) => s + 1);
          }}
          onClose={() => setScrubberOpen(false)}
        />
      )}

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

// The empty state is its own quiet invitation screen: backdrop, the first-photo
// prompt, and the upload button. Deliberately none of the deck chrome (counter,
// heart, favourite hint) -- there is nothing to count or favourite yet.
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
    </View>
  );
}

// Landing/gate backdrop: the shared looping candle-flame video (see
// components/BackdropVideo), dimmed under a warm dark scrim so it reads as
// depth behind the copy — not a bright flame fighting white text. Scrim is
// darkest top & bottom (text zones), lets the glow through the middle where
// the hero mark sits.
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
    transform: [{ translateX: endArrows.value * (width / 2 - (bandLeft + (band * 3) / 8)) }],
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
              isCurrent={i === index}
              scrollX={scrollX}
              width={width}
              height={height}
              raterName={raterName}
              onToggleFavorite={onToggleFavorite}
              reduceMotion={reduceMotion}
              projectName={projectName}
              total={photos.length}
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
          active={index >= photos.length}
        />
      </ScrollView>

      {/* Legibility scrim: the control labels sit on raw photo pixels and a
          bright sky washes them out; same treatment EmptyState already uses. */}
      <LinearGradient
        colors={['transparent', 'rgba(16, 14, 12, 0.6)']}
        style={styles.bottomScrim}
        pointerEvents="none"
      />

      {/* One row of four, evenly spread at eighths of the band: Comment on
          the left, the Prev/Next pair dead centre (movement is the deck's
          core act, so it owns the middle), Favourites on the right. Arrows
          stay bare and bigger -- direction reads instantly, and the two
          labelled buttons flanking them are the action family. */}
      <View style={styles.controlsRow} pointerEvents="box-none">
        <View style={[styles.controlSlot, quarterCenterStyle(bandLeft + band / 8)]}>
          {currentPhoto && (
            <View style={styles.controlColumn}>
              <Animated.View style={[styles.commentGlow, commentGlowStyle]} pointerEvents="none">
                {/* Green glow, matching the comment icon's own accent, so the
                    nudge after a like reads as "add a comment". */}
                <RadialGlow color={colors.comment} />
              </Animated.View>
              <PressableScale
                onPress={() => onOpenComments(currentPhoto)}
                scaleTo={0.96}
                hitSlop={12}
                style={commentPulseStyle}
                accessibilityRole="button"
                accessibilityLabel={`Comments and details for this photo${currentPhoto.comments.length ? `, ${currentPhoto.comments.length} so far` : ''}`}
              >
                <View style={[styles.glassCircle, glassSurface, glassBlur, styles.navButtonContrast]}>
                  <CommentIcon active={currentPhoto.comments.length > 0 || !!(currentPhoto.photoDate || currentPhoto.location)} />
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

        <View style={[styles.controlSlot, quarterCenterStyle(bandLeft + (band * 3) / 8)]}>
          <Animated.View style={prevShiftStyle}>
            <PressableScale
              onPress={() => goTo(index - 1)}
              scaleTo={0.9}
              hitSlop={10}
              style={[styles.navButtonBig, glassSurface, glassBlur, styles.navButtonLight, index === 0 && styles.navButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Previous photo"
              accessibilityState={{ disabled: index === 0 }}
            >
              <NavChevron direction="left" />
            </PressableScale>
          </Animated.View>
        </View>

        <View style={[styles.controlSlot, quarterCenterStyle(bandLeft + (band * 5) / 8)]} pointerEvents={atEnd ? 'none' : 'box-none'}>
          <Animated.View style={nextFadeStyle}>
            <PressableScale
              onPress={() => goTo(index + 1)}
              scaleTo={0.9}
              hitSlop={10}
              style={[styles.navButtonBig, glassSurface, glassBlur, styles.navButtonLight, index === lastIndex && styles.navButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Next photo"
              accessibilityState={{ disabled: index === lastIndex }}
            >
              <NavChevron direction="right" />
            </PressableScale>
          </Animated.View>
        </View>

        <View style={[styles.controlSlot, quarterCenterStyle(bandLeft + (band * 7) / 8)]} pointerEvents="box-none">
          {currentPhoto && (
            <View style={styles.controlColumn}>
              <Animated.View style={[styles.glowPulse, glowStyle]} pointerEvents="none">
                <RadialGlow color={colors.heart} />
              </Animated.View>
              <PressableScale
                onPress={handleHeartPress}
                scaleTo={0.82}
                hitSlop={16}
                accessibilityRole="button"
                accessibilityLabel={favorited ? 'Remove this photo from your favourites' : 'Favourite this photo'}
              >
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
    // One clean chevron in the same simple-stroke language as every other
    // icon in the app (comment bubble, details ring). White with a soft dark
    // halo for legibility on any photo; no flourishes.
    return React.createElement(
      'svg',
      {
        width: 34,
        height: 34,
        viewBox: '0 0 24 24',
        style: {
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))',
          ...(mirror ? { transform: 'scaleX(-1)' } : {}),
        },
      },
      React.createElement('path', {
        d: 'M9.5 5.5 L16.5 12 L9.5 18.5',
        stroke: 'rgba(255, 255, 255, 0.95)',
        strokeWidth: 2.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        fill: 'none',
      })
    );
  }
  return <View style={[styles.chevron, direction === 'left' ? styles.chevronLeft : styles.chevronRight]} />;
}

// Radial sheen filling the nav button, brightest at the centre and fading to
// the button's own edge fill, so the disc reads as gently domed. Web-only
// (RN has no radial-gradient); native keeps the flat fill.
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
  photos: Photo[];
  reduceMotion: boolean;
  // True only while the deck is actually parked on this slide. Off the slide
  // its CTA is invisible, so it must be neither tabbable nor in the
  // accessibility tree.
  active: boolean;
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

function EndOfDeckSlide({ width, height, projectName, photos, reduceMotion, active }: EndOfDeckSlideProps) {
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
  // "them" (not "their") -- this fallback now feeds "remembering {name} with
  // us", and "remembering them with us" is the grammatical one.
  const nameFirst = nameParts[0] || 'them';
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
      {/* No trailing "with us": the thank-you belongs to the person being
          remembered, not to the app. */}
      <Text style={styles.endTitle}>
        Thank you for spending this time remembering{' '}
        <Text style={styles.endNameFirst}>{nameFirst}</Text>
        {nameRest ? <Text style={styles.endNameRest}> {nameRest}</Text> : null}
        .
      </Text>
      <Text style={styles.endSubtitle}>
        Now you can see the moments your whole family chose to hold onto. Tap below for the
        favourites, and the memories everyone shared.
      </Text>
      {/* Sentence case like every other label in the app -- Title Case read
          as a feature name. */}
      <GoldButton label="See what we all loved" onPress={openFavourites} style={styles.endButton} focusable={active} />
    </View>
  );
}

type PhotoSlideProps = {
  photo: Photo;
  index: number;
  // Offscreen slides (the mounted neighbours) must not be tabbable or read by
  // screen readers -- Tab was landing on invisible slides before any control.
  isCurrent: boolean;
  scrollX: SharedValue<number>;
  width: number;
  height: number;
  raterName: string;
  onToggleFavorite: (photo: Photo) => void;
  reduceMotion: boolean;
  // Both only used to build the screen-reader label for the photograph.
  projectName?: string | null;
  total: number;
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
function PhotoSlide({ photo, index, isCurrent, scrollX, width, height, raterName, onToggleFavorite, reduceMotion, projectName, total }: PhotoSlideProps) {
  const favorited = isFavoritedBy(photo, raterName);
  const burst = useSharedValue(0);
  const emberP = useSharedValue(0);
  const vignette = useSharedValue(0);
  const hint = useSharedValue(0);
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

  const hintStyle = useAnimatedStyle(() => ({ opacity: hint.value }));

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

  // A single tap used to do nothing at all, so someone whose hands missed the
  // double-tap window got no response whatsoever and had no way to tell
  // whether the app was broken, the photo was broken, or they had done it
  // wrong. Now the first tap always answers, and tells them what to do next.
  const showTapHint = () => {
    if (favorited) return;
    hint.value = withSequence(
      withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) }),
      withDelay(1400, withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) })),
    );
  };

  // Double-tap = favourite (never un-favourite), Instagram-style. The heart
  // burst always plays on a double-tap, even when it was already a favourite.
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      hint.value = 0;
      if (!favorited) onToggleFavorite(photo);
      playBurst();
    } else {
      lastTap.current = now;
      showTapHint();
    }
  };

  const source = photo.localSource ?? { uri: photoUrl(photo) };

  return (
    // The slide itself is the labelled, focusable element (double-tap surface)
    // -- and only while it IS the current slide; the mounted neighbours are
    // invisible and must stay out of the Tab order and accessibility tree.
    <Pressable
      onPress={handleTap}
      style={{ width, height, overflow: 'hidden' }}
      // tabIndex, not focusable: react-native-web's Pressable keeps its
      // rendered tabindex at 0 regardless of focusable={false}.
      tabIndex={isCurrent ? 0 : -1}
      aria-hidden={!isCurrent}
      accessibilityRole="button"
      accessibilityLabel={`${photoAltText(photo, projectName)}, photo ${index + 1} of ${total}. Double-tap to favourite`}
    >
      <Animated.View style={[StyleSheet.absoluteFill, pageStyle]}>
        {/* Blurred, dimmed, slowly-breathing copy behind the framed print. */}
        <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
          <Image
            source={source}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            blurRadius={24}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            accessibilityLabel=""
          />
        </Animated.View>
        <View style={styles.fillDim} pointerEvents="none" />

        {/* The whole photo, fit to screen (no cropping / bleed) — the framed
            "print" treatment was tried and reverted: against this near-black
            backdrop the border read as a floating rectangle, not a print. */}
        {/* The label lives on the slide's Pressable (which is also the
            double-tap-to-favourite surface); labelling the image too would
            announce the photograph twice. */}
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          accessibilityLabel=""
        />

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

        {/* The answer to a single tap: an outlined heart (hollow, so it never
            reads as "already kept") plus the one instruction that matters. */}
        <Animated.View style={[styles.tapHint, hintStyle]} pointerEvents="none">
          <Text style={styles.tapHintHeart}>♡</Text>
          <Text style={styles.tapHintText}>Tap again to keep this one</Text>
        </Animated.View>
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
  // Inner pressable carrying the counter row (the outer Animated.View stays
  // layout-only so the press target doesn't fight quarterCenterStyle).
  counterPress: {
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
    fontSize: 21,
    letterSpacing: 0.2,
    color: colors.white,
  },
  // Closing-slide CTA on the left, gold-tinted pill.
  shareCta: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(212, 169, 118, 0.4)',
    backgroundColor: 'rgba(212, 169, 118, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareCtaText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    letterSpacing: 0.2,
    color: colors.goldWarm,
  },
  // flexGrow (not flex): styles.gate doubles as the create gate's ScrollView
  // contentContainerStyle, where flexGrow means "centre when the content
  // fits, grow the scroll area when it does not".
  gate: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    // Was paddingBottom 80 alone: the bottom-only bias pushed the centred
    // column up until, at common phone heights (~800-870px), the lockup's
    // flame rode into the header band and sat beside the header's own flame
    // as a doubled mark. Top padding reserves the header's band instead.
    paddingTop: 64,
    paddingBottom: 32,
  },
  gateScroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  gateInner: {
    width: '100%',
    alignItems: 'center',
    gap: 18,
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
  // Deliberately brighter and larger than gateTerms below it: this is
  // reassurance the person needs before deciding to take part, not boilerplate
  // they scan past.
  gatePrivacy: {
    marginTop: 14,
    maxWidth: 330,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: colors.textFaint,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  // Carries the only Terms link on the gate, and sat at 11.5px / 0.42 white
  // (~4.1:1) over a *moving* candle video, so its real contrast was worse than
  // the static figure. 13px at 0.62 clears AA against the gate's darkest band
  // with the shadow doing the rest.
  gateTerms: {
    marginTop: 16,
    maxWidth: 320,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.62)',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  gateTermsLink: {
    color: colors.goldWarm,
    textDecorationLine: 'underline',
  },
  gateNameHint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: colors.goldWarm,
    textAlign: 'center',
    maxWidth: 360,
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
  // Biggest touch target of all (older users navigate constantly). 30% larger
  // than before (62 -> 80). Keeps the lighter navButtonLight fill so it still
  // recedes a touch versus Favourites, but its border now matches the row's
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
  // Pink heart glyph that swells during the favourites tour step.
  tourPulseHeart: {
    fontSize: 42,
    lineHeight: 46,
    color: colors.heart,
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
  // These three name the deck's primary actions, so they were the smallest
  // type in the product labelling the most important controls, and at 0.82
  // white over a bright photo they computed to ~4.01:1, under AA. 12px with
  // the tracking removed to buy the width back, a fully opaque fill, and a
  // shadow so they hold up over a bright sky rather than relying on the
  // band's scrim alone. (The counter beside them is 17px "for older eyes";
  // 10px labels contradicted that.)
  controlLabel: {
    position: 'absolute',
    top: 60,
    left: -18,
    right: -18,
    textAlign: 'center',
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    letterSpacing: 0,
    color: colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
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
  commentIconFallback: {
    width: 24,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 2.2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  // Same filled-circle burst as the heart's glowPulse (not a blurred shadow
  // around the icon's box, which just read as a pill-shaped outline at this
  // size) -- centered behind the icon by its parent's own centering.
  commentGlow: {
    position: 'absolute',
    width: 48,
    height: 48,
  },
  glowPulse: {
    position: 'absolute',
    width: 56,
    height: 56,
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
  tapHint: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    alignItems: 'center',
    gap: 6,
  },
  tapHintHeart: {
    fontSize: 76,
    lineHeight: 88,
    color: 'rgba(255, 255, 255, 0.92)',
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowRadius: 20,
  },
  tapHintText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    color: colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
});
