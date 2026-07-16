import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import PressableScale from './PressableScale';

const TABS = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/rate', label: 'Rate Photos', icon: '★' },
  { href: '/kanban', label: 'Arrangements', icon: '✓' },
] as const;

export default function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <PressableScale
            key={tab.href}
            style={styles.tab}
            onPress={() => router.push(tab.href)}
            scaleTo={0.92}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 22,
    paddingHorizontal: 12,
    backgroundColor: colors.dark,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    width: 40,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(228, 183, 120, 0.16)',
  },
  icon: {
    fontSize: 17,
    lineHeight: 20,
    color: colors.textFaintest,
  },
  iconActive: {
    color: colors.gold,
  },
  label: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 11,
    color: colors.textFaintest,
  },
  labelActive: {
    fontFamily: 'Manrope_500Medium',
    color: colors.gold,
  },
});
