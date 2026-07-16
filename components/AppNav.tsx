import { Link, usePathname } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

const LINKS = [
  { href: '/', label: 'Showcase' },
  { href: '/rate', label: 'Rate Photos' },
  { href: '/kanban', label: 'Arrangements' },
] as const;

export default function AppNav() {
  const pathname = usePathname();

  return (
    <View style={styles.bar}>
      <Text style={styles.brand}>Afterlight</Text>
      <View style={styles.links}>
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link key={link.href} href={link.href} style={[styles.link, active && styles.linkActive]}>
              {link.label}
            </Link>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    backgroundColor: colors.dark,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  brand: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 17,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  links: {
    flexDirection: 'row',
    gap: 24,
  },
  link: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: colors.textFainter,
    textDecorationLine: 'none',
  },
  linkActive: {
    color: colors.white,
    fontFamily: 'Manrope_500Medium',
  },
});
