import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../constants/theme';
import type { Comment } from '../lib/api';
import PressableScale from './PressableScale';

type CommentModalProps = {
  visible: boolean;
  comments: Comment[];
  onSubmit: (text: string) => void;
  onClose: () => void;
};

export default function CommentModal({ visible, comments, onSubmit, onClose }: CommentModalProps) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    if (!draft.trim()) return;
    onSubmit(draft.trim());
    setDraft('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Comments</Text>
            <PressableScale onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <Text style={styles.closeText}>&times;</Text>
            </PressableScale>
          </View>

          <ScrollView style={styles.commentList} contentContainerStyle={{ gap: 12 }}>
            {comments.length === 0 && <Text style={styles.empty}>No comments yet.</Text>}
            {comments.map((comment) => (
              <View key={comment.id} style={styles.commentRow}>
                <Text style={styles.commentAuthor}>{comment.author}</Text>
                <Text style={styles.commentText}>{comment.text}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment about this photo..."
              placeholderTextColor={colors.textFaintest}
              style={styles.input}
              multiline
            />
            <PressableScale onPress={submit} style={styles.sendButton} scaleTo={0.95}>
              <Text style={styles.sendText}>Add</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '70%',
    backgroundColor: colors.dark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 18,
    color: colors.white,
  },
  closeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 22,
    color: colors.textFainter,
    lineHeight: 22,
  },
  commentList: {
    maxHeight: 220,
  },
  empty: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: colors.textFaintest,
  },
  commentRow: {
    gap: 2,
  },
  commentAuthor: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: colors.gold,
  },
  commentText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    lineHeight: 20,
    color: colors.textFaint,
  },
  composer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
  },
  sendButton: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    color: colors.ink,
  },
});
