import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../constants/theme';
import { DEMO } from '../constants/demo';
import { API_BASE, api, inviteUrl, type Project } from '../lib/api';
import { useActiveProject } from '../lib/useActiveProject';
import PressableScale from './PressableScale';

type MenuOverlayProps = {
  visible: boolean;
  onClose: () => void;
};

export default function MenuOverlay({ visible, onClose }: MenuOverlayProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const { projectId, projectName, setProject, clearProject } = useActiveProject();
  const [project, setProjectDetails] = useState<Project | null>(null);
  const [copied, setCopied] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const duration = reduceMotion ? 0 : visible ? 220 : 180;
    progress.value = withTiming(visible ? 1 : 0, {
      duration,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [visible, reduceMotion]);

  useEffect(() => {
    if (visible && projectId) {
      api.getProject(projectId).then(setProjectDetails).catch(() => setProjectDetails(null));
    }
  }, [visible, projectId]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
    pointerEvents: visible ? 'auto' : 'none',
  }));

  const handleShare = async () => {
    if (!project) {
      if (typeof window !== 'undefined') {
        window.alert("Couldn't load the invite link. Check your connection, then close and reopen the menu.");
      }
      return;
    }
    const url = inviteUrl(project);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // navigator.clipboard needs a secure origin — fall back to a copyable prompt.
      if (typeof window !== 'undefined') {
        window.prompt('Copy this invite link:', url);
      }
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setCreatingProject(false);
      return;
    }
    try {
      const created = await api.createProject(newProjectName.trim());
      setProject(created);
      setProjectDetails(created);
      setNewProjectName('');
      setCreatingProject(false);
    } catch {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert("Couldn't create the project. Check your connection and try again.");
      }
    }
  };

  const handleUpload = async () => {
    if (!projectId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;
    setUploading(true);
    try {
      await api.uploadPhotos(
        projectId,
        result.assets.map((asset, i) => ({
          uri: asset.uri,
          name: asset.fileName || `photo-${Date.now()}-${i}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        }))
      );
    } catch {
      if (typeof window !== 'undefined') {
        window.alert('Upload failed — those photos were NOT saved. Check your connection and try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadReport = () => {
    if (!project) {
      if (typeof window !== 'undefined') {
        window.alert("Couldn't load the report link. Check your connection, then close and reopen the menu.");
      }
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(`${API_BASE}/api/report/${project.inviteCode}`, '_blank');
    }
  };

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <PressableScale onPress={onClose} hitSlop={12} style={styles.closeButton}>
          <View style={[styles.closeLine, { transform: [{ rotate: '45deg' }] }]} />
          <View style={[styles.closeLine, { transform: [{ rotate: '-45deg' }] }]} />
        </PressableScale>
      </View>

      {DEMO && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PREVIEW BUILD</Text>
          <Text style={styles.demoNote}>
            You&rsquo;re browsing a local preview with sample photos. Favourites and comments
            you add here stay on this device. Uploading, invites, and the results report need
            the live server, which isn&rsquo;t part of this preview.
          </Text>
        </View>
      )}

      {!DEMO && (
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>PROJECT</Text>
        <Text style={styles.raterName}>{projectName || 'No project selected'}</Text>

        {creatingProject ? (
          <View style={styles.inlineForm}>
            <TextInput
              value={newProjectName}
              onChangeText={setNewProjectName}
              placeholder="Project name..."
              placeholderTextColor={colors.textFaintest}
              style={styles.input}
              autoFocus
              onSubmitEditing={handleCreateProject}
            />
            <View style={styles.inlineFormButtons}>
              <PressableScale
                onPress={() => {
                  setCreatingProject(false);
                  setNewProjectName('');
                }}
                style={styles.rowButtonSecondary}
                scaleTo={0.97}
              >
                <Text style={styles.rowButtonSecondaryText}>Cancel</Text>
              </PressableScale>
              <PressableScale onPress={handleCreateProject} style={styles.rowButtonHalf} scaleTo={0.97}>
                <Text style={styles.rowButtonText}>Create</Text>
              </PressableScale>
            </View>
          </View>
        ) : (
          <PressableScale style={styles.rowButton} onPress={() => setCreatingProject(true)} scaleTo={0.97}>
            <Text style={styles.rowButtonText}>+ New project</Text>
          </PressableScale>
        )}

        {!!projectId && (
          <PressableScale style={styles.rowButton} onPress={clearProject} scaleTo={0.97}>
            <Text style={styles.rowButtonText}>Leave this project</Text>
          </PressableScale>
        )}
      </View>
      )}

      {!DEMO && !!projectId && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PHOTOS</Text>
          <PressableScale style={styles.rowButton} onPress={handleUpload} scaleTo={0.97}>
            <Text style={styles.rowButtonText}>{uploading ? 'Uploading...' : '+ Upload photos'}</Text>
          </PressableScale>
        </View>
      )}

      {!!projectId && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>INVITE</Text>
          <PressableScale style={styles.rowButton} onPress={handleShare} scaleTo={0.97}>
            <Text style={styles.rowButtonText}>{copied ? 'Link copied!' : 'Copy invite link'}</Text>
          </PressableScale>
        </View>
      )}

      {!!projectId && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RESULTS</Text>
          <PressableScale style={styles.rowButton} onPress={handleDownloadReport} scaleTo={0.97}>
            <Text style={styles.rowButtonText}>Open results report</Text>
          </PressableScale>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>BILLING</Text>
        <View style={styles.rowButtonDisabled}>
          <Text style={styles.rowButtonDisabledText}>Coming soon</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.dark,
    zIndex: 100,
    paddingTop: 48,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 20,
    color: colors.white,
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLine: {
    position: 'absolute',
    width: 20,
    height: 1.5,
    backgroundColor: colors.white,
  },
  section: {
    marginTop: 32,
    gap: 10,
  },
  sectionLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textFaintest,
  },
  raterName: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 22,
    color: colors.white,
    marginBottom: 4,
  },
  demoNote: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: colors.textFainter,
  },
  rowButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowButtonHalf: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowButtonText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    color: colors.gold,
  },
  rowButtonSecondary: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowButtonSecondaryText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: colors.textFainter,
  },
  rowButtonDisabled: {
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowButtonDisabledText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: colors.textFaintest,
  },
  inlineForm: {
    gap: 8,
  },
  input: {
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    color: colors.white,
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
  },
  inlineFormButtons: {
    flexDirection: 'row',
    gap: 8,
  },
});
