import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { showToast } from './Toast';
import { colors, images } from '../constants/theme';
import { DEMO } from '../constants/demo';
import { api, inviteUrl, type ButtonKey, type Project } from '../lib/api';
import { useActiveProject } from '../lib/useActiveProject';
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
  const { projectId, projectName, clearProject, remember } = useActiveProject();
  const [project, setProjectDetails] = useState<Project | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingCover, setChangingCover] = useState(false);

  useEffect(() => {
    const duration = reduceMotion ? 0 : visible ? 220 : 180;
    progress.value = withTiming(visible ? 1 : 0, {
      duration,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
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
    <Animated.View style={[styles.overlay, overlayStyle]}>
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
      <View style={styles.content}>
      <View style={[styles.glassCard, glassBlur]}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <View style={styles.headerActions}>
          {/* Help: restarts the guided tour (same reset as the footer link,
              surfaced as an icon so it's findable without reading small print). */}
          <PressableScale
            onPress={() => {
              onClose();
              try {
                localStorage.removeItem('everlit.tour.done');
              } catch {}
              if (typeof window !== 'undefined') window.location.reload();
            }}
            style={styles.helpButton}
            scaleTo={0.94}
            hitSlop={6}
          >
            <Text style={styles.helpText}>?</Text>
          </PressableScale>
          <PressableScale onPress={onClose} style={styles.closeButton} scaleTo={0.94}>
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
                subtitle="The moments your family chose to hold onto"
                onPress={handleSeeFavourites}
              />
            )}
            {showButton('inviteFamily') && (
              <View>
                <ActionCard
                  icon={<IconWhatsApp />}
                  title="Share with family"
                  subtitle="Opens WhatsApp with a message ready to send"
                  onPress={handleWhatsAppShare}
                />
                <PressableScale onPress={handleCopyLink} style={styles.whatsappLink} scaleTo={0.97}>
                  <Text style={styles.copyLinkText}>{copied ? 'Copied' : 'Copy link instead'}</Text>
                </PressableScale>
              </View>
            )}
            {showButton('shareMemories') && (
              <ActionCard
                icon={<IconStory />}
                title="Share your memories"
                subtitle="Answer a few gentle questions for the tribute"
                onPress={() => {
                  onClose();
                  router.push('/tribute');
                }}
              />
            )}
          </View>

          {(showButton('addPhotos') || !!projectId) && (
            <View style={styles.bottomActions}>
              {showButton('addPhotos') && (
                <PressableScale onPress={handleUpload} style={styles.uploadPill} scaleTo={0.96}>
                  <View style={styles.uploadPlus}>
                    <View style={styles.uploadPlusBar} />
                    <View style={[styles.uploadPlusBar, { transform: [{ rotate: '90deg' }] }]} />
                  </View>
                  <Text style={styles.uploadPillText}>{uploading ? 'Adding photos…' : 'Add photos'}</Text>
                </PressableScale>
              )}
              {/* Answered at the moment of the decision, not buried in Terms:
                  this is the point where someone hesitates over uploading a
                  relative's photographs. */}
              {showButton('addPhotos') && (
                <Text style={styles.uploadPrivacy}>
                  Your photos stay in this memorial. Only people with the link can see them.
                </Text>
              )}
              {!!projectId && (
                <PressableScale onPress={handleChangeCoverPhoto} style={styles.switchLink} scaleTo={0.98}>
                  <Text style={styles.switchText}>
                    {changingCover ? 'Updating…' : 'Change the cover photo'}
                  </Text>
                </PressableScale>
              )}
              {!!projectId && (
                <PressableScale onPress={clearProject} style={styles.switchLink} scaleTo={0.98}>
                  <Text style={styles.switchText}>Switch to a different memorial</Text>
                </PressableScale>
              )}
            </View>
          )}
        </>
      )}

      <View style={styles.legalLinks}>
        <PressableScale
          onPress={() => {
            if (typeof window !== 'undefined') window.open('https://everlit.co.za/terms', '_blank');
          }}
          scaleTo={0.97}
        >
          <Text style={styles.legalLinkText}>Terms & Conditions</Text>
        </PressableScale>
        <View style={styles.legalDot} />
        <PressableScale
          onPress={() => {
            onClose();
            try {
              localStorage.removeItem('everlit.tour.done');
            } catch {}
            if (typeof window !== 'undefined') window.location.reload();
          }}
          scaleTo={0.97}
        >
          <Text style={styles.legalLinkText}>Run the tutorial again</Text>
        </PressableScale>
      </View>
      </View>

      <View style={styles.footer} pointerEvents="none">
        <Image source={images.logo} style={styles.footerMark} resizeMode="contain" />
        <Text style={styles.footerText}>Everlit</Text>
      </View>
      </View>
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
    <PressableScale onPress={onPress} style={[styles.card, goldLitEdge, highlight && styles.cardHighlight]} scaleTo={0.98}>
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

function IconAdd() {
  if (Platform.OS === 'web') {
    // A photo frame with a small sun/plus — "add pictures".
    return lineIcon([
      { d: 'M4 6.5 h20 v15 h-20 z' },
      { d: 'M4 17 L11 11.5 L17 16.5 L21 13.5 L24 15.5', opacity: 0.75 },
      { d: 'M19.5 9.5 h0.01' },
    ]);
  }
  return (
    <View style={styles.iconInner}>
      <View style={styles.plusBar} />
      <View style={[styles.plusBar, { transform: [{ rotate: '90deg' }] }]} />
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
    paddingTop: 44,
    paddingHorizontal: 20,
    // Desktop: the overlay still covers the window, but its content column
    // stays a comfortable phone-ish width, centered. No-op on phones.
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 620,
    flex: 1, // keeps the footer's marginTop:'auto' pinned to the bottom
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
    paddingVertical: 20,
  },
  legalLinks: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  legalLinkText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: colors.textFainter,
  },
  legalDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textFainter,
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  helpButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.glassMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
    color: colors.goldWarm,
  },
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
    fontSize: 13,
    color: colors.white,
    marginLeft: 14,
  },
  contextLine: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: colors.goldWarm,
    marginTop: 8,
    marginBottom: 20,
  },
  cards: {
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 84,
    paddingVertical: 16,
    paddingHorizontal: 16,
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
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 169, 118, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 28,
    height: 28,
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
  plusBar: {
    position: 'absolute',
    width: 24,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: colors.goldWarm,
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
    marginTop: 8,
    marginLeft: 8,
    paddingVertical: 4,
  },
  copyLinkText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
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
    fontSize: 18,
    color: colors.white,
  },
  cardSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
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
    marginTop: 24,
    alignItems: 'center',
    gap: 6,
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
    marginTop: 2,
    maxWidth: 300,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: colors.textFainter,
  },
  switchLink: {
    height: 40,
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
    paddingBottom: 28,
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
