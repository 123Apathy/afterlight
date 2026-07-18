import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import PressableScale from '../components/PressableScale';
import { colors, images } from '../constants/theme';
import { fillName, tributeCopy, tributeQuestions } from '../constants/tribute';
import { api } from '../lib/api';
import { useActiveProject } from '../lib/useActiveProject';
import { useLocalStorage } from '../lib/useLocalStorage';

type Phase = 'intro' | 'questions' | 'thanks';

export default function TributeScreen() {
  const router = useRouter();
  const { projectId, projectName } = useActiveProject();
  const [rater, setRater] = useLocalStorage('afterlight.rater', '');
  const [nameDraft, setNameDraft] = useState('');
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => tributeQuestions.map(() => ''));

  const name = projectName;
  const questions = useMemo(() => tributeQuestions.map((q) => fillName(q, name)), [name]);
  const total = questions.length;

  const goHome = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const begin = () => {
    const who = (rater || nameDraft).trim();
    if (!who) return; // name required so answers are attributed
    if (!rater) setRater(who);
    setPhase('questions');
  };

  const setAnswer = (text: string) =>
    setAnswers((prev) => prev.map((a, i) => (i === index ? text : a)));

  const advance = () => {
    if (index < total - 1) {
      setIndex(index + 1);
    } else {
      finish();
    }
  };

  const finish = async () => {
    setPhase('thanks');
    const payload = questions
      .map((question, i) => ({ question, answer: answers[i].trim() }))
      .filter((qa) => qa.answer.length > 0);
    if (!projectId || payload.length === 0) return;
    try {
      await api.submitTribute(projectId, (rater || nameDraft).trim(), payload);
    } catch {
      if (typeof window !== 'undefined') {
        window.alert(
          "Your answers may not have saved. Please check your connection — you can reopen this and submit again."
        );
      }
    }
  };

  return (
    <View style={styles.page}>
      <Image source={images.landingSky} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(18, 14, 12, 0.94)', 'rgba(22, 17, 14, 0.86)', 'rgba(15, 12, 10, 0.96)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {phase === 'intro' && (
          <ScrollView contentContainerStyle={styles.scrollCenter}>
            <Text style={styles.overline}>{fillName(tributeCopy.overline, name).toUpperCase()}</Text>
            <Ornament />
            <Text style={styles.title}>{tributeCopy.introTitle}</Text>
            <Text style={styles.body}>{fillName(tributeCopy.introBody, name)}</Text>

            {!rater && (
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Your name"
                placeholderTextColor={colors.textFaintest}
                style={styles.nameInput}
              />
            )}

            <PressableScale style={styles.cta} onPress={begin} scaleTo={0.98}>
              <Text style={styles.ctaText}>{tributeCopy.introCta}</Text>
            </PressableScale>
            <Text style={styles.ctaSub}>{tributeCopy.introSub}</Text>

            <PressableScale style={styles.textLink} onPress={goHome} scaleTo={0.98}>
              <Text style={styles.textLinkLabel}>Not now</Text>
            </PressableScale>
          </ScrollView>
        )}

        {phase === 'questions' && (
          <View style={styles.qPage}>
            <View style={styles.progressWrap}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressText}>
                  {index + 1} of {total}
                </Text>
                <PressableScale onPress={goHome} hitSlop={10} scaleTo={0.95}>
                  <Text style={styles.progressClose}>Close</Text>
                </PressableScale>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${((index + 1) / total) * 100}%` }]} />
              </View>
            </View>

            <ScrollView
              contentContainerStyle={styles.qScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.question}>{questions[index]}</Text>

              <TextInput
                value={answers[index]}
                onChangeText={setAnswer}
                placeholder="Write as much or as little as you like…"
                placeholderTextColor={colors.textFaintest}
                style={styles.answerInput}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.qButtons}>
                <PressableScale style={styles.skipButton} onPress={advance} scaleTo={0.97}>
                  <Text style={styles.skipText}>Skip</Text>
                </PressableScale>
                <PressableScale style={styles.nextButton} onPress={advance} scaleTo={0.97}>
                  <Text style={styles.nextText}>{index < total - 1 ? 'Next' : 'Finish'}</Text>
                </PressableScale>
              </View>

              {index > 0 && (
                <PressableScale style={styles.textLink} onPress={() => setIndex(index - 1)} scaleTo={0.98}>
                  <Text style={styles.textLinkLabel}>Back</Text>
                </PressableScale>
              )}
            </ScrollView>
          </View>
        )}

        {phase === 'thanks' && (
          <ScrollView contentContainerStyle={styles.scrollCenter}>
            <Text style={styles.overline}>{fillName(tributeCopy.overline, name).toUpperCase()}</Text>
            <Ornament />
            <Text style={styles.title}>{tributeCopy.thanksTitle}</Text>
            <Text style={styles.body}>{fillName(tributeCopy.thanksBody, name)}</Text>
            <Text style={styles.signoff}>{tributeCopy.thanksSignoff}</Text>
            <PressableScale style={styles.cta} onPress={goHome} scaleTo={0.98}>
              <Text style={styles.ctaText}>Done</Text>
            </PressableScale>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function Ornament() {
  return (
    <View style={styles.ornament}>
      <View style={styles.ornamentLine} />
      <View style={styles.ornamentDot} />
      <View style={styles.ornamentLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.dark, overflow: 'hidden' },
  scrollCenter: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingVertical: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qPage: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 28,
  },
  progressWrap: {
    marginBottom: 8,
  },
  qScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  overline: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    letterSpacing: 4,
    color: colors.goldWarm,
    textAlign: 'center',
  },
  ornament: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: 200,
    marginVertical: 22,
  },
  ornamentLine: { flex: 1, height: 1, backgroundColor: 'rgba(212, 169, 118, 0.4)' },
  ornamentDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.goldWarm },
  title: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 40,
    letterSpacing: -0.4,
    color: colors.white,
    textAlign: 'center',
    marginBottom: 20,
  },
  body: {
    fontFamily: 'Poppins_300Light',
    fontSize: 16,
    lineHeight: 27,
    color: colors.textFaint,
    textAlign: 'center',
    maxWidth: 420,
  },
  nameInput: {
    width: '100%',
    maxWidth: 360,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(212, 169, 118, 0.25)',
    paddingHorizontal: 18,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    marginTop: 28,
  },
  cta: {
    width: '100%',
    maxWidth: 360,
    height: 54,
    borderRadius: 999,
    backgroundColor: colors.goldWarm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  ctaText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.ink,
  },
  ctaSub: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 16,
    color: colors.textFainter,
    marginTop: 16,
    textAlign: 'center',
  },
  textLink: {
    marginTop: 26,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textLinkLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: colors.textFainter,
    textDecorationLine: 'underline',
  },
  progressHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    letterSpacing: 0.5,
    color: colors.textFainter,
  },
  progressClose: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: colors.textFainter,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    marginBottom: 40,
  },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: colors.goldWarm },
  question: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 30,
    lineHeight: 40,
    letterSpacing: -0.2,
    color: colors.white,
    marginBottom: 28,
  },
  answerInput: {
    width: '100%',
    minHeight: 150,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(212, 169, 118, 0.22)',
    padding: 18,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  qButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  skipButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    color: colors.textFainter,
  },
  nextButton: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.goldWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 15,
    letterSpacing: 0.3,
    color: colors.ink,
  },
  signoff: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 24,
    color: colors.goldWarm,
    marginTop: 24,
    textAlign: 'center',
  },
});
