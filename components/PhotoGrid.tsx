import React, { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants/theme';
import { glassBlur } from '../lib/glass';
import { heartCount, photoThumbUrl, type Photo } from '../lib/api';
import PressableScale from './PressableScale';

type PhotoGridProps = {
  photos: Photo[];
  width: number;
  onSelect: (index: number) => void;
  // Open the comment thread for a photo (from the comments popup's action row).
  onOpenComments: (photo: Photo) => void;
};

const GAP = 2;

// Column count grows with the viewport so desktop gets a real wall of
// memories instead of three enormous cells.
function columnsFor(width: number) {
  if (width >= 1400) return 6;
  if (width >= 1000) return 5;
  if (width >= 700) return 4;
  return 3;
}

// The people who commented, each once, in first-seen order.
function uniqueAuthors(photo: Photo) {
  const seen: string[] = [];
  for (const c of photo.comments ?? []) {
    if (!seen.includes(c.author)) seen.push(c.author);
  }
  return seen;
}

// Small outline speech bubble, matching the deck's comment icon language.
function CommentGlyph() {
  if (Platform.OS === 'web') {
    return React.createElement(
      'svg',
      { width: 13, height: 11, viewBox: '0 0 30 26' },
      React.createElement('rect', {
        x: 3,
        y: 3,
        width: 24,
        height: 15,
        rx: 7.5,
        stroke: '#fff',
        strokeWidth: 2.6,
        fill: 'none',
      }),
      React.createElement('path', {
        d: 'M9 18 L7 24 L14 18',
        stroke: '#fff',
        strokeWidth: 2.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        fill: 'none',
      })
    );
  }
  return <View style={styles.glyphFallback} />;
}

type Popup = { type: 'likes' | 'comments'; photo: Photo } | null;

// Instagram-style overview: everyone's photos at a glance, tap one to open
// the swipe view at that exact photo. The heart and comment badges each open a
// small popup naming who loved or commented; the comments popup also offers a
// one-tap jump into the thread.
export default function PhotoGrid({ photos, width, onSelect, onOpenComments }: PhotoGridProps) {
  const columns = columnsFor(width);
  const cellSize = (width - GAP * (columns - 1)) / columns;
  const reduceMotion = useReducedMotion();
  const [popup, setPopup] = useState<Popup>(null);

  const names =
    popup?.type === 'likes'
      ? popup.photo.ratings.map((r) => r.rater)
      : popup
      ? uniqueAuthors(popup.photo)
      : [];

  return (
    <View style={StyleSheet.absoluteFill}>
      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {photos.map((photo, i) => {
            const count = heartCount(photo);
            const comments = photo.comments?.length ?? 0;
            return (
              <Animated.View
                key={photo.id}
                // Soft staggered entrance, wave restarting every 4 rows so a
                // long grid's tail doesn't wait seconds for its turn.
                entering={reduceMotion ? undefined : FadeIn.duration(320).delay((i % 12) * 35)}
                style={{ width: cellSize, height: cellSize }}
              >
                <PressableScale
                  onPress={() => onSelect(i)}
                  scaleTo={0.96}
                  style={{ width: '100%', height: '100%' }}
                >
                  <Image
                    source={photo.localSource ?? { uri: photoThumbUrl(photo) }}
                    style={styles.cellImage}
                    resizeMode="cover"
                  />
                </PressableScale>
                {(count > 0 || comments > 0) && (
                  <View style={styles.badgeRow} pointerEvents="box-none">
                    {count > 0 && (
                      <Pressable
                        style={styles.badge}
                        onPress={() => setPopup({ type: 'likes', photo })}
                        hitSlop={8}
                      >
                        <Text style={styles.heart}>♥</Text>
                        <Text style={styles.badgeText}>{count}</Text>
                      </Pressable>
                    )}
                    {comments > 0 && (
                      <Pressable
                        style={styles.badge}
                        onPress={() => setPopup({ type: 'comments', photo })}
                        hitSlop={8}
                      >
                        <CommentGlyph />
                        <Text style={styles.badgeText}>{comments}</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </Animated.View>
            );
          })}
        </View>

        {/* Footer: a quiet sign-off closing the wall of photos. */}
        <View style={styles.footer}>
          <LinearGradient
            colors={['rgba(196,154,108,0)', 'rgba(212,169,118,0.9)', 'rgba(196,154,108,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.footerStreak}
          />
          <Text style={styles.footerBrand}>Everlit</Text>
          <Text style={styles.footerLine}>Every photo here was chosen with love.</Text>
          <Text style={styles.footerMeta}>
            {photos.length} {photos.length === 1 ? 'memory' : 'memories'} shared
          </Text>
        </View>
      </ScrollView>

      {/* Tapping a badge names who loved or commented; the comments popup adds a
          row that opens the full thread. Tap the dim scrim to dismiss. */}
      {popup && (
        <Pressable style={styles.scrim} onPress={() => setPopup(null)}>
          <Pressable style={[styles.popup, glassBlur]} onPress={() => {}}>
            <Text style={styles.popupTitle}>
              {popup.type === 'likes' ? 'Loved by' : 'Comments from'}
            </Text>
            <ScrollView style={styles.popupList} showsVerticalScrollIndicator={false}>
              {names.length === 0 ? (
                <Text style={styles.popupEmpty}>Nobody yet.</Text>
              ) : (
                names.map((name, idx) => (
                  <View key={idx} style={styles.row}>
                    <Text style={styles.rowName}>{name}</Text>
                  </View>
                ))
              )}
            </ScrollView>
            {popup.type === 'comments' && (
              <PressableScale
                style={[styles.row, styles.rowAction]}
                scaleTo={0.97}
                onPress={() => {
                  const p = popup.photo;
                  setPopup(null);
                  onOpenComments(p);
                }}
              >
                <Text style={styles.rowActionText}>Open comments</Text>
                <Text style={styles.rowActionChevron}>›</Text>
              </PressableScale>
            )}
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 84,
    paddingBottom: 32,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cellImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.ink,
  },
  badgeRow: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 14, 12, 0.6)',
  },
  heart: {
    color: colors.heart ?? '#F26D7D',
    fontSize: 12.5,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12.5,
    fontFamily: 'Poppins_500Medium',
  },
  glyphFallback: {
    width: 11,
    height: 9,
    borderRadius: 3,
    borderWidth: 1.4,
    borderColor: '#fff',
  },
  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 16,
    gap: 10,
  },
  footerStreak: {
    width: 150,
    height: 1.5,
    borderRadius: 1,
    marginBottom: 6,
  },
  footerBrand: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    letterSpacing: 0.3,
    color: colors.white,
  },
  footerLine: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: colors.textFainter,
    textAlign: 'center',
  },
  footerMeta: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(212, 169, 118, 0.55)',
  },
  // Popup
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 8, 7, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  popup: {
    width: '100%',
    maxWidth: 260,
    maxHeight: 320,
    backgroundColor: 'rgba(28, 22, 20, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  popupTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    color: colors.white,
    textDecorationLine: 'underline',
    textDecorationColor: colors.goldWarm,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  popupList: {
    flexGrow: 0,
  },
  popupEmpty: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: colors.textFainter,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: 38,
    borderRadius: 10,
  },
  rowName: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  rowAction: {
    marginTop: 6,
    backgroundColor: 'rgba(212, 169, 118, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212, 169, 118, 0.3)',
  },
  rowActionText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: colors.goldWarm,
  },
  rowActionChevron: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    color: colors.goldWarm,
    marginTop: -2,
  },
});
