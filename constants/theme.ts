// Mobile-first: on wide screens the app renders inside a centered frame of this
// width instead of stretching across the whole window.
export const APP_MAX_WIDTH = 460;

export const colors = {
  dark: 'rgb(25, 20, 19)',
  darkWarm: 'rgb(32, 26, 24)',
  darkWarmLight: 'rgb(42, 35, 33)',
  gold: '#D4A976',
  goldWarm: '#C49A6C',
  goldDeep: '#A6794A',
  heart: '#E8536B',
  comment: '#4FCE7E',
  white: '#FFFFFF',
  cream: '#F5F0EB',
  textFaint: 'rgba(255, 255, 255, 0.77)',
  textFainter: 'rgba(255, 255, 255, 0.6)',
  textFaintest: 'rgba(255, 255, 255, 0.48)',
  ink: '#1A1613',
  glassLight: 'rgba(255, 255, 255, 0.08)',
  glassMedium: 'rgba(255, 255, 255, 0.12)',
  glassStrong: 'rgba(255, 255, 255, 0.16)',
  accent: 'rgba(212, 169, 118, 0.4)',
};

export const images = {
  // The Everlit horizon mark (transparent PNG, from brand/logo.html).
  logo: require('../assets/images/logo-mark.png'),
  // Same mark, recolored brand gold (alpha-preserving recolor of logo-mark.png)
  // -- used where the mark sits on its own rather than beside white wordmark
  // text, so it doesn't fight for attention with the gold nav arrows.
  logoGold: require('../assets/images/logo-mark-gold.png'),
  // Landing backdrop: golden-hour glow through cloud (Pexels #29150580,
  // free/commercial, no attribution required). The "afterglow" the name means.
  landingSky: require('../assets/images/landing-sky.jpg'),
  // Full brand lockup (icon + wordmark + "Memorial Films"), transparent.
  lockup: require('../assets/images/lockup.png'),
};

export const copy = {
  slogan: 'A memory you can hold.',
  landing: {
    title: "We're sorry for your loss.",
    subtitle: "Everlit gathers photos from everyone who knew them, a digital space where their life can be honored, one favorite at a time. Not a eulogy. Just the moments that mattered.",
  },
};
