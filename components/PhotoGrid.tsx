import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { colors } from '../constants/theme';
import { heartCount, photoUrl, type Photo } from '../lib/api';
import PressableScale from './PressableScale';

type PhotoGridProps = {
  photos: Photo[];
  width: number;
  onSelect: (index: number) => void;
};

const COLUMNS = 3;
const GAP = 2;

// Instagram-style overview: everyone's photos at a glance, tap one to open
// the swipe view at that exact photo.
export default function PhotoGrid({ photos, width, onSelect }: PhotoGridProps) {
  const cellSize = (width - GAP * (COLUMNS - 1)) / COLUMNS;
  const reduceMotion = useReducedMotion();

  return (
    <ScrollView
      style={StyleSheet.absoluteFill}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.grid}>
        {photos.map((photo, i) => {
          const count = heartCount(photo);
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
                  source={photo.localSource ?? { uri: photoUrl(photo) }}
                  style={styles.cellImage}
                  resizeMode="cover"
                />
                {count > 0 && (
                  <View style={styles.heartBadge}>
                    <Text style={styles.heartBadgeText}>♥ {count}</Text>
                  </View>
                )}
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
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
  heartBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 14, 12, 0.55)',
  },
  heartBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
});
