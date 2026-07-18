import { useEffect, useState } from 'react';
import { api, photoUrl } from './api';

// The project's best photo (highest average rating, earliest upload as
// tiebreak) for use as a hero/portrait image. Null while loading or when the
// project has no photos yet — callers fall back to the placeholder.
export function useProjectCover(projectId: string | null | undefined) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCoverUrl(null);
    if (!projectId) return;
    api
      .getPhotos(projectId)
      .then((photos) => {
        if (cancelled || photos.length === 0) return;
        const best = [...photos].sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1))[0];
        setCoverUrl(photoUrl(best));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return coverUrl;
}
