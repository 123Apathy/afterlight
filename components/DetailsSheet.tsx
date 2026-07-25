import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { hasReadableYear } from '../constants/photo-date';
import { colors } from '../constants/theme';
import { type Photo } from '../lib/api';
import { glassBlur } from '../lib/glass';
import PressableScale from './PressableScale';
import GoldButton from './GoldButton';

type DetailsSheetProps = {
  photo: Photo | null;
  onClose: () => void;
  onSave: (photo: Photo, details: { photoDate: string; location: string }) => void;
  // Close after saving only the first time for this photo; after that the
  // sheet stays open so people can keep refining.
  autoCloseOnSave?: boolean;
};

// Slide-up sheet (same glass language as CommentSheet) with two free-text
// fields — when the photo was taken and where. Both optional. "When" is text,
// not a date picker, because most people only remember the year.
export default function DetailsSheet({ photo, onClose, onSave, autoCloseOnSave = true }: DetailsSheetProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [photoDate, setPhotoDate] = useState('');
  const [location, setLocation] = useState('');
  // The "we couldn't spot a year" nudge waits for blur. Judging mid-keystroke
  // means it appears the moment someone types "19" and vanishes at "1998",
  // which reads as the app arguing with you while you type.
  const [dateBlurred, setDateBlurred] = useState(false);
  const visible = !!photo;
  const dateUnreadable = dateBlurred && !!photoDate.trim() && !hasReadableYear(photoDate);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: reduceMotion ? 0 : visible ? 260 : 200,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [visible, reduceMotion]);

  // Re-seed the fields whenever a (different) photo opens the sheet, so it
  // shows whatever's already saved instead of a stale draft.
  useEffect(() => {
    if (photo) {
      setPhotoDate(photo.photoDate ?? '');
      setLocation(photo.location ?? '');
      setDateBlurred(false);
    }
  }, [photo?.id]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 40 }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.6 }));

  const save = () => {
    if (!photo) return;
    onSave(photo, { photoDate: photoDate.trim(), location: location.trim() });
    // Close on the first save for this photo; after that stay open for edits.
    if (autoCloseOnSave) onClose();
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, glassBlur, style]}>
        <View style={styles.header}>
          <Text style={styles.title}>Photo details</Text>
          <PressableScale onPress={onClose} hitSlop={12} style={styles.close}>
            <View style={[styles.closeLine, { transform: [{ rotate: '45deg' }] }]} />
            <View style={[styles.closeLine, { transform: [{ rotate: '-45deg' }] }]} />
            <Text style={styles.closeText}>Close</Text>
          </PressableScale>
        </View>

        <Text style={styles.blurb}>
          Anything you remember helps. It brings the story into focus and helps us place the
          photos in the right order.
        </Text>

        <Text style={styles.label}>When was this taken?</Text>
        <TextInput
          value={photoDate}
          onChangeText={setPhotoDate}
          accessibilityLabel="When was this taken"
          placeholder="Even just the year, like 1998"
          placeholderTextColor={colors.textFainter}
          style={[styles.input, dateUnreadable && styles.inputWithHint]}
          returnKeyType="next"
          onFocus={() => setDateBlurred(false)}
          onBlur={() => setDateBlurred(true)}
        />
        {dateUnreadable && (
          <Text style={styles.hint} accessibilityLiveRegion="polite">
            We could not spot a year in that. Add one if you can, even roughly, so this photo sits in
            the right place in their story.
          </Text>
        )}

        <Text style={styles.label}>Where was this?</Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          accessibilityLabel="Where was this"
          placeholder="A place, town, or home"
          placeholderTextColor={colors.textFainter}
          style={styles.input}
          onSubmitEditing={save}
          returnKeyType="done"
        />

        <GoldButton label="Save details" onPress={save} style={styles.saveButton} textStyle={styles.saveText} />
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
    // Floats up so its bottom edge is level with the deck's arrow buttons
    // (navRowUp bottom = 92); a proper rounded/bordered card, matching
    // CommentSheet.
    bottom: 92,
    maxWidth: 640,
    marginHorizontal: 'auto',
    backgroundColor: 'rgba(32, 26, 24, 0.52)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
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
    textDecorationLine: 'underline',
    textDecorationColor: colors.goldWarm,
  },
  close: {
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
  blurb: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: colors.textFainter,
    marginBottom: 18,
  },
  label: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: colors.goldWarm,
    marginBottom: 7,
  },
  input: {
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 16,
    color: colors.white,
    fontFamily: 'Poppins_400Regular',
    fontSize: 15,
    marginBottom: 18,
  },
  // The hint sits in the gap the input's own margin would have left, so nothing
  // below it shifts when the nudge appears.
  inputWithHint: {
    marginBottom: 8,
  },
  hint: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.goldWarm,
    marginBottom: 16,
  },
  saveButton: {
    height: 50,
    marginTop: 2,
  },
  saveText: {
    fontSize: 16,
  },
});
