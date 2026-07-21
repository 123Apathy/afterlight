import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../constants/theme';
import { COMMENT_REACTION_EMOJI, reactionSummary, type Photo } from '../lib/api';
import { glassBlur, glassSurface } from '../lib/glass';
import PressableScale from './PressableScale';
import GoldButton from './GoldButton';

type CommentSheetProps = {
  photo: Photo | null;
  onClose: () => void;
  onSubmit: (photo: Photo, text: string) => void;
  onReact: (photo: Photo, commentId: string, emoji: string) => void;
  raterName: string;
};

// Facebook-style comment thread as a slide-up sheet over the photo. The photo
// prop is looked up fresh from parent state each render, so optimistic
// comments appear the moment they're added.
export default function CommentSheet({ photo, onClose, onSubmit, onReact, raterName }: CommentSheetProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [draft, setDraft] = useState('');
  // Which comment's emoji picker is open, Facebook/LinkedIn "Like" style --
  // tapping "React" reveals a small strip of options instead of showing all
  // five all the time; picking one closes it again.
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const visible = !!photo;

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: reduceMotion ? 0 : visible ? 260 : 200,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [visible, reduceMotion]);

  useEffect(() => {
    if (!visible) setPickerFor(null);
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 40 }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.6 }));

  const send = () => {
    const text = draft.trim();
    if (!text || !photo) return;
    onSubmit(photo, text);
    setDraft('');
  };

  const react = (commentId: string, emoji: string) => {
    if (photo) onReact(photo, commentId, emoji);
    setPickerFor(null);
  };

  const comments = photo?.comments ?? [];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, glassBlur, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Comments</Text>
        <PressableScale onPress={onClose} hitSlop={12} style={styles.close}>
          <View style={[styles.closeLine, { transform: [{ rotate: '45deg' }] }]} />
          <View style={[styles.closeLine, { transform: [{ rotate: '-45deg' }] }]} />
        </PressableScale>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {comments.length === 0 ? (
          <Text style={styles.empty}>No comments yet. Share a memory of this moment.</Text>
        ) : (
          comments.map((c) => {
            const summary = reactionSummary(c, raterName);
            const pickerOpen = pickerFor === c.id;
            return (
              <View key={c.id} style={styles.comment}>
                <Text style={styles.author}>{c.author}</Text>
                <Text style={styles.text}>{c.text}</Text>

                <View style={styles.reactionRow}>
                  {summary.map(({ emoji, count, mine }) => (
                    <PressableScale
                      key={emoji}
                      onPress={() => react(c.id, emoji)}
                      scaleTo={0.9}
                      style={[styles.reactionPill, mine && styles.reactionPillActive]}
                    >
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                      <Text style={[styles.reactionCount, mine && styles.reactionCountActive]}>{count}</Text>
                    </PressableScale>
                  ))}
                  <PressableScale onPress={() => setPickerFor(pickerOpen ? null : c.id)} hitSlop={6}>
                    <Text style={styles.reactLink}>React</Text>
                  </PressableScale>
                </View>

                {pickerOpen && (
                  <View style={[styles.picker, glassSurface, glassBlur]}>
                    {COMMENT_REACTION_EMOJI.map((emoji) => (
                      <PressableScale key={emoji} onPress={() => react(c.id, emoji)} scaleTo={0.82} hitSlop={4}>
                        <Text style={styles.pickerEmoji}>{emoji}</Text>
                      </PressableScale>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment…"
          placeholderTextColor={colors.textFaintest}
          style={styles.input}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <GoldButton label="Post" onPress={send} style={styles.sendButton} textStyle={styles.sendText} />
      </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '72%',
    backgroundColor: 'rgba(32, 26, 24, 0.52)',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    zIndex: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 20,
    color: colors.white,
  },
  close: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLine: {
    position: 'absolute',
    width: 18,
    height: 1.5,
    backgroundColor: colors.white,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: 16,
    paddingVertical: 8,
  },
  empty: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: colors.textFainter,
    paddingVertical: 12,
  },
  comment: {
    gap: 3,
  },
  author: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: colors.goldWarm,
  },
  text: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    lineHeight: 21,
    color: colors.white,
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  reactionPillActive: {
    backgroundColor: 'rgba(212,169,118,0.22)',
    borderColor: 'rgba(212,169,118,0.55)',
  },
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: colors.textFainter,
  },
  reactionCountActive: {
    color: colors.gold,
  },
  reactLink: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: colors.textFainter,
  },
  picker: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: 10,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pickerEmoji: {
    fontSize: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 16,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
  },
  sendButton: {
    height: 48,
    paddingHorizontal: 22,
  },
  sendText: {
    fontSize: 15,
  },
});
