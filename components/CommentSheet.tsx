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
import type { Photo } from '../lib/api';
import PressableScale from './PressableScale';

type CommentSheetProps = {
  photo: Photo | null;
  onClose: () => void;
  onSubmit: (photo: Photo, text: string) => void;
};

// Facebook-style comment thread as a slide-up sheet over the photo. The photo
// prop is looked up fresh from parent state each render, so optimistic
// comments appear the moment they're added.
export default function CommentSheet({ photo, onClose, onSubmit }: CommentSheetProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [draft, setDraft] = useState('');
  const visible = !!photo;

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: reduceMotion ? 0 : visible ? 260 : 200,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [visible, reduceMotion]);

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

  const comments = photo?.comments ?? [];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, style]}>
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
          comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <Text style={styles.author}>{c.author}</Text>
              <Text style={styles.text}>{c.text}</Text>
            </View>
          ))
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
        <PressableScale onPress={send} style={styles.sendButton} scaleTo={0.94}>
          <Text style={styles.sendText}>Post</Text>
        </PressableScale>
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
    backgroundColor: colors.darkWarm,
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
    fontFamily: 'Manrope_500Medium',
    fontSize: 18,
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
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: colors.textFainter,
    paddingVertical: 12,
  },
  comment: {
    gap: 3,
  },
  author: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: colors.goldWarm,
  },
  text: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    lineHeight: 21,
    color: colors.white,
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
    backgroundColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 16,
    color: colors.white,
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
  },
  sendButton: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.goldWarm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    color: colors.ink,
  },
});
