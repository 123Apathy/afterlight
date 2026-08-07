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
import { LinearGradient } from 'expo-linear-gradient';
import PressableScale from '../components/PressableScale';
import GoldButton from '../components/GoldButton';
import BackdropVideo from '../components/BackdropVideo';
import { showToast } from '../components/Toast';
import { colors, type } from '../constants/theme';
import { fillName, tributeCopy, tributeQuestions } from '../constants/tribute';
import { api } from '../lib/api';
import { useActiveProject } from '../lib/useActiveProject';
import { useLocalStorage } from '../lib/useLocalStorage';

type Phase = 'intro' | 'questions' | 'thanks';

export default function TributeScreen() {
  const router = useRouter();
  const { projectId, projectName, activeEntry } = useActiveProject();
  const [rater, setRater] = useLocalStorage('everlit.rater', '');
  const [nameDraft, setNameDraft] = useState('');
  const [nameHint, setNameHint] = useState(false);
  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  // Answers live in localStorage (per memorial), not component state: 25
  // questions of someone's memories must survive a failed submit, a closed
  // tab, or a dead connection. Cleared only after the server confirms.
  const [draftRaw, setDraftRaw] = useLocalStorage(
    `everlit.tribute.draft.${projectId || 'unknown'}`,
    '[]'
  );
  const answers = useMemo<string[]>(() => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draftRaw);
    } catch {
      parsed = [];
    }
    const arr = Array.isArray(parsed) ? parsed : [];
    return tributeQuestions.map((_, i) => (typeof arr[i] === 'string' ? arr[i] : ''));
  }, [draftRaw]);

  const name = projectName;
  const questions = useMemo(() => tributeQuestions.map((q) => fillName(q, name)), [name]);
  const total = questions.length;

  const goHome = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const begin = () => {
    const who = (rater || nameDraft).trim();
    if (!who) {
      // Name required so answers are attributed; say so instead of a dead tap.
      setNameHint(true);
      return;
    }
    if (!rater) setRater(who);
    setPhase('questions');
  };

  const setAnswer = (text: string) =>
    setDraftRaw(JSON.stringify(answers.map((a, i) => (i === index ? text : a))));

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
      await api.submitTribute(projectId, (rater || nameDraft).trim(), payload, activeEntry?.memberId);
      // Confirmed on the server; only now is the local draft safe to clear.
      setDraftRaw('[]');
    } catch {
      showToast(
        "Your answers didn't reach us, but they're saved on this device. Check your connection, then open this again and tap Finish."
      );
    }
  };

  return (
    <View style={styles.page}>
      <BackdropVideo focusY="30%" />
      <LinearGradient
        colors={['rgba(18, 14, 12, 0.94)', 'rgba(20, 16, 14, 0.8)', 'rgba(20, 16, 14, 0.2)']}
        locations={[0, 0.55, 1]}
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
            <Text style={styles.overline}>{(name?.trim() ? fillName(tributeCopy.overline, name) : 'In loving memory').toUpperCase()}</Text>
            <Ornament />
            <Text style={styles.title}>{tributeCopy.introTitle}</Text>
            <Text style={styles.body}>{fillName(tributeCopy.introBody, name)}</Text>

            {!rater && (
              <TextInput
                value={nameDraft}
                onChangeText={(text) => {
                  setNameDraft(text);
                  if (nameHint) setNameHint(false);
                }}
                accessibilityLabel="Your name"
                placeholder="Your name"
                placeholderTextColor={colors.textFainter}
                style={styles.nameInput}
              />
            )}
            {nameHint && (
              <Text style={styles.nameHint}>
                Add your name first, so your memories are attributed to you.
              </Text>
            )}

            <GoldButton label={tributeCopy.introCta} onPress={begin} style={styles.cta} pill textStyle={styles.ctaText} />
            <Text style={styles.ctaSub}>{tributeCopy.introSub}</Text>

            <PressableScale
              style={styles.textLink}
              onPress={goHome}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel="Leave the tribute questions for now"
            >
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
                <PressableScale
                  onPress={goHome}
                  hitSlop={10}
                  scaleTo={0.95}
                  accessibilityRole="button"
                  accessibilityLabel={`Close, question ${index + 1} of ${total}`}
                  accessibilityHint="Your answers are saved on this device, so you can come back anytime."
                >
                  <Text style={styles.progressClose}>Close</Text>
                </PressableScale>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${((index + 1) / total) * 100}%` }]} />
              </View>
              <Text style={styles.progressSaveNote}>{tributeCopy.progressSaveNote}</Text>
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
                accessibilityLabel="Your answer"
                placeholder="Write as much or as little as you like…"
                placeholderTextColor={colors.textFainter}
                style={styles.answerInput}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.qButtons}>
                <PressableScale
                  style={styles.skipButton}
                  onPress={advance}
                  scaleTo={0.97}
                  accessibilityRole="button"
                  accessibilityLabel={`Skip question ${index + 1} of ${total}`}
                >
                  <Text style={styles.skipText}>Skip</Text>
                </PressableScale>
                <GoldButton
                  label={index < total - 1 ? 'Next' : 'Finish'}
                  onPress={advance}
                  style={styles.nextButton}
                />
              </View>

              {index > 0 && (
                <PressableScale
                  style={styles.textLink}
                  onPress={() => setIndex(index - 1)}
                  scaleTo={0.98}
                  accessibilityRole="button"
                  accessibilityLabel={`Back to question ${index} of ${total}`}
                >
                  <Text style={styles.textLinkLabel}>Back</Text>
                </PressableScale>
              )}
            </ScrollView>
          </View>
        )}

        {phase === 'thanks' && (
          <ScrollView contentContainerStyle={styles.scrollCenter}>
            <Text style={styles.overline}>{(name?.trim() ? fillName(tributeCopy.overline, name) : 'In loving memory').toUpperCase()}</Text>
            <Ornament />
            <Text style={styles.title}>{tributeCopy.thanksTitle}</Text>
            <Text style={styles.body}>{fillName(tributeCopy.thanksBody, name)}</Text>
            <Text style={styles.signoff}>{tributeCopy.thanksSignoff}</Text>
            <GoldButton label="Done" onPress={goHome} style={styles.cta} pill textStyle={styles.ctaText} />
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
    // Same 640 content cap the rest of the app uses; a 30px question line
    // running the full desktop width read as a wall of serif.
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
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
    letterSpacing: 3,
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
    fontSize: 36,
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
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 16,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    // 16, not 15: inputs under 16px make iOS Safari zoom the page in on
    // focus and never zoom back out. Every focusable input stays at 16+.
    fontSize: 16,
    marginTop: 28,
  },
  nameHint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: type.label,
    color: colors.goldWarm,
    marginTop: 12,
    textAlign: 'center',
    maxWidth: 360,
  },
  cta: {
    width: '100%',
    maxWidth: 360,
    marginTop: 32,
  },
  ctaText: {
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
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
    height: 44,
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
  // Matched to the deck's photo counter (app.tsx counterText). Both say the
  // same thing, "where am I in a sequence", and they were set in two different
  // faces at two different sizes, so the product spoke about position in two
  // voices depending on which screen you were on.
  progressText: {
    fontFamily: 'Courier New',
    fontSize: 17,
    letterSpacing: 1,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.75)',
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
    // The 40px that used to sit here now lives below the save note, so the
    // note reads as part of the progress block rather than floating.
    marginBottom: 10,
  },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: colors.goldWarm },
  progressSaveNote: {
    fontFamily: 'Poppins_400Regular',
    // type.label / textFainter, matching the gateTerms contrast fix rather than
    // the textFaintest the earlier a11y pass deliberately moved small copy off.
    fontSize: type.label,
    lineHeight: 18,
    color: colors.textFainter,
    marginBottom: 30,
  },
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
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 16,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    // 16+ like every focusable input: under 16 iOS Safari zooms in on focus
    // and stays zoomed (see nameInput above).
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
    fontSize: type.body,
    color: colors.textFainter,
  },
  nextButton: {
    flex: 2,
    height: 52,
  },
  signoff: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 24,
    color: colors.goldWarm,
    marginTop: 24,
    textAlign: 'center',
  },
});
