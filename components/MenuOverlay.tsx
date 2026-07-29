import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { showToast } from './Toast';
import { colors, images, type } from '../constants/theme';
import { DEMO } from '../constants/demo';
import { api, inviteUrl, keepPlaceUrl, type ButtonKey, type Project } from '../lib/api';
import { useActiveProject } from '../lib/useActiveProject';
import useEscapeToClose from '../lib/useEscapeToClose';
import BackdropVideo from './BackdropVideo';
import PressableScale from './PressableScale';
import { glassBlur, goldLitEdge } from '../lib/glass';

type MenuOverlayProps = {
  visible: boolean;
  onClose: () => void;
};

export default function MenuOverlay({ visible, onClose }: MenuOverlayProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  // Short-screen budget (second pass, 2026-07-29). With the film card present
  // the panel measured 886px against a 641px scroller on a 667px phone: two
  // subtitles wrapped, the privacy note ran three lines and the decorative
  // footer added ~74px. On short screens the footer goes; the type does not.
  const { height: winHeight } = useWindowDimensions();
  const showFooter = winHeight >= 760;
  const { projectId, projectName, clearProject, remember, activeEntry } = useActiveProject();
  const [project, setProjectDetails] = useState<Project | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingCover, setChangingCover] = useState(false);
  // The menu is where a lost person goes. Fully populated it offered twelve
  // choices, one of which silently detached them from the memorial. The four
  // rarely-needed ones now sit behind this.
  const [showMore, setShowMore] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  // Desktop web: Escape closes the menu, as every dialog on the web does.
  useEscapeToClose(visible, onClose);

  // display:none once the exit fade finishes -- pointerEvents:none alone left
  // every menu control keyboard-tabbable behind a closed, invisible menu
  // (Tab reached its Close button from the deck).
  const [rendered, setRendered] = useState(visible);
  useEffect(() => {
    if (visible) {
      setRendered(true);
      return;
    }
    const t = setTimeout(() => setRendered(false), 240);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    const duration = reduceMotion ? 0 : visible ? 220 : 180;
    progress.value = withTiming(visible ? 1 : 0, {
      duration,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
    // The overlay stays mounted, so without this a closed menu would reopen
    // still expanded, and worse, still showing an armed "Leave" confirm.
    if (!visible) {
      setShowMore(false);
      setConfirmSwitch(false);
    }
  }, [visible, reduceMotion]);

  useEffect(() => {
    if (visible && projectId) {
      api
        .getProject(projectId)
        .then((p) => {
          setProjectDetails(p);
          remember(p); // keep this memorial reopenable after a switch
        })
        .catch(() => setProjectDetails(null));
    }
  }, [visible, projectId]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
    pointerEvents: visible ? 'auto' : 'none',
  }));

  // Shared with both the "copy link" and "share via WhatsApp" actions, so
  // however the link actually reaches a family member -- pasted into
  // WhatsApp/SMS/email by hand, or sent straight through the WhatsApp
  // button -- it always carries the same warm context, not a bare URL.
  const inviteMessage = (p: Project) =>
    `We're gathering everyone's photos and memories of ${p.name} in one gentle place. Would you add yours? It means a lot: ${inviteUrl(p)}`;

  // The primary action: tapping "Invite family" opens WhatsApp directly
  // with the message ready to send, not a clipboard copy -- that's what was
  // actually agreed on ("tap opens a pre-filled WhatsApp"), copying to the
  // clipboard is the fallback for anyone who wants a different app instead.
  const handleWhatsAppShare = () => {
    if (!project) {
      showToast("We couldn't get the link just now. Please close this, check your internet, and try again.");
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(`https://wa.me/?text=${encodeURIComponent(inviteMessage(project))}`, '_blank');
    }
  };

  // "Keep your place": a link to THIS memorial carrying THIS person's own
  // transfer token -- opened on any other phone, it walks them in already
  // recognised (no name gate, same favourites and comments). Shared to
  // themselves on WhatsApp, the same channel everything else here uses.
  const handleKeepPlace = () => {
    if (!project || !activeEntry?.memberToken) {
      showToast("We couldn't get your link just now. Please close this, check your internet, and try again.");
      return;
    }
    const message = `Your place in ${project.name}'s memorial on Everlit. Open this on any phone and it will remember you: ${keepPlaceUrl(project, activeEntry.memberToken)}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const handleCopyLink = async () => {
    if (!project) {
      showToast("We couldn't get the link just now. Please close this, check your internet, and try again.");
      return;
    }
    const message = inviteMessage(project);
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2600);
    } catch {
      // navigator.clipboard needs a secure origin — fall back to a copyable prompt.
      window.prompt('Copy this and send it to your family:', message);
    }
  };

  const handleUpload = async () => {
    if (!projectId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;
    setUploading(true);
    try {
      await api.uploadPhotos(
        projectId,
        result.assets.map((asset, i) => ({
          uri: asset.uri,
          name: asset.fileName || `photo-${Date.now()}-${i}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        }))
      );
    } catch {
      showToast('Those photos were not added. Please check your internet and try again.');
    } finally {
      setUploading(false);
    }
  };

  // Re-entry point for the cover-photo gate the project creator saw right
  // after creation -- if they tapped "Skip for now" there, this was the only
  // way back in (previously admin-dashboard only, per setCoverPhoto's own
  // comment). Same upload+set flow as that gate, just reachable any time.
  const handleChangeCoverPhoto = async () => {
    if (!projectId) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets.length) return;
    setChangingCover(true);
    try {
      const asset = result.assets[0];
      const [uploaded] = await api.uploadPhotos(projectId, [
        { uri: asset.uri, name: asset.fileName || `cover-${Date.now()}.jpg`, type: asset.mimeType || 'image/jpeg' },
      ]);
      await api.setCoverPhoto(projectId, uploaded.id);
    } catch {
      showToast("That photo didn't upload. Please check your connection and try again.");
    } finally {
      setChangingCover(false);
    }
  };

  // Admin-configurable per memorial (server/app.js resolveEnabledButtons).
  // Defaults to visible while `project` hasn't loaded yet, so cards don't
  // flash and then disappear.
  const showButton = (key: ButtonKey) => DEMO || !project || project.enabledButtons?.[key] !== false;

  // In-app now (app/favourites.tsx) — the server report page stays as the
  // operator's print/PDF artifact, families no longer get bounced to it.
  const handleSeeFavourites = () => {
    onClose();
    router.push('/favourites');
  };

  const handleWatchFilm = () => {
    onClose();
    router.push('/film');
  };

  return (
    <Animated.View
      style={[styles.overlay, overlayStyle, !rendered && { display: 'none' as const }]}
      aria-hidden={!visible}
      accessibilityViewIsModal={visible}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BackdropVideo />
      </View>
      <LinearGradient
        colors={['rgba(18, 14, 12, 0.95)', 'rgba(22, 17, 14, 0.9)', 'rgba(15, 12, 10, 0.97)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* ScrollView, not View: on shorter phones the card (film + favourites
          + share + memories + add photos + settings) is taller than the
          screen and the bottom simply cut off, unreachable. Centred when it
          fits, scrolls when it does not. */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.glassCard, glassBlur]}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <View style={styles.headerActions}>
          {/* Help: restarts the guided tour (same reset as the footer link,
              surfaced as an icon so it's findable without reading small print). */}
          {/* The "?" icon that used to sit here was removed. It was 10px from
              Close, and it wiped everlit.tour.done and hard-reloaded the page:
              one misclick blanked the app, dropped the deck back to photo 1 and
              restarted the whole guided tour. The same action still exists,
              honestly labelled "Run the tutorial again", inside More settings,
              where nobody hits it by accident. */}
          <PressableScale
            onPress={onClose}
            style={styles.closeButton}
            scaleTo={0.94}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close the menu"
          >
            <View style={[styles.closeLine, { transform: [{ rotate: '45deg' }] }]} />
            <View style={[styles.closeLine, { transform: [{ rotate: '-45deg' }] }]} />
            <Text style={styles.closeText}>Close</Text>
          </PressableScale>
        </View>
      </View>

      {DEMO ? (
        <View style={styles.demoCard}>
          <Text style={styles.demoTitle}>This is a preview</Text>
          <Text style={styles.demoNote}>
            You&rsquo;re looking at a sample with a few photos. Swiping, hearts, and comments all
            work. Adding your own photos and inviting family come with the full version.
          </Text>
        </View>
      ) : (
        <>
          {!!projectName && <Text style={styles.contextLine}>{projectName}</Text>}

          {/* Order (top -> bottom): the finished film first when it exists
              (the payoff), then favourites, share with family, share
              memories. "Add photos" is no longer a full card -- it's the
              small pill down near the bottom (see uploadPill below). */}
          <View style={styles.cards}>
            {!!project?.videoUrl && (
              <ActionCard
                icon={<IconPlay />}
                title="Watch the film"
                subtitle="The tribute film is ready"
                onPress={handleWatchFilm}
                highlight
              />
            )}
            {showButton('seeFavourites') && (
              <ActionCard
                icon={<IconHeart />}
                title="See your favourites"
                // One line at 375px. "The moments your family loved" wrapped
                // to two, and the wrap cost more than the extra words earned.
                subtitle="What the family loved"
                onPress={handleSeeFavourites}
              />
            )}
            {showButton('inviteFamily') && (
              <View>
                <ActionCard
                  icon={<IconWhatsApp />}
                  title="Share with family"
                  // Says the one important thing -- tapping leaves the app for
                  // WhatsApp -- in a single line at 375px. "Opens WhatsApp for
                  // you" measured 195px against the ~191px column and wrapped.
                  subtitle="Opens WhatsApp"
                  onPress={handleWhatsAppShare}
                />
                <PressableScale
                  onPress={handleCopyLink}
                  style={styles.whatsappLink}
                  scaleTo={0.97}
                  accessibilityRole="button"
                  accessibilityLabel={copied ? 'Link copied' : 'Copy the family link instead of opening WhatsApp'}
                >
                  <Text style={styles.copyLinkText}>{copied ? 'Copied' : 'Copy link instead'}</Text>
                </PressableScale>
              </View>
            )}
            {showButton('shareMemories') && (
              <ActionCard
                icon={<IconStory />}
                title="Share your memories"
                subtitle="A few gentle questions"
                onPress={() => {
                  onClose();
                  router.push('/tribute');
                }}
              />
            )}
            {/* Quiet by design: recovery comfort, not a headline action. Only
                appears once this device holds a member identity to transfer. */}
            {!!activeEntry?.memberToken && (
              <PressableScale
                onPress={handleKeepPlace}
                style={styles.whatsappLink}
                scaleTo={0.97}
                accessibilityRole="button"
                accessibilityLabel="Keep your place on another phone. Opens WhatsApp with a link ready to send."
              >
                <Text style={styles.copyLinkText}>Keep your place on another phone</Text>
              </PressableScale>
            )}
          </View>

          {(showButton('addPhotos') || !!projectId) && (
            <View style={styles.bottomActions}>
              {showButton('addPhotos') && (
                <PressableScale
                  onPress={handleUpload}
                  style={styles.uploadPill}
                  scaleTo={0.96}
                  accessibilityRole="button"
                  accessibilityLabel="Add photos to this memorial"
                  accessibilityState={{ busy: uploading }}
                >
                  <View style={styles.uploadPlus}>
                    <View style={styles.uploadPlusBar} />
                    <View style={[styles.uploadPlusBar, { transform: [{ rotate: '90deg' }] }]} />
                  </View>
                  <Text style={styles.uploadPillText}>{uploading ? 'Adding photos…' : 'Add photos'}</Text>
                </PressableScale>
              )}
              {/* Answered at the moment of the decision, not buried in Terms:
                  this is the point where someone hesitates over uploading a
                  relative's photographs. Two lines at 375px, not three: same
                  reassurance, fewer words. */}
              {showButton('addPhotos') && (
                <Text style={styles.uploadPrivacy}>
                  Only people with the family link can see your photos.
                </Text>
              )}
              {!!projectId && !showMore && (
                <PressableScale
                  onPress={() => setShowMore(true)}
                  style={styles.switchLink}
                  scaleTo={0.98}
                  accessibilityRole="button"
                  accessibilityLabel="Show more settings"
                >
                  <Text style={styles.switchText}>More settings</Text>
                </PressableScale>
              )}

              {!!projectId && showMore && (
                <>
                  <PressableScale
                    onPress={handleChangeCoverPhoto}
                    style={styles.switchLink}
                    scaleTo={0.98}
                    accessibilityRole="button"
                    accessibilityLabel="Change the cover photo for this memorial"
                    accessibilityState={{ busy: changingCover }}
                  >
                    <Text style={styles.switchText}>
                      {changingCover ? 'Updating…' : 'Change the cover photo'}
                    </Text>
                  </PressableScale>

                  <PressableScale
                    onPress={() => {
                      if (typeof window !== 'undefined')
                        window.open('https://everlit.co.za/terms', '_blank');
                    }}
                    style={styles.switchLink}
                    scaleTo={0.98}
                    accessibilityRole="button"
                    accessibilityLabel="Open the Terms and Conditions on the Everlit website, in a new tab"
                  >
                    <Text style={styles.switchText}>Terms &amp; Conditions</Text>
                  </PressableScale>

                  {/* POPIA expects the policy to be findable, not just linked
                      from the marketing site someone may never have seen. */}
                  <PressableScale
                    onPress={() => {
                      if (typeof window !== 'undefined')
                        window.open('https://everlit.co.za/privacy', '_blank');
                    }}
                    style={styles.switchLink}
                    scaleTo={0.98}
                    accessibilityRole="button"
                    accessibilityLabel="Open the Privacy Policy on the Everlit website, in a new tab"
                  >
                    <Text style={styles.switchText}>Privacy Policy</Text>
                  </PressableScale>

                  <PressableScale
                    onPress={() => {
                      onClose();
                      try {
                        localStorage.removeItem('everlit.tour.done');
                      } catch {}
                      if (typeof window !== 'undefined') window.location.reload();
                    }}
                    style={styles.switchLink}
                    scaleTo={0.98}
                    accessibilityRole="button"
                    accessibilityLabel="Run the guided tour again"
                  >
                    <Text style={styles.switchText}>Run the tutorial again</Text>
                  </PressableScale>

                  {/* Was a one-tap action wearing the same quiet underline as
                      "Change the cover photo", and getting back in needs the
                      original WhatsApp link, which an elderly person may no
                      longer be able to find. */}
                  {!confirmSwitch ? (
                    <PressableScale
                      onPress={() => setConfirmSwitch(true)}
                      style={styles.switchLink}
                      scaleTo={0.98}
                      accessibilityRole="button"
                      accessibilityLabel="Switch to a different memorial"
                    >
                      <Text style={styles.switchText}>Switch to a different memorial</Text>
                    </PressableScale>
                  ) : (
                    <View style={styles.confirmBox}>
                      <Text style={styles.confirmText}>
                        Leave {projectName ? `${projectName}'s` : 'this'} memorial on this device?
                        You&rsquo;ll need the family&rsquo;s link to come back.
                      </Text>
                      <View style={styles.confirmRow}>
                        <PressableScale
                          onPress={() => setConfirmSwitch(false)}
                          style={styles.confirmBtn}
                          scaleTo={0.97}
                          accessibilityRole="button"
                          accessibilityLabel="Stay in this memorial"
                        >
                          <Text style={styles.confirmCancel}>Stay here</Text>
                        </PressableScale>
                        <PressableScale
                          onPress={clearProject}
                          style={styles.confirmBtn}
                          scaleTo={0.97}
                          accessibilityRole="button"
                          accessibilityLabel={`Leave ${projectName ? `${projectName}'s` : 'this'} memorial on this device`}
                        >
                          <Text style={styles.confirmLeave}>Leave</Text>
                        </PressableScale>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </>
      )}
      </View>

      {showFooter && (
        <View style={styles.footer} pointerEvents="none">
          <Image source={images.logo} style={styles.footerMark} resizeMode="contain" />
          <Text style={styles.footerText}>Everlit</Text>
        </View>
      )}
      </ScrollView>
    </Animated.View>
  );
}

type ActionCardProps = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  highlight?: boolean;
};

function ActionCard({ icon, title, subtitle, onPress, highlight }: ActionCardProps) {
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.card, goldLitEdge, highlight && styles.cardHighlight]}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
    >
      <View style={styles.iconBox}>{icon}</View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </PressableScale>
  );
}

// Icons: thin-line gold SVGs on web, matching the engraved-line style of the
// nav chevrons and the logo suite (the plain-View shapes read as a different,
// heavier icon language). Native keeps the original View fallbacks — same
// web-only inline-SVG escape hatch as NavChevron/RadialGlow in app/app.tsx.
function lineIcon(paths: { d: string; stroke?: string; opacity?: number }[], stroke = colors.goldWarm) {
  return React.createElement(
    'svg',
    { width: 26, height: 26, viewBox: '0 0 28 28' },
    ...paths.map((p, i) =>
      React.createElement('path', {
        key: i,
        d: p.d,
        stroke: p.stroke || stroke,
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        fill: 'none',
        opacity: p.opacity ?? 1,
      })
    )
  );
}

function IconPlay() {
  if (Platform.OS === 'web') {
    return lineIcon([
      { d: 'M14 25 a11 11 0 1 1 0 -22 a11 11 0 0 1 0 22 Z' },
      { d: 'M11.5 9.5 L18.5 14 L11.5 18.5 Z' },
    ]);
  }
  return (
    <View style={styles.iconInner}>
      <View style={styles.playTriangle} />
    </View>
  );
}


function IconHeart() {
  if (Platform.OS === 'web') {
    return lineIcon(
      [{ d: 'M14 22.5 S5 17 3.8 11.4 C3 7.6 5.4 5 8.5 5 c2.3 0 4.2 1.3 5.5 3.2 C15.3 6.3 17.2 5 19.5 5 c3.1 0 5.5 2.6 4.7 6.4 C23 17 14 22.5 14 22.5 Z' }],
      colors.heart
    );
  }
  return <Text style={styles.iconHeart}>♥</Text>;
}

function IconStory() {
  if (Platform.OS === 'web') {
    // Lines of writing with a short trailing line — a told story.
    return lineIcon([
      { d: 'M5 8 h18' },
      { d: 'M5 13 h18' },
      { d: 'M5 18 h11' },
      { d: 'M19 18 h4', opacity: 0.45 },
    ]);
  }
  return (
    <View style={styles.iconInner}>
      <View style={[styles.storyLine, { width: 26 }]} />
      <View style={[styles.storyLine, { width: 26 }]} />
      <View style={[styles.storyLine, { width: 16 }]} />
    </View>
  );
}

function IconWhatsApp() {
  // Chat bubble with a small tail -- a generic shape, not a WhatsApp
  // trademark asset. Green keeps the "this opens WhatsApp" affordance.
  if (Platform.OS === 'web') {
    return lineIcon(
      [{ d: 'M7 6 h14 a2.5 2.5 0 0 1 2.5 2.5 v8 a2.5 2.5 0 0 1 -2.5 2.5 h-9.5 l-5 4.5 v-4.5 h0.5 a2.5 2.5 0 0 1 -2.5 -2.5 v-8 A2.5 2.5 0 0 1 7 6 Z' }],
      '#25D366'
    );
  }
  return (
    <View style={styles.iconInner}>
      <View style={styles.waBubble} />
      <View style={styles.waTail} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.dark,
    overflow: 'hidden',
    zIndex: 100,
    paddingTop: 16,
    paddingHorizontal: 20,
    // Desktop: the overlay still covers the window, but its content column
    // stays a comfortable phone-ish width, centered. No-op on phones.
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 620,
    flex: 1,
  },
  // flexGrow so the footer's marginTop:'auto' still pins to the bottom when
  // the menu is shorter than the screen; padding keeps the last row clear of
  // the screen edge when it scrolls.
  contentInner: {
    flexGrow: 1,
    paddingBottom: 6,
  },
  // Frosted glass card matching CommentSheet/DetailsSheet's `sheet` treatment,
  // so the menu reads as one floating panel over the dimmed backdrop rather
  // than flat full-bleed content.
  glassCard: {
    backgroundColor: 'rgba(32, 26, 24, 0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  // Terms and "Run the tutorial again" moved into More settings, so the
  // 12px footer row they lived in is gone. They now share switchText's 14px,
  // which is also the better size for this audience.
  confirmBox: {
    marginTop: 6,
    maxWidth: 320,
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(32, 26, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  confirmText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: type.body,
    lineHeight: 24,
    color: colors.white,
    textAlign: 'center',
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmBtn: {
    minHeight: 44,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.glassMedium,
  },
  confirmCancel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: type.action,
    color: colors.white,
  },
  confirmLeave: {
    fontFamily: 'Poppins_500Medium',
    fontSize: type.action,
    // NOT gold. Gold is this app's primary accent, so the destructive option
    // read as the recommended one, on the very confirm that exists because
    // people were detaching themselves from a memorial by accident.
    color: colors.textFainter,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 26,
    color: colors.white,
    textDecorationLine: 'underline',
    textDecorationColor: colors.goldWarm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Round help button, same glass family as Close.


  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.glassMedium,
  },
  closeLine: {
    position: 'absolute',
    left: 12,
    width: 10,
    height: 1.5,
    backgroundColor: colors.white,
  },
  closeText: {
    fontFamily: 'Poppins_500Medium',
    // 13 -> 14 (2026-07-28 type pass). These are real tappable actions and the
    // privacy reassurance, not decoration, and 13 was under the reading floor.
    fontSize: type.label,
    color: colors.white,
    marginLeft: 14,
  },
  contextLine: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: colors.goldWarm,
    marginTop: 2,
    marginBottom: 6,
  },
  cards: {
    gap: 8,
  },
  // Compacted 2026-07-28, second pass 2026-07-29. Publishing a film adds a
  // fifth card; the first pass shaved chrome but still measured 245px past a
  // 667px screen once subtitle wrapping and the footer were counted. The
  // savings stay in chrome and word count -- never the type size: subtitles
  // are what stop a tap being a surprise and they stay at reading size.
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(42, 35, 33, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(212, 169, 118, 0.14)',
  },
  cardHighlight: {
    borderColor: colors.goldWarm,
    backgroundColor: 'rgba(212, 169, 118, 0.14)',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(212, 169, 118, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderLeftWidth: 15,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.goldWarm,
    marginLeft: 4,
  },

  iconHeart: {
    fontSize: 26,
    lineHeight: 30,
    color: colors.heart,
  },
  waBubble: {
    width: 24,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#25D366',
  },
  waTail: {
    position: 'absolute',
    bottom: -1,
    left: 6,
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderRightWidth: 7,
    borderTopColor: '#25D366',
    borderRightColor: 'transparent',
  },
  whatsappLink: {
    marginTop: 4,
    // Was 8, aligning to neither the card edge (0) nor the content edge (16).
    marginLeft: 16,
    // 4 -> 12: this was a ~22px tall tap target. paddingVertical stays 12 --
    // 12+21+12 = 45px keeps the 44px touch floor -- so the short-screen trim
    // above comes out of marginTop only.
    paddingVertical: 12,
  },
  copyLinkText: {
    fontFamily: 'Poppins_400Regular',
    // 13 -> 14 (2026-07-28 type pass). These are real tappable actions and the
    // privacy reassurance, not decoration, and 13 was under the reading floor.
    fontSize: type.label,
    color: colors.textFainter,
    textDecorationLine: 'underline',
  },
  storyLine: {
    height: 2.6,
    borderRadius: 2,
    backgroundColor: colors.goldWarm,
    marginVertical: 2.5,
  },
  cardText: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 17,
    lineHeight: 24,
    color: colors.white,
  },
  cardSubtitle: {
    fontFamily: 'Poppins_400Regular',
    // The line under each menu card is what explains the card. "Opens WhatsApp
    // with a message ready to send" is the sentence that stops a tap being a
    // surprise, so it is prose, not a caption.
    fontSize: type.body,
    lineHeight: 20,
    color: colors.textFainter,
  },
  chevron: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 28,
    color: colors.textFaintest,
    marginLeft: 4,
  },
  // Groups the small "Add photos" pill + the switch-memorial link together
  // below the main action cards.
  bottomActions: {
    marginTop: 8,
    alignItems: 'center',
    gap: 4,
  },
  // Small glass pill, same shape/treatment as the header Close button, since
  // "Add photos" is now a secondary action rather than a primary card.
  uploadPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
    backgroundColor: colors.glassMedium,
  },
  uploadPlus: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPlusBar: {
    position: 'absolute',
    width: 15,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.white,
  },
  uploadPillText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    color: colors.white,
  },
  uploadPrivacy: {
    marginTop: 0,
    maxWidth: 300,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
    // 13 -> 14 (2026-07-28 type pass). These are real tappable actions and the
    // privacy reassurance, not decoration, and 13 was under the reading floor.
    // The privacy reassurance a family reads before putting a relative's
    // photographs into a link a nephew sent on WhatsApp. Not fine print.
    fontSize: type.body,
    lineHeight: 22,
    color: colors.textFainter,
  },
  switchLink: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: colors.textFainter,
    textDecorationLine: 'underline',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 16,
    opacity: 0.45,
  },
  footerMark: {
    width: 30,
    height: 30,
  },
  footerText: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    letterSpacing: 0.3,
    color: colors.white,
  },
  demoCard: {
    marginTop: 16,
    padding: 20,
    borderRadius: 18,
    backgroundColor: colors.darkWarmLight,
    gap: 10,
  },
  demoTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    color: colors.white,
  },
  demoNote: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    lineHeight: 23,
    color: colors.textFainter,
  },
});
