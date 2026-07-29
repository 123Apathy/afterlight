// The app fills the browser at every size. The earlier "portrait device card"
// treatment (letterboxed ~560px column on desktop) was reverted by request —
// on a PC the swipe screen should be a full-bleed desktop experience, not a
// phone simulator. stageWidth is kept as the single width source both
// app/_layout and app/app read, so any future cap goes in ONE place.
export function stageWidth(viewportWidth: number, _viewportHeight: number): number {
  return viewportWidth;
}

// Interactive controls still cluster in a comfortable centered band on wide
// screens (a heart 1400px away from its comment button is not a UI).
export const CONTROLS_BAND_MAX = 680;

// How far the deck's control row sits above the bottom of the screen, BEFORE
// the device's own safe-area inset is added. It was 26, but the row's labels
// are positioned below the row itself, so the visible content ended 1px off the
// bottom edge: on any phone with a home indicator or gesture bar, "Comment" and
// "Favourites" were underneath it. 46 gives the labels real clearance even on a
// device reporting no inset at all.
export const CONTROLS_BOTTOM = 46;

// Spreadable absolute-fill. RN 0.86 removed StyleSheet.absoluteFillObject
// (native would silently spread undefined), and react-native-web's
// StyleSheet.absoluteFill is a compiled style ($$css), not a plain object,
// so neither built-in can be spread on both platforms.
export const absoluteFill = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as const;

export const colors = {
  dark: 'rgb(25, 20, 19)',
  darkWarm: 'rgb(32, 26, 24)',
  darkWarmLight: 'rgb(42, 35, 33)',
  gold: '#D4A976',
  goldWarm: '#C49A6C',
  goldDeep: '#A6794A',
  heart: '#E8536B',
  comment: '#4FCE7E',
  detail: '#5AA9F0',
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

// ── Type scale ───────────────────────────────────────────────────────────────
// DESIGN.md said tokens live in this file, but until 2026-07-28 only colour
// actually did: all ~152 font sizes were magic numbers spread across individual
// StyleSheets (24 separate declarations of 13, 23 of 15), so nothing could be
// adjusted centrally and the app had no scale, only a habit.
//
// The floor is deliberate. Everlit's readers are usually elderly, usually on a
// phone, often minutes after a funeral and often crying. 16 is the smallest
// size anything they must READ as a sentence may be. Below 16 is reserved for
// glanceable meta, where meaning is carried by position, icon and colour and
// the digits are only a confirmation: a count inside a badge, an uppercase
// eyebrow above a heading. If a value has to be understood on its own, it does
// not belong under `body`.
//
// These are plain numbers, not fluid sizes, on purpose. react-native-web emits
// StyleSheet font sizes as fixed px and will not accept a CSS clamp(), so the
// landing page (real CSS) is where fluid type belongs, and does use clamp().
// The app is phone-first by design and renders the same layout full width on
// desktop, so the honest fix here is a correct fixed scale rather than a fake
// responsive one. Migration is deliberately partial: the measured offenders on
// the most-read screens are on the scale, the long tail is not yet.
export const type = {
  badge: 12, // counts inside a pill or circle. Never prose.
  overline: 11, // uppercase, letter-spaced section eyebrows. DESIGN.md says 11.
  label: 14, // a short word captioning an icon control.
  body: 16, // the floor for anything read as a sentence.
  action: 17, // buttons and primary links.
  title: 22,
  heading: 28,
  display: 34,
} as const;

export const images = {
  // The Everlit horizon mark (transparent PNG, from brand/logo.html).
  logo: require('../assets/images/logo-mark.png'),
  // Same mark, recolored brand gold (alpha-preserving recolor of logo-mark.png)
  // -- used where the mark sits on its own rather than beside white wordmark
  // text, so it doesn't fight for attention with the gold nav arrows.
  logoGold: require('../assets/images/logo-mark-gold.png'),
  // The flame framed by its double compass ring -- fades in over the plain
  // flame as it settles into the middle of the closing slide.
  logoRing: require('../assets/images/logo-ring-gold.png'),
  // Charcoal (dark) variant of the ringed emblem -- crossfades with the gold
  // one on the loading screen, syncing to the surrounding glow.
  logoRingCharcoal: require('../assets/images/logo-ring-charcoal.png'),
  // Landing backdrop: golden-hour glow through cloud (Pexels #29150580,
  // free/commercial, no attribution required). The "afterglow" the name means.
  landingSky: require('../assets/images/landing-sky.jpg'),
  // Full brand lockup (icon + wordmark + "Memorial Films"), transparent.
  lockup: require('../assets/images/lockup.png'),
};

export const copy = {
  slogan: 'A memory you can hold.',
  landing: {
    // "Let's remember them well", not "Let's help you remember them well":
    // the shorter line centres the family doing the remembering together,
    // instead of the company offering a service.
    title: "Let's remember them well.",
    subtitle: "Everlit brings together the photos everyone holds of them into one gentle place, so nothing is lost and no one has to grieve alone. Just the moments that mattered, gathered with care.",
  },
};
