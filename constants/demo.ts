import type { Photo } from '../lib/api';

// The sales demo: a complete fictional memorial ("Margaret", matching the
// landing page's sample name) that a rep can walk a family through without a
// backend, an account, or signal. Everything lives in memory and resets on
// reload, so no pitch can ever be broken by the previous one.
//
// Three ways in:
// - EXPO_PUBLIC_DEMO=1 at build time (the original offline preview build)
// - everlit.co.za/demo (runtime: remembered for the rest of the browser tab)
// - any URL with ?demo=1
function demoRequested(): boolean {
  if (process.env.EXPO_PUBLIC_DEMO === '1') return true;
  // Native builds have no window; runtime demo entry is web only.
  if (typeof window === 'undefined') return false;
  try {
    if (window.location.pathname === '/demo' || window.location.search.includes('demo=1')) {
      // Survives the redirect to /app and same-tab reloads, dies with the
      // tab, and never leaks into another visitor's normal session.
      window.sessionStorage.setItem('everlit.demo', '1');
      return true;
    }
    return window.sessionStorage.getItem('everlit.demo') === '1';
  } catch {
    return false;
  }
}

export const DEMO = demoRequested();

// The fictional person this memorial remembers. Used for titles wherever the
// live app would use the real project name.
export const DEMO_PROJECT_NAME = 'Margaret';

type Seed = { src: number; favouritedBy?: string[]; comments?: { author: string; text: string }[] };

// assets/demo/ is gitignored (real photos = family PII, never committed);
// scripts/prepare-demo-photos.mjs fills missing slots on postinstall from
// the committed assets/demo-fallback/ set (copies of the repo's licensed
// landing photos, non-PII). To ship the real demo set, drop licensed photos
// of the fictional person into assets/demo/ as 01..08.jpg. No code change.
const P = [
  require('../assets/demo/01.jpg'),
  require('../assets/demo/02.jpg'),
  require('../assets/demo/03.jpg'),
  require('../assets/demo/04.jpg'),
  require('../assets/demo/05.jpg'),
  require('../assets/demo/06.jpg'),
  require('../assets/demo/07.jpg'),
  require('../assets/demo/08.jpg'),
];

// Margaret's story, told by her family: Sarah and James (her children), Lily
// (granddaughter), Uncle Ray (her brother), Thandi (her neighbour). Written
// so a prospect recognises their own family in it. Warm, specific, dash-free.
const seeds: Seed[] = [
  {
    src: P[0],
    favouritedBy: ['Sarah', 'James', 'Lily'],
    comments: [{ author: 'Sarah', text: 'That golden hour again. She never missed a sunset on the stoep.' }],
  },
  {
    src: P[1],
    favouritedBy: ['James', 'Lily'],
    comments: [{ author: 'Lily', text: 'The day she taught me to bake. Flour everywhere, both of us laughing.' }],
  },
  {
    src: P[2],
    favouritedBy: ['Uncle Ray'],
    comments: [{ author: 'Uncle Ray', text: 'Found this box in her cupboard. Sixty years of us, all kept safe.' }],
  },
  {
    src: P[3],
    favouritedBy: ['Sarah'],
    comments: [{ author: 'James', text: 'The view from the farm gate. She called it her front row seat.' }],
  },
  { src: P[4] },
  {
    src: P[5],
    favouritedBy: ['Thandi'],
    comments: [{ author: 'Thandi', text: 'She brought me soup every winter for twenty years. I miss her knock.' }],
  },
  { src: P[6], favouritedBy: ['Lily'] },
  { src: P[7] },
];

export const DEMO_PHOTOS: Photo[] = seeds.map((s, i) => {
  const id = `demo-${i}`;
  const ratings = (s.favouritedBy ?? []).map((rater, j) => ({
    id: `demo-r-${i}-${j}`, photoId: id, rater, score: 1, createdAt: '',
  }));
  const comments = (s.comments ?? []).map((c, j) => ({
    id: `demo-c-${i}-${j}`, photoId: id, author: c.author, text: c.text, createdAt: '', reactions: [],
  }));
  return {
    id, url: '', originalName: `photo-${i}.jpg`, createdAt: '', avgRating: null,
    ratingCount: ratings.length, ratings, comments, localSource: s.src,
  };
});
