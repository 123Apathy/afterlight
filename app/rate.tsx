import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import AppNav from '../components/AppNav';
import CommentModal from '../components/CommentModal';
import PressableScale from '../components/PressableScale';
import TierScrubber from '../components/TierScrubber';
import { colors } from '../constants/theme';
import { TIERS, tierForScore, tierIndexForScore } from '../constants/tiers';
import { api, photoUrl, type Photo } from '../lib/api';
import { useLocalStorage } from '../lib/useLocalStorage';

const CARD_WIDTH = 400;
const CARD_HEIGHT = 480;

export default function RatePhotosScreen() {
  const { width } = useWindowDimensions();
  const [raterName, setRaterName] = useLocalStorage('afterlight.rater', '');
  const [nameDraft, setNameDraft] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<'rate' | 'results'>('rate');
  const [pageIndex, setPageIndex] = useState(0);
  const [commentPhotoId, setCommentPhotoId] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const pageWidth = Math.min(CARD_WIDTH, width - 40) + 24;

  const refresh = async () => {
    const data = await api.getPhotos();
    setPhotos(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const currentPhoto = photos[pageIndex];
  const commentPhoto = photos.find((p) => p.id === commentPhotoId) || null;

  const myRating = (photo: Photo | undefined) =>
    photo?.ratings.find((r) => r.rater.toLowerCase() === raterName.toLowerCase())?.score ?? null;

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setPageIndex(Math.max(0, Math.min(photos.length - 1, index)));
  };

  const jumpTo = (index: number) => {
    setTab('rate');
    setPageIndex(index);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: index * pageWidth, animated: false });
    });
  };

  const handleTierChange = async (photo: Photo, tierIndex: number) => {
    const tier = TIERS[tierIndex];
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id !== photo.id) return p;
        const otherRatings = p.ratings.filter((r) => r.rater.toLowerCase() !== raterName.toLowerCase());
        const nextRatings = [
          ...otherRatings,
          { id: 'optimistic', photoId: p.id, rater: raterName, score: tier.score, createdAt: new Date().toISOString() },
        ];
        const avgRating = nextRatings.reduce((sum, r) => sum + r.score, 0) / nextRatings.length;
        return { ...p, ratings: nextRatings, avgRating, ratingCount: nextRatings.length };
      })
    );
    await api.ratePhoto(photo.id, raterName, tier.score);
  };

  const handleUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;
    setUploading(true);
    try {
      await api.uploadPhotos(
        result.assets.map((asset, i) => ({
          uri: asset.uri,
          name: asset.fileName || `photo-${Date.now()}-${i}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        }))
      );
      await refresh();
    } finally {
      setUploading(false);
    }
  };

  const handleAddComment = async (text: string) => {
    if (!commentPhoto) return;
    const comment = await api.addComment(commentPhoto.id, raterName || 'Anonymous', text);
    setPhotos((prev) =>
      prev.map((p) => (p.id === commentPhoto.id ? { ...p, comments: [...p.comments, comment] } : p))
    );
  };

  const sortedForResults = useMemo(
    () =>
      [...photos].sort((a, b) => {
        if (a.avgRating == null && b.avgRating == null) return 0;
        if (a.avgRating == null) return 1;
        if (b.avgRating == null) return -1;
        return b.avgRating - a.avgRating;
      }),
    [photos]
  );

  if (!raterName) {
    return (
      <View style={styles.page}>
        <AppNav />
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>Who&rsquo;s rating today?</Text>
          <Text style={styles.gateSubtitle}>
            Enter your name so everyone&rsquo;s ratings and comments are tracked separately.
          </Text>
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            placeholder="Your name"
            placeholderTextColor={colors.textFaintest}
            style={styles.gateInput}
            onSubmitEditing={() => setRaterName(nameDraft.trim())}
          />
          <PressableScale
            style={styles.gateButton}
            onPress={() => nameDraft.trim() && setRaterName(nameDraft.trim())}
            scaleTo={0.97}
          >
            <Text style={styles.gateButtonText}>Continue</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <AppNav />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.heading}>Rate Photos</Text>
            <Text style={styles.subheading}>Rating as {raterName}</Text>
          </View>
          <View style={styles.tabs}>
            <PressableScale
              style={[styles.tabButton, tab === 'rate' && styles.tabButtonActive]}
              onPress={() => setTab('rate')}
              scaleTo={0.97}
            >
              <Text style={[styles.tabText, tab === 'rate' && styles.tabTextActive]}>Swipe & Rate</Text>
            </PressableScale>
            <PressableScale
              style={[styles.tabButton, tab === 'results' && styles.tabButtonActive]}
              onPress={() => setTab('results')}
              scaleTo={0.97}
            >
              <Text style={[styles.tabText, tab === 'results' && styles.tabTextActive]}>Results</Text>
            </PressableScale>
          </View>
        </View>

        <PressableScale style={styles.uploadButton} onPress={handleUpload} scaleTo={0.97}>
          <Text style={styles.uploadButtonText}>{uploading ? 'Uploading...' : '+ Upload photos'}</Text>
        </PressableScale>

        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : photos.length === 0 ? (
          <Text style={styles.emptyText}>No photos yet — upload some to get started.</Text>
        ) : tab === 'rate' ? (
          <View style={styles.rateArea}>
            <View style={{ width: pageWidth * Math.min(photos.length, 1) || pageWidth }}>
              <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onScrollEnd}
                snapToInterval={pageWidth}
                decelerationRate="fast"
              >
                {photos.map((photo) => (
                  <View key={photo.id} style={[styles.pageSlot, { width: pageWidth }]}>
                    <View style={styles.card}>
                      <Image source={{ uri: photoUrl(photo) }} style={styles.cardImage} resizeMode="cover" />
                      <View style={styles.cardFooter}>
                        <Text style={styles.cardMeta}>
                          {photo.avgRating != null
                            ? `${tierForScore(photo.avgRating)?.key} avg · ${photo.ratingCount} rating${photo.ratingCount === 1 ? '' : 's'}`
                            : 'Not yet rated'}
                        </Text>
                        <PressableScale onPress={() => setCommentPhotoId(photo.id)} scaleTo={0.95}>
                          <Text style={styles.commentLink}>
                            {photo.comments.length > 0 ? `${photo.comments.length} comment${photo.comments.length === 1 ? '' : 's'}` : 'Add comment'}
                          </Text>
                        </PressableScale>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            {currentPhoto && (
              <TierScrubber
                tierIndex={tierIndexForScore(myRating(currentPhoto))}
                onChange={(index) => handleTierChange(currentPhoto, index)}
              />
            )}
          </View>
        ) : (
          <View style={styles.grid}>
            {sortedForResults.map((photo) => {
              const tier = tierForScore(photo.avgRating);
              return (
                <PressableScale
                  key={photo.id}
                  style={styles.gridItem}
                  onPress={() => jumpTo(photos.findIndex((p) => p.id === photo.id))}
                  scaleTo={0.97}
                >
                  <Image source={{ uri: photoUrl(photo) }} style={styles.gridImage} resizeMode="cover" />
                  {tier && (
                    <View style={[styles.gridBadge, { backgroundColor: tier.color }]}>
                      <Text style={styles.gridBadgeText}>{tier.key}</Text>
                    </View>
                  )}
                  {photo.comments.length > 0 && (
                    <View style={styles.gridCommentBadge}>
                      <Text style={styles.gridCommentText}>{photo.comments.length}</Text>
                    </View>
                  )}
                </PressableScale>
              );
            })}
          </View>
        )}
      </ScrollView>

      <CommentModal
        visible={!!commentPhoto}
        comments={commentPhoto?.comments || []}
        onClose={() => setCommentPhotoId(null)}
        onSubmit={handleAddComment}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  body: {
    padding: 32,
    gap: 24,
    alignItems: 'center',
  },
  topRow: {
    width: '100%',
    maxWidth: 900,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 16,
  },
  heading: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 28,
    color: colors.white,
  },
  subheading: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: colors.textFainter,
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.gold,
  },
  tabText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: colors.textFainter,
  },
  tabTextActive: {
    color: colors.ink,
  },
  uploadButton: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  uploadButtonText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: colors.gold,
  },
  emptyText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: colors.textFaintest,
    marginTop: 40,
  },
  rateArea: {
    flexDirection: 'row',
    gap: 32,
    alignItems: 'center',
  },
  pageSlot: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.dark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
  },
  cardImage: {
    width: '100%',
    height: CARD_HEIGHT - 56,
  },
  cardFooter: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  cardMeta: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: colors.textFainter,
  },
  commentLink: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: colors.gold,
  },
  grid: {
    width: '100%',
    maxWidth: 900,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gridItem: {
    width: 160,
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridBadgeText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: colors.ink,
  },
  gridCommentBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  gridCommentText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: colors.white,
  },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  gateTitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 28,
    color: colors.white,
    textAlign: 'center',
  },
  gateSubtitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: colors.textFainter,
    textAlign: 'center',
    maxWidth: 360,
  },
  gateInput: {
    width: 280,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    color: colors.white,
    fontFamily: 'Manrope_400Regular',
    fontSize: 16,
  },
  gateButton: {
    width: 280,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateButtonText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: colors.ink,
  },
});
