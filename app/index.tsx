import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import HamburgerButton from '../components/HamburgerButton';
import MenuOverlay from '../components/MenuOverlay';
import PressableScale from '../components/PressableScale';
import { colors, copy, images } from '../constants/theme';
import { api, heartCount, isFavoritedBy, photoUrl, type Photo } from '../lib/api';
import { useActiveProject } from '../lib/useActiveProject';
import { useLocalStorage } from '../lib/useLocalStorage';

const DOUBLE_TAP_MS = 280;

export default function SwipeScreen() {
  const { width, height } = useWindowDimensions();
  const { projectId, setProject } = useActiveProject();
  const [raterName, setRaterName] = useLocalStorage('afterlight.rater', '');
  const [nameDraft, setNameDraft] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);

  const refresh = async () => {
    if (!projectId) return;
    try {
      const data = await api.getPhotos(projectId);
      setPhotos(data);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [projectId]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const created = await api.createProject(newProjectName.trim());
      setProject(created);
      setNewProjectName('');
    } catch {
      if (typeof window !== 'undefined') {
        window.alert("Couldn't create the project. Check your connection and try again.");
      }
    } finally {
      setCreatingProject(false);
    }
  };

  const toggleFavorite = async (photo: Photo) => {
    const alreadyFavorited = isFavoritedBy(photo, raterName);
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id !== photo.id) return p;
        const nextRatings = alreadyFavorited
          ? p.ratings.filter((r) => r.rater.toLowerCase() !== raterName.toLowerCase())
          : [
              ...p.ratings,
              { id: 'optimistic', photoId: p.id, rater: raterName, score: 1, createdAt: new Date().toISOString() },
            ];
        return { ...p, ratings: nextRatings, ratingCount: nextRatings.length };
      })
    );
    try {
      if (alreadyFavorited) {
        await api.unfavoritePhoto(photo.id, raterName);
      } else {
        await api.favoritePhoto(photo.id, raterName);
      }
    } catch {
      if (typeof window !== 'undefined') {
        window.alert("That didn't save — check your connection and try again.");
      }
      refresh();
    }
  };

  const handleDoubleTap = (photo: Photo) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last && last.id === photo.id && now - last.time < DOUBLE_TAP_MS) {
      lastTapRef.current = null;
      // Double-tap always favorites (never un-favorites), matching the
      // Instagram gesture everyone already knows.
      if (!isFavoritedBy(photo, raterName)) toggleFavorite(photo);
    } else {
      lastTapRef.current = { id: photo.id, time: now };
    }
  };

  if (!projectId) {
    return (
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image source={images.logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.brandText}>Afterlight</Text>
          </View>
          <HamburgerButton onPress={() => setMenuOpen(true)} />
        </View>
        <View style={styles.gate}>
          <Text style={styles.gateTagline}>{copy.slogan}</Text>
          <Text style={styles.gateTitle}>Start a project</Text>
          <Text style={styles.gateSubtitle}>
            Create a project for the person you&rsquo;re honoring, or use an invite link someone shared with you.
          </Text>
          <TextInput
            value={newProjectName}
            onChangeText={setNewProjectName}
            placeholder="e.g. Brenda's tribute"
            placeholderTextColor={colors.textFaintest}
            style={styles.gateInput}
            onSubmitEditing={handleCreateProject}
          />
          <PressableScale style={styles.gateButton} onPress={handleCreateProject} scaleTo={0.97}>
            <Text style={styles.gateButtonText}>{creatingProject ? 'Creating...' : 'Create project'}</Text>
          </PressableScale>
        </View>
        <MenuOverlay
          visible={menuOpen}
          onClose={() => {
            setMenuOpen(false);
            refresh();
          }}
        />
      </View>
    );
  }

  if (!raterName) {
    return (
      <View style={styles.page}>
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>Who&rsquo;s browsing today?</Text>
          <Text style={styles.gateSubtitle}>
            Enter your name so everyone&rsquo;s favourites are tracked separately.
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
      {loading ? (
        <Text style={styles.emptyText}>Loading...</Text>
      ) : loadError ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Connection trouble</Text>
          <Text style={styles.emptySubtitle}>We couldn&rsquo;t load the photos. Check your internet and try again.</Text>
          <PressableScale
            style={styles.emptyButton}
            onPress={() => {
              setLoading(true);
              refresh();
            }}
            scaleTo={0.97}
          >
            <Text style={styles.emptyButtonText}>Try again</Text>
          </PressableScale>
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No photos yet</Text>
          <Text style={styles.emptySubtitle}>Open the menu to upload photos and start browsing together.</Text>
        </View>
      ) : (
        <PhotoDeck
          photos={photos}
          width={width}
          height={height}
          raterName={raterName}
          onToggleFavorite={toggleFavorite}
          onDoubleTap={handleDoubleTap}
        />
      )}

      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={images.logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandText}>Afterlight</Text>
        </View>
        <HamburgerButton onPress={() => setMenuOpen(true)} />
      </View>

      <MenuOverlay
        visible={menuOpen}
        onClose={() => {
          setMenuOpen(false);
          refresh();
        }}
      />
    </View>
  );
}

