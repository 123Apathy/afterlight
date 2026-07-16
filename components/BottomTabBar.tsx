import { Link, usePathname } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

const TABS = [
  { href: '/', label: 'Home' },
  { href: '/rate', label: 'Rate Photos' },
  { href: '/kanban', label: 'Arrangements' },
] as const;

export default function BottomTabBar() {
  const pathname = usePathname();

  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link key={tab.href} href={tab.href} style={styles.tab}>
            <View style={styles.tabContent}>
              <View style={[styles.dot, active && styles.dotActive]} />
              <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
            </View>
          </Link>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: 64,
    paddingBottom: 8,
    backgroundColor: colors.dark,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  tab: {
    flex: 1,
    textDecorationLine: 'none',
  },
  tabContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'transparent',
  },
  dotActive: {
    backgroundColor: colors.gold,
  },
  label: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: colors.textFaintest,
  },
  labelActive: {
    fontFamily: 'Manrope_500Medium',
    color: colors.gold,
  },
});
