import type { Photo } from '../lib/api';

// Offline preview build. Set EXPO_PUBLIC_DEMO=1 in .env to run the app with
// bundled photos and no backend — favourites/comments live in memory only.
// Off in normal builds, so production behaviour is unchanged.
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

type Seed = { src: number; favouritedBy?: string[]; comments?: { author: string; text: string }[] };

// Placeholder imagery for the offline preview — a bundled, non-PII image so the
// demo build never carries real family photos (those stay out of the repo).
const PLACEHOLDER = require('../assets/images/landing-sky.jpg');

const seeds: Seed[] = [
  { src: PLACEHOLDER, favouritedBy: ['Deon', 'Mom'],
    comments: [{ author: 'Deon', text: 'A favourite moment — summer at the farm.' }] },
  { src: PLACEHOLDER, favouritedBy: ['Keegan'] },
  { src: PLACEHOLDER },
  { src: PLACEHOLDER, favouritedBy: ['Deon', 'Mom', 'Keegan'],
    comments: [{ author: 'Mom', text: 'One of my favourites of them.' }] },
  { src: PLACEHOLDER },
  { src: PLACEHOLDER, favouritedBy: ['Mom'] },
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