type PhotoDeckProps = {
  photos: Photo[];
  width: number;
  height: number;
  raterName: string;
  onToggleFavorite: (photo: Photo) => void;
  onDoubleTap: (photo: Photo) => void;
};

function PhotoDeck({ photos, width, height, raterName, onToggleFavorite, onDoubleTap }: PhotoDeckProps) {
  return (
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={StyleSheet.absoluteFill}>
      {photos.map((photo, index) => (
        <PhotoSlide
          key={photo.id}
          photo={photo}
          index={index}
          total={photos.length}
          width={width}
          height={height}
          raterName={raterName}
          onToggleFavorite={onToggleFavorite}
          onDoubleTap={onDoubleTap}
        />
      ))}
    </ScrollView>
  );
}

type PhotoSlideProps = {
  photo: Photo;
  index: number;
  total: number;
  width: number;
  height: number;
  raterName: string;
  onToggleFavorite: (photo: Photo) => void;
  onDoubleTap: (photo: Photo) => void;
};

function PhotoSlide({ photo, index, total, width, height, raterName, onToggleFavorite, onDoubleTap }: PhotoSlideProps) {
  const favorited = isFavoritedBy(photo, raterName);
  const count = heartCount(photo);
  const scale = useSharedValue(1);

  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handleHeartPress = () => {
    scale.value = withSequence(withSpring(1.3, { damping: 6 }), withSpring(1, { damping: 8 }));
    onToggleFavorite(photo);
  };

  return (
    <Pressable onPress={() => onDoubleTap(photo)} style={{ width, height }}>
      <Image source={{ uri: photoUrl(photo) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient colors={['rgba(0,0,0,0.5)', 'transparent']} style={styles.topScrim} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={styles.bottomScrim} pointerEvents="none" />

      <View style={styles.counter}>
        <Text style={styles.counterText}>
          {index + 1} / {total}
        </Text>
      </View>

      <View style={styles.heartRow}>
        <Text style={styles.heartCount}>{count > 0 ? `${count} favourite${count === 1 ? '' : 's'}` : 'Be the first to favourite'}</Text>
        <PressableScale onPress={handleHeartPress} scaleTo={0.85} hitSlop={12}>
          <Animated.Text style={[styles.heartIcon, favorited && styles.heartIconActive, heartStyle]}>
            {favorited ? '♥' : '♡'}
          </Animated.Text>
        </PressableScale>
      </View>
    </Pressable>
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
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 24,
  },
  gateTagline: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.gold,
    textAlign: 'center',
    marginBottom: 2,
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
    marginTop: 8,
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
  emptyText: {
    flex: 1,
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: colors.textFaintest,
    textAlign: 'center',
    textAlignVertical: 'center',
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
  emptyButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 26,
    backgroundColor: colors.gold,
  },
  emptyButtonText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    color: colors.ink,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  counter: {
    position: 'absolute',
    top: 24,
    alignSelf: 'center',
  },
  counterText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.8)',
  },
  heartRow: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 32,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heartCount: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
  },
  heartIcon: {
    fontSize: 44,
    lineHeight: 44,
    color: 'rgba(255,255,255,0.9)',
  },
  heartIconActive: {
    color: colors.gold,
  },
});
