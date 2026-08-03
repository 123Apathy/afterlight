import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Atmosphere from '../../components/Atmosphere';
import BackdropVideo from '../../components/BackdropVideo';
import GoldButton from '../../components/GoldButton';
import HorizonGlow from '../../components/HorizonGlow';
import LoadingState from '../../components/LoadingState';
import PressableScale from '../../components/PressableScale';
import { colors, images, type } from '../../constants/theme';
import { api } from '../../lib/api';
import { useActiveProject } from '../../lib/useActiveProject';

const WHATSAPP_URL = 'https://wa.me/27626607269';

// The arrival screen. Almost everyone meets Everlit here first, on a phone,
// from a WhatsApp link, often hours after a funeral — so this screen is lit by
// the same candle as the gates it hands off to, and its failure state offers a
// way forward instead of stopping dead.
export default function JoinScreen() {
  const { code, m } = useLocalSearchParams<{ code: string; m?: string }>();
  const router = useRouter();
  const { setProject } = useActiveProject();
  const reduceMotion = useReducedMotion();
  const [error, setError] = useState<'missing' | 'invalid' | null>(null);
  // Bumping this re-runs the effect, so "Try again" is a real retry rather
  // than a page reload the person has to work out for themselves.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!code) {
      // No code in the URL: without this the screen sat on the loading state
      // forever with no way out.
      setError('missing');
      return;
    }
    let cancelled = false;
    setError(null);
    api
      // ?m= is a "keep your place" transfer token: this device walks in
      // already recognised, skipping the name gate entirely.
      .getProjectByInvite(code, typeof m === 'string' ? m : undefined)
      .then((project) => {
        if (cancelled) return;
        setProject(project);
        // Raw string, matching useLocalStorage's convention (no JSON).
        if (project.member?.displayName) {
          try {
            localStorage.setItem('everlit.rater', project.member.displayName);
          } catch {
            /* storage blocked: the name gate simply asks as usual */
          }
        }
        router.replace('/app');
      })
      .catch(() => {
        if (!cancelled) setError('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [code, m, attempt]);

  const openWhatsApp = useCallback(() => {
    Linking.openURL(WHATSAPP_URL).catch(() => {});
  }, []);

  if (!error) {
    return <LoadingState reduceMotion={reduceMotion} label="Opening the memorial" />;
  }

  return (
    <View style={styles.page}>
      {/* Same air as the gates this screen hands off to: candle, dark
          gradient, embers, horizon glow. A confused arrival moment is exactly
          when the product should look most like itself — a flat dark page
          here read as "something broke", not "you're in the right place". */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BackdropVideo />
        <LinearGradient
          colors={['rgba(20, 16, 14, 0.92)', 'rgba(24, 19, 16, 0.8)', 'rgba(20, 16, 14, 0.95)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Atmosphere />
      </View>
      <HorizonGlow />
      <View style={styles.inner}>
        <Image source={images.logoGold} style={styles.flame} resizeMode="contain" />
        <Text style={styles.overline}>Everlit · Memorial Films</Text>
        <Text style={styles.title}>We couldn't open this link</Text>
        <Text style={styles.body}>
          {error === 'invalid'
            ? 'The link may have been cut short when it was shared. Ask whoever sent it to send it again, and tap it straight from the message.'
            : 'This link is missing its invite code. Ask whoever sent it to send the whole link again.'}
        </Text>
        {error === 'invalid' ? (
          <GoldButton label="Try again" onPress={() => setAttempt((n) => n + 1)} style={styles.button} />
        ) : null}
        <PressableScale
          onPress={openWhatsApp}
          scaleTo={0.98}
          style={styles.helpRow}
          accessibilityRole="button"
          accessibilityLabel="Message us on WhatsApp for help with this link"
        >
          <Text style={styles.help}>Still stuck? Message us on WhatsApp</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.dark,
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
  },
  flame: {
    width: 46,
    height: 46,
    marginBottom: 6,
  },
  overline: {
    fontFamily: 'Poppins_400Regular',
    fontSize: type.overline,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: colors.goldWarm,
  },
  title: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: type.heading,
    lineHeight: 36,
    letterSpacing: -0.3,
    color: colors.white,
    textAlign: 'center',
  },
  body: {
    fontFamily: 'Poppins_400Regular',
    fontSize: type.body,
    lineHeight: 26,
    color: colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
    textAlign: 'center',
    maxWidth: 360,
    marginBottom: 6,
  },
  button: {
    minWidth: 200,
  },
  // 44 high so the secondary action is a real tap target, not just underlined
  // text. hitSlop would not help here: RNW's Pressable drops it.
  helpRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  help: {
    fontFamily: 'Poppins_400Regular',
    fontSize: type.label,
    lineHeight: 20,
    color: colors.goldWarm,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
