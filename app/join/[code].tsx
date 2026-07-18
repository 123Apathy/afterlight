import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../constants/theme';
import { api } from '../../lib/api';
import { useActiveProject } from '../../lib/useActiveProject';

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { setProject } = useActiveProject();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    api
      .getProjectByInvite(code)
      .then((project) => {
        setProject(project);
        router.replace('/');
      })
      .catch(() => setError('This invite link is invalid or has expired.'));
  }, [code]);

  return (
    <View style={styles.page}>
      <Text style={styles.text}>{error || 'Joining project...'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  text: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: colors.textFainter,
    textAlign: 'center',
  },
});
