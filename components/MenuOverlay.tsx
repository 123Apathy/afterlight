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
import { colors, images } from '../constants/theme';
import { DEMO } from '../constants/demo';
import { API_BASE, api, inviteUrl, type ButtonKey, type Project } from '../lib/api';
import { useActiveProject } from '../lib/useActiveProject';
import BackdropVideo from './BackdropVideo';
import PressableScale from './PressableScale';

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
    `We're gathering photos and memories to honour ${p.name}. Add yours here: ${inviteUrl(p)}`;

  // The primary action: tapping "Invite family" opens WhatsApp directly
  // with the message ready to send, not a clipboard copy -- that's what was
  // actually agreed on ("tap opens a pre-filled WhatsApp"), copying to the
  // clipboard is the fallback for anyone who wants a different app instead.
  const handleWhatsAppShare = () => {
    if (!project) {
      window.alert("We couldn't get the link just now. Please close this, check your internet, and try again.");
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(`https://wa.me/?text=${encodeURIComponent(inviteMessage(project))}`, '_blank');
    }
  };

  const handleCopyLink = async () => {
    if (!project) {
      window.alert("We couldn't get the link just now. Please close this, check your internet, and try again.");
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
      window.alert('Those photos were not added. Please check your internet and try again.');
    } finally {
      setUploading(false);
    }
  };

  // Admin-configurable per memorial (server/app.js resolveEnabledButtons).
  // Defaults to visible while `project` hasn't loaded yet, so cards don't
  // flash and then disappear.
  const showButton = (key: ButtonKey) => DEMO || !project || project.enabledButtons?.[key] !== false;

  const handleSeeFavourites = () => {
    if (!project) {
      window.alert("We couldn't open the favourites just now. Please close this, check your internet, and try again.");
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(`${API_BASE}/api/report/${project.inviteCode}`, '_blank');
    }
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
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <PressableScale onPress={onClose} style={styles.closeButton} scaleTo={0.94}>
          <View style={[styles.closeLine, { transform: [{ rotate: '45deg' }] }]} />
          <View style={[styles.closeLine, { transform: [{ rotate: '-45deg' }] }]} />
          <Text style={styles.closeText}>Close</Text>
        </PressableScale>
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

          <View style={styles.cards}>
            {showButton('addPhotos') && (
              <ActionCard
                icon={<IconAdd />}
                title={uploading ? 'Adding photos…' : 'Add photos'}
                subtitle="Choose pictures from this phone"
                onPress={handleUpload}
              />
            )}
            {showButton('inviteFamily') && (
              <View>
                <ActionCard
                  icon={<IconWhatsApp />}
                  title="Invite family"
                  subtitle="Opens WhatsApp with a message ready to send"
                  onPress={handleWhatsAppShare}
                />
                <PressableScale onPress={handleCopyLink} style={styles.whatsappLink} scaleTo={0.97}>
                  <Text style={styles.copyLinkText}>{copied ? 'Copied' : 'Copy link instead'}</Text>
                </PressableScale>
              </View>
            )}
            {showButton('seeFavourites') && (
              <ActionCard
                icon={<IconHeart />}
                title="See everyone's favourites"
                subtitle="The photos your family loved the most"
                onPress={handleSeeFavourites}
              />
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

          {!!projectId && (
            <PressableScale onPress={clearProject} style={styles.switchLink} scaleTo={0.98}>
              <Text style={styles.switchText}>Switch to a different memorial</Text>
            </PressableScale>
          )}
        </>
      )}

      <View style={styles.footer} pointerEvents="none">
        <Image source={images.logo} style={styles.footerMark} resizeMode="contain" />
        <Text style={styles.footerText}>Everlit</Text>
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
    <PressableScale onPress={onPress} style={[styles.card, highlight && styles.cardHighlight]} scaleTo={0.98}>
      <View style={styles.iconBox}>{icon}</View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </PressableScale>
  );
}

// Icons drawn with plain Views — no icon library, no emoji.
function IconAdd() {
  return (
    <View style={styles.iconInner}>
      <View style={styles.plusBar} />
      <View style={[styles.plusBar, { transform: [{ rotate: '90deg' }] }]} />
    </View>
  );
}

function IconHeart() {
  return <Text style={styles.iconHeart}>♥</Text>;
}

function IconStory() {
  // Lines of writing — a story/note.
  return (
    <View style={styles.iconInner}>
      <View style={[styles.storyLine, { width: 26 }]} />
      <View style={[styles.storyLine, { width: 26 }]} />
      <View style={[styles.storyLine, { width: 16 }]} />
    </View>
  );
}

function IconWhatsApp() {
  // Chat bubble with a small tail -- a placeholder shape, not a WhatsApp
  // trademark asset. Swap for a real brand icon whenever the button pack
  // gets designed.
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
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.glassMedium,
  },
  closeLine: {
    position: 'absolute',
    left: 16,
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.white,
  },
  closeText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    color: colors.white,
    marginLeft: 18,
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
  switchLink: {
    marginTop: 28,
    height: 48,
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
