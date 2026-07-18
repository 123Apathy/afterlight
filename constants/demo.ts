import type { Photo } from '../lib/api';

// Offline preview build. Set EXPO_PUBLIC_DEMO=1 in .env to run the app with
// bundled photos and no backend — favourites/comments live in memory only.
// Off in normal builds, so production behaviour is unchanged.
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

type Seed = { src: number; favouritedBy?: string[]; comments?: { author: string; text: string }[] };

const seeds: Seed[] = [
  { src: require('../assets/demo/photo-01.jpg'), favouritedBy: ['Deon', 'Mom'],
    comments: [{ author: 'Deon', text: 'Ouma with the little one — summer at the farm.' }] },
  { src: require('../assets/demo/photo-02.jpg'), favouritedBy: ['Keegan'] },
  { src: require('../assets/demo/photo-03.jpg') },
  { src: require('../assets/demo/photo-04.jpg'), favouritedBy: ['Deon', 'Mom', 'Keegan'],
    comments: [{ author: 'Mom', text: 'One of my favourites of her.' }] },
  { src: require('../assets/demo/photo-05.jpg') },
  { src: require('../assets/demo/photo-06.jpg'), favouritedBy: ['Mom'] },
  { src: require('../assets/demo/photo-07.jpg') },
  { src: require('../assets/demo/photo-08.jpg'), favouritedBy: ['Deon'] },
];

export const DEMO_PHOTOS: Photo[] = seeds.map((s, i) => {
  const id = `demo-${i}`;
  const ratings = (s.favouritedBy ?? []).map((rater, j) => ({
    id: `demo-r-${i}-${j}`, photoId: id, rater, score: 1, createdAt: '',
  }));
  const comments = (s.comments ?? []).map((c, j) => ({
    id: `demo-c-${i}-${j}`, photoId: id, author: c.author, text: c.text, createdAt: '',
  }));
  return {
    id, url: '', originalName: `photo-${i}.jpg`, createdAt: '', avgRating: null,
    ratingCount: ratings.length, ratings, comments, localSource: s.src,
  };
});
