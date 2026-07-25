import React from 'react';
import { Platform } from 'react-native';

// Shared cinematic atmosphere for the app's full-bleed dark screens, the
// same two devices the landing page uses so both surfaces feel shot on the
// same stock: animated film grain, and slow ember dust drifting upward.
//
// Both are web-only (CSS keyframes + tiled PNG have no RN-native
// equivalent), decorative, non-blocking, and frozen under
// prefers-reduced-motion. Injected once per mount; the <style> is keyed by
// id so many screens can render <Atmosphere/> without duplicating rules.
//
// ponytail: one shared stylesheet string instead of a CSS-in-JS layer.

const STYLE_ID = 'everlit-atmosphere';

const CSS = `
@keyframes everlitGrainShift {
  0% { background-position: 0 0; }
  12.5% { background-position: -32px 46px; }
  25% { background-position: 54px -20px; }
  37.5% { background-position: -70px -34px; }
  50% { background-position: 28px 62px; }
  62.5% { background-position: -44px 10px; }
  75% { background-position: 66px -52px; }
  87.5% { background-position: -16px -64px; }
  100% { background-position: 0 0; }
}
@keyframes everlitEmberRise {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(0, -50%, 0); }
}
.everlit-grain {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: url('/grain.png') repeat;
  opacity: 0.06;
  mix-blend-mode: overlay;
  pointer-events: none;
  animation: everlitGrainShift 0.8s steps(1) infinite;
}
.everlit-embers {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 200%;
  z-index: 1;
  opacity: 0.55;
  pointer-events: none;
  background-image:
    radial-gradient(circle, rgba(212, 169, 118, 0.42) 1.5px, transparent 2px),
    radial-gradient(circle, rgba(212, 169, 118, 0.22) 1px, transparent 1.5px),
    radial-gradient(circle, rgba(245, 240, 235, 0.16) 1.2px, transparent 1.8px);
  background-size: 132px 190px, 178px 240px, 224px 300px;
  animation: everlitEmberRise 42s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .everlit-grain, .everlit-embers { animation: none; }
}
`;

function ensureStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

type Props = {
  // Embers suit the standing/waiting screens (gates, loading). Screens that
  // are already busy (the tribute questions) can take grain alone.
  embers?: boolean;
};

export default function Atmosphere({ embers = true }: Props) {
  if (Platform.OS !== 'web') return null;
  ensureStyle();
  return React.createElement(
    React.Fragment,
    null,
    embers ? React.createElement('div', { className: 'everlit-embers', 'aria-hidden': true }) : null,
    React.createElement('div', { className: 'everlit-grain', 'aria-hidden': true })
  );
}
