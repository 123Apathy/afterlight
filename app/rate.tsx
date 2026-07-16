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
import BottomTabBar from '../components/BottomTabBar';
import CommentModal from '../components/CommentModal';
import PressableScale from '../components/PressableScale';
import TierScrubber from '../components/TierScrubber';
import { colors, images } from '../constants/theme';
import { TIERS, tierForScore, tierIndexForScore } from '../constants/tiers';
import { api, photoUrl, type Photo } from '../lib/api';
import { useLocalStorage } from '../lib/useLocalStorage';

const TAB_BAR_HEIGHT = 64;

export default function RatePhotosScreen() {
  const { width, height } = useWindowDimensions();
  const [raterName, setRaterName] = useLocalStorage('afterlight.rater', '');
  const [nameDraft, setNameDraft] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState<'rate' | 'results'>('rate');
  const [pageIndex, setPageIndex] = useState(0);
  const [commentPhotoId, setCommentPhotoId] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const availableHeight = height - TAB_BAR_HEIGHT;
  const heroHeight = Math.min(480, Math.max(320, availableHeight * 0.58));

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
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setPageIndex(Math.max(0, Math.min(photos.length - 1, index)));
  };

  const jumpTo = (index: number) => {
    setView('rate');
    setPageIndex(index);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: index * width, animated: false });
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
        <BottomTabBar />
      </View>
    );
  }

  const myTier = currentPhoto ? tierForScore(myRating(currentPhoto)) : null;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={{ uri: images.logo }} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandText}>Afterlight</Text>
        </View>
        <View style={styles.headerActions}>
          <PressableScale style={styles.headerPill} onPress={handleUpload} scaleTo={0.95}>
            <Text style={styles.headerPillText}>{uploading ? '...' : '+ Upload'}</Text>
          </PressableScale>
          <PressableScale
            style={styles.headerPill}
            onPress={() => setView(view === 'rate' ? 'results' : 'rate')}
            scaleTo={0.95}
          >
            <Text style={styles.headerPillText}>{view === 'rate' ? 'Results' : 'Rate'}</Text>
          </PressableScale>
        </View>
      </View>

      {loading ? (
        <Text style={styles.emptyText}>Loading...</Text>
      ) : photos.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.emptySubtitle}>Upload photos to start rating them together.</Text>
          <PressableScale style={styles.emptyUploadButton} onPress={handleUpload} scaleTo={0.97}>
            <Text style={styles.emptyUploadText}>{uploading ? 'Uploading...' : '+ Upload photos'}</Text>
          </PressableScale>
        </View>
      ) : view === 'rate' ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
        >
          {photos.map((photo) => {
            const tier = tierForScore(photo.avgRating);
            const myScore = myRating(photo);
            return (
              <View key={photo.id} style={{ width }}>
                <View style={[styles.heroWrap, { height: heroHeight }]}>
                  <Image source={{ uri: photoUrl(photo) }} style={styles.hero} resizeMode="cover" />
                  <View style={styles.heroOverlay} />
                  <View style={styles.scrubberOverlay}>
                    <TierScrubber
                      tierIndex={tierIndexForScore(myScore)}
                      onChange={(index) => handleTierChange(photo, index)}
                    />
                  </View>
                </View>

                <View style={[styles.content, { height: availableHeight - heroHeight }]}>
                  <Text style={styles.tierHeadline}>
                    {myScore != null
                      ? `You rated this ${tierForScore(myScore)?.key}`
                      : 'Drag the scrubber to rate'}
                  </Text>
                  <Text style={styles.tierSubtext}>
                    {tier != null
                      ? `${tier.key} average · ${photo.ratingCount} rating${photo.ratingCount === 1 ? '' : 's'}`
                      : 'Not yet rated by anyone'}
                  </Text>

                  <PressableScale
                    style={styles.commentCta}
                    onPress={() => setCommentPhotoId(photo.id)}
                    scaleTo={0.97}
                  >
                    <Text style={styles.commentCtaText}>
                      {photo.comments.length > 0
                        ? `${photo.comments.length} comment${photo.comments.length === 1 ? '' : 's'}`
                        : 'Add a comment'}
                    </Text>
                    <Text style={styles.commentCtaArrow}>&rarr;</Text>
                  </PressableScale>
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
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
        </ScrollView>
      )}

      <CommentModal
        visible={!!commentPhoto}
        comments={commentPhoto?.comments || []}
        onClose={() => setCommentPhotoId(null)}
        onSubmit={handleAddComment}
      />

      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 19,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 7,
  },
  brandText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: colors.white,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  headerPillText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: colors.white,
  },
  emptyText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: colors.textFaintest,
    marginTop: 100,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 22,
    color: colors.white,
  },
  emptySubtitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: colors.textFainter,
    textAlign: 'center',
  },
  emptyUploadButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 26,
    backgroundColor: colors.gold,
  },
  emptyUploadText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    color: colors.ink,
  },
  heroWrap: {
    width: '100%',
  },
  hero: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  scrubberOverlay: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  content: {
    paddingTop: 24,
    paddingHorizontal: 19,
  },
  tierHeadline: {
    fontFamily: 'Manrope_300Light',
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1,
    color: colors.gold,
  },
  tierSubtext: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 16,
    lineHeight: 22,
    color: colors.textFainter,
    marginTop: 10,
  },
  commentCta: {
    marginTop: 24,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  commentCtaText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 17,
    color: colors.ink,
  },
  commentCtaArrow: {
    fontSize: 16,
    color: colors.ink,
  },
  grid: {
    paddingTop: 84,
    paddingHorizontal: 19,
    paddingBottom: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridBadgeText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: colors.ink,
  },
  gridCommentBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  gridCommentText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: colors.white,
  },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  gateTitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 26,
    color: colors.white,
    textAlign: 'center',
  },
  gateSubtitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: colors.textFainter,
    textAlign: 'center',
    maxWidth: 320,
  },
  gateInput: {
    width: '100%',
    maxWidth: 320,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    color: colors.white,
    fontFamily: 'Manrope_400Regular',
    fontSize: 16,
  },
  gateButton: {
    width: '100%',
    maxWidth: 320,
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
